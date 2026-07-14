"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DOCUMENT_CODES,
  RECORD_STATUS_LABELS,
  USER_ROLE_LABELS,
  computeRecordCounts,
  flattenItems,
  validateChecklistResponses,
  type ChecklistResponseMap,
  type InspectionRecordDetail,
  type SubmitRecordResult,
} from "@nelna/shared";
import { Alert, Badge, Button, Card, ChecklistRenderer, LoadingState, StickySubmitBar } from "@nelna/ui";
import {
  InspectionRecordApiError,
  createCleaningDraft,
  fetchInspectionRecord,
  saveInspectionDraft,
  submitInspectionRecord,
} from "@/lib/inspection-records/api";
import { clearDraft, formatDraftSavedAt, loadRecoverableDraft, saveDraft } from "@/lib/draft-storage";
import { RecordHeaderField } from "@/components/records/RecordHeaderField";
import { enqueueOfflineSubmission } from "@/lib/offline/queue-store";
import { processOfflineQueue } from "@/lib/offline/sync-engine";

type WorkflowPhase = "editing" | "review";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; isDuplicate: boolean }
  | { status: "ready"; detail: InspectionRecordDetail }
  | { status: "success"; detail: InspectionRecordDetail; result: SubmitRecordResult };

export type InspectionRecordWorkspaceProps = {
  /** Loads this exact record instead of creating/resuming today's draft — used by `/records/cleaning/[id]`. */
  recordId?: string;
  /** Links a freshly-created draft back to the Today's Tasks assignment that started it. */
  assignmentId?: string | null;
};

