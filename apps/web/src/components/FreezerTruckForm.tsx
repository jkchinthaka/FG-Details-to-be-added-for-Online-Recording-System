"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DOCUMENT_CODES,
  LOADING_DECISION_LABELS,
  LOADING_DECISION_TONES,
  RECORD_STATUS_LABELS,
  USER_ROLE_LABELS,
  allowedFinalDecisions,
  computeRecordCounts,
  flattenItems,
  validateChecklistResponses,
  type ChecklistResponseMap,
  type FinalLoadingDecision,
  type InspectionRecordDetail,
  type SubmitRecordResult,
  type VehicleSummary,
} from "@nelna/shared";
import {
  Alert,
  Badge,
  Button,
  Card,
  ChecklistRenderer,
  Input,
  LoadingState,
  StickySubmitBar,
  Textarea,
} from "@nelna/ui";
import {
  InspectionRecordApiError,
  createTruckDraft,
  fetchInspectionRecord,
  recordLoadingDecision,
  saveInspectionDraft,
  submitInspectionRecord,
} from "@/lib/inspection-records/api";
import { searchVehicles } from "@/lib/vehicles/api";
import { clearDraft, formatDraftSavedAt, saveDraft } from "@/lib/draft-storage";
import { useAuth } from "@/lib/auth/auth-context";

type WorkflowPhase = "editing" | "review";

type LoadState =
  | { status: "selecting" }
  | { status: "loading" }
  | { status: "error"; message: string; isDuplicate: boolean }
  | { status: "ready"; detail: InspectionRecordDetail }
  | { status: "success"; detail: InspectionRecordDetail; result: SubmitRecordResult };

export type FreezerTruckFormProps = {
  /** Loads this exact record instead of starting a new draft — used by `/records/freezer-truck/[id]`. */
  recordId?: string;
  /** Links a freshly-created draft back to the Today's Tasks assignment that started it. */
  assignmentId?: string | null;
};

const AUTOSAVE_DELAY_MS = 1500;

/**
 * Full "select vehicle → All Conditions Passed → review → submit" workflow
 * for one Freezer Truck Inspection Before Loading (NMS/PPU/CL/30) record,
 * driven by the dynamic checklist engine (`ChecklistRenderer`) exactly like
 * `InspectionRecordWorkspace` (Daily Cleaning) — plus a vehicle-selection
 * step before a record even exists, and truck-only detail (vehicle,
 * transporter, driver, loading decision) once it does. Doubles as the
 * record detail view, including a supervisor/QA loading-decision approval
 * panel once the record has been submitted.
 */