const AUTOSAVE_DELAY_MS = 1500;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function downloadOfficialPdf(recordId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/reports/record-pdf/${encodeURIComponent(recordId)}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `PDF download failed (${response.status})`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] ?? `record-${recordId}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Full "open task → mark all acceptable → review → submit" workflow for one
 * Daily Cleaning Verification (NMS/PPU/CL/24) record, driven entirely by the
 * dynamic checklist engine (`ChecklistRenderer`) and the inspection-records
 * API. Doubles as the record detail view: once a record is no longer
 * editable (submitted/checked/verified, or someone else's record), the same
 * component renders a read-only view of it.
 */
export function InspectionRecordWorkspace({ recordId, assignmentId }: InspectionRecordWorkspaceProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [responses, setResponses] = useState<ChecklistResponseMap>({});
  const [phase, setPhase] = useState<WorkflowPhase>("editing");
  const [dirty, setDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosave = useRef(false);
  const loadAttempt = useRef(0);
  const submitInFlight = useRef(false);

  function loadWorkspace() {
    const attempt = ++loadAttempt.current;
    setState({ status: "loading" });

    const load = recordId
      ? fetchInspectionRecord(recordId)
      : createCleaningDraft(assignmentId ? { taskAssignmentId: assignmentId } : {});

    load
      .then((detail) => {
        if (attempt !== loadAttempt.current) return;
        skipNextAutosave.current = true;
        const recovered = loadRecoverableDraft<ChecklistResponseMap>(
          `inspection-record:${detail.header.id}`,
          detail.header.updatedAt,
        );
        setResponses(recovered?.responses ?? detail.responses);
        setDraftRecovered(Boolean(recovered));
        setPhase("editing");
        setDirty(false);
        setState({ status: "ready", detail });
      })
      .catch((error: unknown) => {
        if (attempt !== loadAttempt.current) return;
        const isDuplicate = error instanceof InspectionRecordApiError && error.status === 409;
        const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
        setState({ status: "error", message, isDuplicate });
      });
  }

  useEffect(() => {
    loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, assignmentId]);

  const detail = state.status === "ready" || state.status === "success" ? state.detail : null;
  const activeRecordId = detail?.header.id ?? null;
  const editable = state.status === "ready" && detail !== null && detail.editable;

  // Autosave (debounced API save) + a best-effort localStorage backup on
  // every change, so a flaky connection never loses in-progress work.
  useEffect(() => {
    if (!activeRecordId || !editable) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }

    setDirty(true);
    saveDraft(`inspection-record:${activeRecordId}`, { responses, savedAt: new Date().toISOString() });

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      setSaveError(null);
      saveInspectionDraft(activeRecordId, { responses })
        .then(() => {
          setDirty(false);
          setDraftSavedAt(new Date().toISOString());
          clearDraft(`inspection-record:${activeRecordId}`);
          setDraftRecovered(false);
        })
        .catch((error: unknown) => {
          setSaveError(
            error instanceof Error
              ? `Autosave failed: ${error.message} — your responses are still kept on this device.`
              : "Autosave failed. Your responses are still kept on this device.",
          );
        });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [responses, activeRecordId, editable]);

  // Warn before leaving (refresh/close tab/back) while an autosave is
  // pending or has failed.
  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const items = useMemo(() => (detail ? flattenItems(detail.version.sections) : []), [detail]);
  const validation = useMemo(
    () => (detail ? validateChecklistResponses(detail.version.sections, responses) : null),
    [detail, responses],
  );
  const counts = useMemo(() => (detail ? computeRecordCounts(items, responses) : null), [detail, items, responses]);

  function handleReview() {
    setPhase("review");
  }

  function handleBackToEdit() {
    setPhase("editing");
  }

  async function handleSubmit() {
    if (!activeRecordId || submitInFlight.current || !detail) return;
    submitInFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineSubmission({
          recordType:
            detail.header.documentCode === DOCUMENT_CODES.FREEZER_TRUCK ? "FREEZER_TRUCK" : "DAILY_CLEANING",
          recordId: activeRecordId,
          payload: { responses },
          templateVersionNumber: detail.header.templateVersionNumber,
          serverUpdatedAt: detail.header.updatedAt,
          state: "WAITING_TO_SYNC",
        });
        saveDraft(`inspection-record:${activeRecordId}`, {
          responses,
          savedAt: new Date().toISOString(),
        } satisfies { responses: ChecklistResponseMap; savedAt: string });
        setSubmitError(
          "You are offline. The record was saved on this device and is waiting to sync — it is not submitted on the server yet.",
        );
        return;
      }
      const result = await submitInspectionRecord(activeRecordId, { responses });
      clearDraft(`inspection-record:${activeRecordId}`);
      setDraftRecovered(false);
      setDirty(false);
      void processOfflineQueue();
      setState((current) => {
        if (current.status !== "ready") return current;
        return { status: "success", detail: { ...current.detail, editable: false }, result };
      });
    } catch (error) {
      if (error instanceof InspectionRecordApiError && error.status === 0) {
        try {
          await enqueueOfflineSubmission({
            recordType:
              detail.header.documentCode === DOCUMENT_CODES.FREEZER_TRUCK ? "FREEZER_TRUCK" : "DAILY_CLEANING",
            recordId: activeRecordId,
            payload: { responses },
            templateVersionNumber: detail.header.templateVersionNumber,
            serverUpdatedAt: detail.header.updatedAt,
            state: "WAITING_TO_SYNC",
          });
          setSubmitError(
            "Could not reach the server. The record was queued on this device and is not marked submitted until sync succeeds.",
          );
          return;
        } catch {
          // fall through
        }
      }
      if (error instanceof InspectionRecordApiError) {
        setSubmitError(error.message);
        if (error.validationErrors && error.validationErrors.length > 0) {
          setPhase("review");
        }
      } else {
        setSubmitError("Something went wrong while submitting. Please try again.");
      }
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  }

  if (state.status === "loading") {
    return <LoadingState message="Loading your cleaning verification…" />;
  }

  if (state.status === "error") {
    return (
      <Alert tone="danger" title={state.isDuplicate ? "Already in progress" : "Couldn't open this record"}>
        <p style={{ margin: 0 }}>{state.message}</p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem" }}>
          {state.isDuplicate ? (
            <Button variant="secondary" size="md" onClick={() => (window.location.href = "/tasks")}>
              Back to Today&apos;s Tasks
            </Button>
          ) : (
            <Button variant="secondary" size="md" onClick={loadWorkspace}>
              Retry
            </Button>
          )}
        </div>
      </Alert>
    );
  }

  if (state.status === "success") {
    return <RecordSuccessScreen detail={state.detail} result={state.result} />;
  }

  return (
    <div className="space-y-4 pb-4">
      <RecordHeaderCard detail={detail!} />

      {!editable ? (
        <Alert tone="information" title="Read-only">
          This record is {RECORD_STATUS_LABELS[detail!.header.status].toLowerCase()} and can no longer be edited
          here.
        </Alert>
      ) : null}

      {saveError ? <Alert tone="warning">{saveError}</Alert> : null}
      {draftRecovered ? (
        <Alert tone="warning" title="Local draft restored">
          A newer backup saved on this device was restored. Review and save it before submitting.
        </Alert>
      ) : null}
      {submitError ? (
        <Alert tone="danger" title="Couldn't submit">
          {submitError}
        </Alert>
      ) : null}

      {phase === "review" && counts ? <ReviewCountsCard counts={counts} /> : null}

      <ChecklistRenderer
        version={detail!.version}
        responses={responses}
        onResponsesChange={setResponses}
        disabled={!editable}
        showValidationSummary={phase === "review"}
        showMarkAllAcceptable={editable && phase === "editing"}
        showClearAll={editable && phase === "editing"}
      />

      {editable ? (
        <StickySubmitBar draftHint={formatDraftSavedAt(draftSavedAt)}>
          {phase === "editing" ? (
            <Button variant="primary" fullWidth onClick={handleReview}>
              Review
            </Button>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button variant="ghost" onClick={handleBackToEdit} disabled={submitting}>
                Back to edit
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleSubmit}
                loading={submitting}
                disabled={!validation?.isValid}
              >
                Submit cleaning verification
              </Button>
            </div>
          )}
        </StickySubmitBar>
      ) : null}
    </div>
  );
}

function RecordHeaderCard({ detail }: { detail: InspectionRecordDetail }) {
  const { header } = detail;
  const recordDate = new Date(`${header.recordDate}T00:00:00.000Z`);

  return (
    <Card padding="lg">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ display: "grid", gap: "0.3rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--nelna-primary)",
            }}
          >
            {header.documentCode} · v{header.templateVersionNumber}
          </p>
          <h2
            style={{ margin: 0, fontFamily: "var(--nelna-font-display)", fontSize: "1.3rem", color: "var(--nelna-primary-active)" }}
          >
            {header.templateTitle}
          </h2>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--nelna-text-muted)" }}>Record #{header.recordNumber}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <Badge tone={statusTone(header.status)}>{RECORD_STATUS_LABELS[header.status]}</Badge>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              void downloadOfficialPdf(header.id).catch((err: unknown) => {
                window.alert(err instanceof Error ? err.message : "PDF download failed");
              });
            }}
          >
            Download official PDF
          </Button>
        </div>
      </div>

      <dl
        style={{
          marginTop: "1rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          fontSize: "0.9rem",
        }}
      >
        <RecordHeaderField label="Date" value={recordDate.toLocaleDateString(undefined, { dateStyle: "medium" })} />
        <RecordHeaderField label="Month" value={header.recordMonth} />
        <RecordHeaderField label="Shift" value={header.shiftLabel ?? "—"} />
        <RecordHeaderField label="Section / area" value={header.areaLabel ?? "—"} />
        <RecordHeaderField label="Recorded by" value={`${header.recordedBy.fullName} (${header.recordedBy.employeeCode})`} />
        <RecordHeaderField
          label="Checked by"
          value={
            header.checkedBy
              ? `${header.checkedBy.fullName} (${header.checkedBy.employeeCode})`
              : "Pending check"
          }
        />
        <RecordHeaderField
          label="Verified by"
          value={
            header.verifiedBy
              ? `${header.verifiedBy.fullName} (${header.verifiedBy.employeeCode})`
              : "Pending verification"
          }
        />      </dl>
    </Card>
  );
}

function ReviewCountsCard({
  counts,
}: {
  counts: { acceptable: number; failed: number; notApplicable: number; unanswered: number; total: number };
}) {
  return (
    <Card>
      <p style={{ margin: "0 0 0.65rem", fontWeight: 700, color: "var(--nelna-primary-dark)" }}>
        Review before submitting
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "0.75rem" }}>
        <CountStat label="Acceptable" value={counts.acceptable} tone="success" />
        <CountStat label="Unacceptable" value={counts.failed} tone="danger" />
        <CountStat label="N/A" value={counts.notApplicable} tone="neutral" />
        <CountStat label="Unanswered" value={counts.unanswered} tone="warning" />
      </div>
    </Card>
  );
}

function CountStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "neutral" | "warning";
}) {
  const colors: Record<typeof tone, string> = {
    success: "var(--nelna-primary)",
    danger: "var(--nelna-danger)",
    neutral: "var(--nelna-text-muted)",
    warning: "#a56b00",
  };
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: colors[tone] }}>{value}</p>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--nelna-text-muted)" }}>{label}</p>
    </div>
  );
}

function statusTone(status: InspectionRecordDetail["header"]["status"]): "neutral" | "success" | "warning" | "danger" | "information" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "SUBMITTED":
    case "CHECKED":
      return "information";
    case "VERIFIED":
      return "success";
    case "REJECTED":
      return "danger";
    case "ARCHIVED":
      return "neutral";
    default:
      return "neutral";
  }
}

function RecordSuccessScreen({
  detail,
  result,
}: {
  detail: InspectionRecordDetail;
  result: SubmitRecordResult;
}) {
  const submittedAt = new Date(result.submittedAt);

  return (
    <div className="space-y-4">
      <Card padding="lg">
        <div style={{ textAlign: "center", display: "grid", gap: "0.5rem", justifyItems: "center" }}>
          <span
            aria-hidden
            style={{
              width: "3rem",
              height: "3rem",
              borderRadius: "50%",
              background: "var(--nelna-success-bg)",
              color: "var(--nelna-primary)",
              display: "grid",
              placeItems: "center",
              fontSize: "1.5rem",
            }}
          >
            ✓
          </span>
          <h2 style={{ margin: 0, fontFamily: "var(--nelna-font-display)", fontSize: "1.4rem", color: "var(--nelna-primary-active)" }}>
            Cleaning verification submitted
          </h2>
          <p style={{ margin: 0, color: "var(--nelna-text-secondary)" }}>
            Record #{result.recordNumber} · submitted {submittedAt.toLocaleString()}
          </p>
          <Badge tone={statusTone(result.status)}>{RECORD_STATUS_LABELS[result.status]}</Badge>
        </div>

        {result.hasCriticalFailure ? (
          <Alert tone="danger" title="Critical failure recorded" >
            This record includes at least one critical failure. It has been flagged for immediate follow-up.
          </Alert>
        ) : null}

        <div style={{ marginTop: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "0.75rem" }}>
          <CountStat label="Acceptable" value={result.counts.acceptable} tone="success" />
          <CountStat label="Unacceptable" value={result.counts.failed} tone="danger" />
          <CountStat label="N/A" value={result.counts.notApplicable} tone="neutral" />
          <CountStat label="Unanswered" value={result.counts.unanswered} tone="warning" />
        </div>

        {result.correctiveActionsCreated > 0 ? (
          <p style={{ marginTop: "1rem", color: "var(--nelna-text-secondary)" }}>
            {result.correctiveActionsCreated} corrective action{result.correctiveActionsCreated === 1 ? "" : "s"}{" "}
            {result.correctiveActionsCreated === 1 ? "was" : "were"} automatically opened for the failing items that
            require one.
          </p>
        ) : null}

        <p style={{ marginTop: "1rem", color: "var(--nelna-text-secondary)" }}>
          {result.nextResponsibleRole
            ? `Next up: ${USER_ROLE_LABELS[result.nextResponsibleRole]} review.`
            : "No further action is required."}
        </p>

        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/tasks">
            <Button variant="primary">Return to Today&apos;s Tasks</Button>
          </Link>
          <Link href={`/records/cleaning/${detail.header.id}`}>
            <Button variant="secondary">View record</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