export function FreezerTruckForm({ recordId, assignmentId }: FreezerTruckFormProps) {
  const [state, setState] = useState<LoadState>({ status: recordId ? "loading" : "selecting" });
  const [responses, setResponses] = useState<ChecklistResponseMap>({});
  const [phase, setPhase] = useState<WorkflowPhase>("editing");
  const [dirty, setDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosave = useRef(false);
  const loadAttempt = useRef(0);

  function loadRecord() {
    if (!recordId) return;
    const attempt = ++loadAttempt.current;
    setState({ status: "loading" });
    fetchInspectionRecord(recordId)
      .then((detail) => {
        if (attempt !== loadAttempt.current) return;
        skipNextAutosave.current = true;
        setResponses(detail.responses);
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
    if (recordId) loadRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  function handleDraftReady(detail: InspectionRecordDetail) {
    skipNextAutosave.current = true;
    setResponses(detail.responses);
    setPhase("editing");
    setDirty(false);
    setState({ status: "ready", detail });
  }

  function handleDecisionRecorded(nextDetail: InspectionRecordDetail) {
    setState({ status: "ready", detail: nextDetail });
  }

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
    if (!activeRecordId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitInspectionRecord(activeRecordId, { responses });
      clearDraft(`inspection-record:${activeRecordId}`);
      setDirty(false);
      setState((current) => {
        if (current.status !== "ready") return current;
        return { status: "success", detail: { ...current.detail, editable: false }, result };
      });
    } catch (error) {
      if (error instanceof InspectionRecordApiError) {
        setSubmitError(error.message);
        if (error.validationErrors && error.validationErrors.length > 0) {
          setPhase("review");
        }
      } else {
        setSubmitError("Something went wrong while submitting. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === "selecting") {
    return <VehicleSelectionStep assignmentId={assignmentId ?? null} onDraftReady={handleDraftReady} />;
  }

  if (state.status === "loading") {
    return <LoadingState message="Loading the freezer truck inspection…" />;
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
            <Button variant="secondary" size="md" onClick={loadRecord}>
              Retry
            </Button>
          )}
        </div>
      </Alert>
    );
  }

  if (state.status === "success") {
    return <TruckRecordSuccessScreen detail={state.detail} result={state.result} />;
  }

  const showDecisionPanel = Boolean(detail!.truck) && detail!.header.status !== "DRAFT";

  return (
    <div className="space-y-4 pb-4">
      <TruckHeaderCard detail={detail!} />

      {showDecisionPanel ? (
        <LoadingDecisionPanel detail={detail!} onDecisionRecorded={handleDecisionRecorded} />
      ) : null}

      {!editable && !showDecisionPanel ? (
        <Alert tone="information" title="Read-only">
          This record is {RECORD_STATUS_LABELS[detail!.header.status].toLowerCase()} and can no longer be edited
          here.
        </Alert>
      ) : null}

      {saveError ? <Alert tone="warning">{saveError}</Alert> : null}
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
                Submit freezer truck inspection
              </Button>
            </div>
          )}
        </StickySubmitBar>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vehicle selection (before a draft record exists)
// ---------------------------------------------------------------------------

function VehicleSelectionStep({
  assignmentId,
  onDraftReady,
}: {
  assignmentId: string | null;
  onDraftReady: (detail: InspectionRecordDetail) => void;
}) {
  const { user } = useAuth();
  const canEnterManually = Boolean(user?.permissions.includes("vehicles:manual_entry"));

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VehicleSummary[]>([]);
  const [isRecent, setIsRecent] = useState(true);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleSummary | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualTruckNumber, setManualTruckNumber] = useState("");
  const [manualVehicleNumber, setManualVehicleNumber] = useState("");
  const [loadingReference, setLoadingReference] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAttempt = useRef(0);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const attempt = ++searchAttempt.current;
    setSearching(true);
    setSearchError(null);

    debounceTimer.current = setTimeout(
      () => {
        searchVehicles(query)
          .then((response) => {
            if (attempt !== searchAttempt.current) return;
            setResults(response.vehicles);
            setIsRecent(response.isRecent);
          })
          .catch((error: unknown) => {
            if (attempt !== searchAttempt.current) return;
            setSearchError(error instanceof Error ? error.message : "Couldn't load vehicles. Please try again.");
          })
          .finally(() => {
            if (attempt === searchAttempt.current) setSearching(false);
          });
      },
      query.trim() ? 300 : 0,
    );

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  function selectVehicle(vehicle: VehicleSummary) {
    setSelectedVehicle(vehicle);
    setManualMode(false);
    setFormError(null);
  }

  async function handleContinue() {
    setFormError(null);

    if (!selectedVehicle && !(manualMode && manualTruckNumber.trim() && manualVehicleNumber.trim())) {
      setFormError("Search and select a vehicle, or enter its truck and vehicle numbers manually.");
      return;
    }

    setCreating(true);
    try {
      const detail = await createTruckDraft({
        vehicleId: selectedVehicle?.id,
        freezerTruckNumber: manualMode ? manualTruckNumber.trim() : undefined,
        vehicleNumber: manualMode ? manualVehicleNumber.trim() : undefined,
        loadingReference: loadingReference.trim() || undefined,
        productCategory: productCategory.trim() || undefined,
        taskAssignmentId: assignmentId ?? undefined,
      });
      onDraftReady(detail);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <Card padding="lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-nelna-primary">
          {DOCUMENT_CODES.FREEZER_TRUCK}
        </p>
        <h2
          className="mt-1 text-2xl text-nelna-primary-dark"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Freezer truck before loading
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          Search for the truck to begin its pre-loading inspection.
        </p>
      </Card>

      <Card>
        <Input
          label="Search vehicle or freezer truck number"
          placeholder="e.g. MH-12 AB 3456"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedVehicle(null);
          }}
          autoComplete="off"
        />

        {selectedVehicle ? (
          <div
            className="mt-2 flex items-center justify-between gap-2 rounded-[10px] border-2 p-3"
            style={{ borderColor: "var(--nelna-primary)", background: "var(--nelna-success-bg)" }}
          >
            <div>
              <p className="font-semibold text-nelna-primary-dark">{selectedVehicle.vehicleNumber}</p>
              <p className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
                {[selectedVehicle.freezerTruckNumber, selectedVehicle.transporter?.name].filter(Boolean).join(" · ") ||
                  "No transporter on file"}
              </p>
            </div>
            <Button variant="ghost" size="md" onClick={() => setSelectedVehicle(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {searching ? (
              <p className="text-sm" style={{ color: "var(--nelna-text-muted)" }}>
                Searching…
              </p>
            ) : null}
            {searchError ? <Alert tone="warning">{searchError}</Alert> : null}
            {!searching && !searchError ? (
              <>
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--nelna-text-muted)" }}
                >
                  {isRecent ? "Recent vehicles" : "Search results"}
                </p>
                {results.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--nelna-text-muted)" }}>
                    No vehicles found.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {results.map((vehicle) => (
                      <li key={vehicle.id}>
                        <button
                          type="button"
                          onClick={() => selectVehicle(vehicle)}
                          className="w-full rounded-[10px] border-2 border-[var(--nelna-border)] p-3 text-left"
                        >
                          <p className="font-semibold text-nelna-primary-dark">{vehicle.vehicleNumber}</p>
                          <p className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
                            {[vehicle.freezerTruckNumber, vehicle.transporter?.name].filter(Boolean).join(" · ") ||
                              "No transporter on file"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </div>
        )}

        {canEnterManually ? (
          <div className="mt-3 border-t border-[var(--nelna-border)] pt-3">
            <button
              type="button"
              onClick={() => {
                setManualMode((previous) => !previous);
                setSelectedVehicle(null);
              }}
              className="text-sm font-semibold text-nelna-primary"
            >
              {manualMode ? "Search for a vehicle instead" : "Enter truck & vehicle number manually"}
            </button>
            {manualMode ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  label="Freezer truck number"
                  value={manualTruckNumber}
                  onChange={(event) => setManualTruckNumber(event.target.value)}
                  autoComplete="off"
                />
                <Input
                  label="Vehicle number"
                  value={manualVehicleNumber}
                  onChange={(event) => setManualVehicleNumber(event.target.value)}
                  autoComplete="off"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Loading reference"
            hint="Optional"
            value={loadingReference}
            onChange={(event) => setLoadingReference(event.target.value)}
            autoComplete="off"
          />
          <Input
            label="Product category"
            hint="Optional"
            value={productCategory}
            onChange={(event) => setProductCategory(event.target.value)}
            autoComplete="off"
          />
        </div>
      </Card>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <StickySubmitBar>
        <Button variant="primary" fullWidth onClick={handleContinue} loading={creating}>
          Continue to inspection
        </Button>
      </StickySubmitBar>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header, review, decision & success — presentational helpers
// ---------------------------------------------------------------------------

function TruckHeaderCard({ detail }: { detail: InspectionRecordDetail }) {
  const { header, truck } = detail;
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
        <Badge tone={statusTone(header.status)}>{RECORD_STATUS_LABELS[header.status]}</Badge>
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
        <HeaderField label="Date" value={recordDate.toLocaleDateString(undefined, { dateStyle: "medium" })} />
        <HeaderField label="Shift" value={header.shiftLabel ?? "—"} />
        <HeaderField label="Vehicle number" value={truck?.vehicleNumber ?? "—"} />
        <HeaderField label="Freezer truck number" value={truck?.freezerTruckNumber ?? "—"} />
        <HeaderField label="Transporter" value={truck?.transporter?.name ?? "—"} />
        <HeaderField label="Driver" value={truck?.driver?.fullName ?? "—"} />
        <HeaderField label="Loading reference" value={truck?.loadingReference ?? "—"} />
        <HeaderField label="Product category" value={truck?.productCategory ?? "—"} />
        <HeaderField label="Inspector" value={`${header.recordedBy.fullName} (${header.recordedBy.employeeCode})`} />
      </dl>

      {truck?.reinspectionOf ? (
        <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--nelna-text-secondary)" }}>
          Re-inspection of record #{truck.reinspectionOf.recordNumber}
        </p>
      ) : null}
    </Card>
  );
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ margin: 0, color: "var(--nelna-text-muted)", fontSize: "0.75rem" }}>{label}</dt>
      <dd style={{ margin: "0.15rem 0 0", fontWeight: 600, color: "var(--nelna-text)" }}>{value}</dd>
    </div>
  );
}

/**
 * Shows the system-computed recommended decision alongside the current
 * final decision, and — only for a user holding `loading_decisions:approve`
 * — the picker a supervisor/QA uses to record it. Enforces the same
 * "a critical failure cannot be overridden to approved" rule as the API via
 * `allowedFinalDecisions`, so the picker only ever offers legal choices.
 */
function LoadingDecisionPanel({
  detail,
  onDecisionRecorded,
}: {
  detail: InspectionRecordDetail;
  onDecisionRecorded: (next: InspectionRecordDetail) => void;
}) {
  const { user } = useAuth();
  const truck = detail.truck;
  const [decision, setDecision] = useState<FinalLoadingDecision>(
    ((truck?.loadingDecision === "PENDING" ? null : truck?.loadingDecision) ?? "LOADING_BLOCKED") as FinalLoadingDecision,
  );
  const [remarks, setRemarks] = useState(truck?.remarks ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!truck) return null;

  const canDecide = Boolean(user?.permissions.includes("loading_decisions:approve"));
  const allowed = allowedFinalDecisions(truck.recommendedDecision);

  async function handleRecordDecision() {
    setSubmitting(true);
    setError(null);
    try {
      const next = await recordLoadingDecision(detail.header.id, {
        decision,
        remarks: remarks.trim() || undefined,
      });
      onDecisionRecorded(next);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--nelna-primary-dark)" }}>Loading decision</p>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--nelna-text-secondary)" }}>
            System recommendation:{" "}
            {truck.recommendedDecision ? LOADING_DECISION_LABELS[truck.recommendedDecision] : "—"}
          </p>
        </div>
        <Badge tone={LOADING_DECISION_TONES[truck.loadingDecision]}>
          {LOADING_DECISION_LABELS[truck.loadingDecision]}
        </Badge>
      </div>

      {truck.decidedBy ? (
        <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--nelna-text-muted)" }}>
          Decided by {truck.decidedBy.fullName} ({truck.decidedBy.employeeCode})
          {truck.decidedAt ? ` · ${new Date(truck.decidedAt).toLocaleString()}` : ""}
          {truck.remarks ? ` — "${truck.remarks}"` : ""}
        </p>
      ) : (
        <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--nelna-text-muted)" }}>
          Awaiting a final decision from a supervisor or QA.
        </p>
      )}

      {truck.recommendedDecision === "LOADING_BLOCKED" ? (
        <div style={{ marginTop: "0.75rem" }}>
          <Alert tone="danger" title="Critical failure — loading cannot be approved">
            This inspection recorded a critical failure. The final decision can only be &quot;Loading temporarily
            blocked&quot; or &quot;Rejected&quot;.
          </Alert>
        </div>
      ) : null}

      {canDecide ? (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Record final decision</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {allowed.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={decision === option}
                onClick={() => setDecision(option)}
                className="min-h-12 rounded-[var(--nelna-radius)] border-2 px-3 text-sm font-semibold"
                style={{
                  borderColor: decision === option ? "var(--nelna-primary)" : "var(--nelna-border)",
                  background: decision === option ? "var(--nelna-success-bg)" : "white",
                }}
              >
                {LOADING_DECISION_LABELS[option]}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <Textarea label="Remarks" hint="Optional" value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} />
          </div>
          {error ? (
            <div style={{ marginTop: "0.5rem" }}>
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}
          <div style={{ marginTop: "0.5rem" }}>
            <Button variant="primary" onClick={handleRecordDecision} loading={submitting}>
              Record decision
            </Button>
          </div>
        </div>
      ) : null}
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

function TruckRecordSuccessScreen({
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
            Freezer truck inspection submitted
          </h2>
          <p style={{ margin: 0, color: "var(--nelna-text-secondary)" }}>
            Record #{result.recordNumber} · submitted {submittedAt.toLocaleString()}
          </p>
          {result.loadingDecision ? (
            <Badge tone={LOADING_DECISION_TONES[result.loadingDecision]}>
              {LOADING_DECISION_LABELS[result.loadingDecision]}
            </Badge>
          ) : null}
        </div>

        {result.hasCriticalFailure ? (
          <Alert tone="danger" title="Critical failure recorded">
            This inspection includes at least one critical failure. Loading is automatically blocked and cannot be
            overridden by the operator.
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
            ? `Next up: ${USER_ROLE_LABELS[result.nextResponsibleRole]} to confirm the final loading decision.`
            : "No further action is required."}
        </p>

        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/tasks">
            <Button variant="primary">Return to Today&apos;s Tasks</Button>
          </Link>
          <Link href={`/records/freezer-truck/${detail.header.id}`}>
            <Button variant="secondary">View record</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
