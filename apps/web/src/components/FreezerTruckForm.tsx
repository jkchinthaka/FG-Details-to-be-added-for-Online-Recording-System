"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DOCUMENT_CODES,
  FREEZER_TRUCK_CHECK_ITEMS,
  LOADING_DECISION_LABELS,
  WORK_SHIFT_LABELS,
  freezerTruckInspectionSchema,
  markAllFreezerTruckAcceptable,
  type CheckItemResult,
  type FreezerTruckCheckId,
  type LoadingDecision,
} from "@nelna/shared";
import {
  ChecklistResultToggle,
  MarkAllAcceptableBar,
  NelnaButton,
  StickySubmitBar,
} from "@nelna/ui";
import {
  clearDraft,
  formatDraftSavedAt,
  loadDraft,
  saveDraft,
} from "@/lib/draft-storage";
import { detectCurrentShift } from "@/lib/shift";

type LineState = {
  itemId: FreezerTruckCheckId;
  result: CheckItemResult | null;
  failureNote?: string;
};

type TruckDraft = {
  freezerTruckNumber: string;
  vehicleNumber: string;
  lines: LineState[];
  correctiveAction: string;
  loadingDecision: LoadingDecision | null;
  savedAt: string;
};

const DRAFT_KEY = "freezer-truck-inspection";

function emptyLines(): LineState[] {
  return FREEZER_TRUCK_CHECK_ITEMS.map((item) => ({
    itemId: item.id,
    result: null,
  }));
}

export function FreezerTruckForm() {
  const [freezerTruckNumber, setFreezerTruckNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [lines, setLines] = useState<LineState[]>(emptyLines);
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [loadingDecision, setLoadingDecision] = useState<LoadingDecision | null>(
    null,
  );
  const [draftSavedAt, setDraftSavedAt] = useState<string | undefined>();
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shift = useMemo(() => detectCurrentShift(), []);
  const recordedAt = useMemo(() => new Date(), []);

  useEffect(() => {
    const draft = loadDraft<TruckDraft>(DRAFT_KEY);
    if (!draft) return;
    setFreezerTruckNumber(draft.freezerTruckNumber ?? "");
    setVehicleNumber(draft.vehicleNumber ?? "");
    if (draft.lines?.length) setLines(draft.lines);
    setCorrectiveAction(draft.correctiveAction ?? "");
    setLoadingDecision(draft.loadingDecision);
    setDraftSavedAt(draft.savedAt);
  }, []);

  useEffect(() => {
    const savedAt = new Date().toISOString();
    saveDraft<TruckDraft>(DRAFT_KEY, {
      freezerTruckNumber,
      vehicleNumber,
      lines,
      correctiveAction,
      loadingDecision,
      savedAt,
    });
    setDraftSavedAt(savedAt);
  }, [
    freezerTruckNumber,
    vehicleNumber,
    lines,
    correctiveAction,
    loadingDecision,
  ]);

  function updateLine(itemId: FreezerTruckCheckId, patch: Partial<LineState>) {
    setSubmitMessage(null);
    setLines((prev) =>
      prev.map((line) => (line.itemId === itemId ? { ...line, ...patch } : line)),
    );
  }

  function handleMarkAll() {
    setErrors({});
    setSubmitMessage(null);
    setLines(markAllFreezerTruckAcceptable());
    setLoadingDecision("APPROVED");
    setCorrectiveAction("");
  }

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (!freezerTruckNumber.trim()) {
      nextErrors.freezerTruckNumber = "Enter freezer truck number";
    }
    if (!vehicleNumber.trim()) {
      nextErrors.vehicleNumber = "Enter vehicle number";
    }
    for (const line of lines) {
      if (line.result === null) {
        nextErrors[line.itemId] = "Select Acceptable or Fail";
      }
    }
    if (!loadingDecision) {
      nextErrors.loadingDecision = "Select final loading decision";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSubmitMessage("Complete required fields before submitting.");
      return;
    }

    const payload = {
      documentCode: DOCUMENT_CODES.FREEZER_TRUCK,
      recordedAt: new Date().toISOString(),
      shift,
      freezerTruckNumber: freezerTruckNumber.trim(),
      vehicleNumber: vehicleNumber.trim(),
      lines: lines.map((line) => ({
        itemId: line.itemId,
        result: line.result as CheckItemResult,
        failureNote: line.failureNote,
      })),
      correctiveAction: correctiveAction.trim() || undefined,
      loadingDecision: loadingDecision as LoadingDecision,
    };

    const parsed = freezerTruckInspectionSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        if (issue.path[0] === "lines" && typeof issue.path[1] === "number") {
          const line = lines[issue.path[1]];
          if (line) nextErrors[line.itemId] = issue.message;
        } else if (typeof issue.path[0] === "string") {
          nextErrors[issue.path[0]] = issue.message;
        } else {
          nextErrors[key] = issue.message;
        }
      }
      setErrors(nextErrors);
      setSubmitMessage("Fix the highlighted issues, then submit again.");
      return;
    }

    setErrors({});
    clearDraft(DRAFT_KEY);
    setSubmitMessage(
      "Freezer truck inspection validated and ready for API submit (Phase 2). Draft cleared.",
    );
  }

  const hasFail = lines.some((line) => line.result === "FAIL");

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white/90 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-nelna-primary">
          {DOCUMENT_CODES.FREEZER_TRUCK}
        </p>
        <h2
          className="mt-1 text-2xl text-nelna-primary-dark"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Freezer truck before loading
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-[var(--nelna-text-muted)]">Date & time</dt>
            <dd className="font-semibold text-nelna-primary-dark">
              {recordedAt.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--nelna-text-muted)]">Shift</dt>
            <dd className="font-semibold text-nelna-primary-dark">
              {WORK_SHIFT_LABELS[shift]}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white p-4">
        <label className="grid gap-1 text-sm font-semibold">
          Freezer truck number
          <input
            value={freezerTruckNumber}
            onChange={(e) => setFreezerTruckNumber(e.target.value)}
            className="min-h-12 rounded-[10px] border-2 border-[var(--nelna-border)] px-3 text-base"
            autoComplete="off"
          />
          {errors.freezerTruckNumber ? (
            <span className="font-normal text-[var(--nelna-danger)]">
              {errors.freezerTruckNumber}
            </span>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Vehicle number
          <input
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            className="min-h-12 rounded-[10px] border-2 border-[var(--nelna-border)] px-3 text-base"
            autoComplete="off"
          />
          {errors.vehicleNumber ? (
            <span className="font-normal text-[var(--nelna-danger)]">
              {errors.vehicleNumber}
            </span>
          ) : null}
        </label>
      </section>

      <MarkAllAcceptableBar
        itemCount={FREEZER_TRUCK_CHECK_ITEMS.length}
        onMarkAll={handleMarkAll}
      />

      <section className="overflow-hidden rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white">
        <h3
          className="border-b border-[var(--nelna-border)] bg-[var(--nelna-surface-muted)] px-4 py-3 text-base font-bold text-nelna-primary-dark"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Inspection checks
        </h3>
        {FREEZER_TRUCK_CHECK_ITEMS.map((item) => {
          const line = lines.find((entry) => entry.itemId === item.id) ?? {
            itemId: item.id,
            result: null,
          };
          return (
            <ChecklistResultToggle
              key={item.id}
              itemId={item.id}
              label={item.label}
              value={line.result}
              failureNote={line.failureNote}
              error={errors[item.id]}
              onChange={(result) =>
                updateLine(item.id, {
                  result,
                  failureNote: result === "FAIL" ? line.failureNote : undefined,
                })
              }
              onFailureNoteChange={(failureNote) =>
                updateLine(item.id, { failureNote })
              }
            />
          );
        })}
      </section>

      {hasFail ? (
        <label className="grid gap-1 rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-[var(--nelna-danger-bg)] p-4 text-sm font-semibold">
          Corrective action
          <textarea
            value={correctiveAction}
            onChange={(e) => setCorrectiveAction(e.target.value)}
            rows={3}
            className="min-h-[88px] rounded-[10px] border-2 border-[var(--nelna-border)] px-3 py-2 text-base font-normal"
          />
          {errors.correctiveAction ? (
            <span className="font-normal text-[var(--nelna-danger)]">
              {errors.correctiveAction}
            </span>
          ) : null}
        </label>
      ) : null}

      <section className="rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white p-4">
        <h3 className="text-base font-bold text-nelna-primary-dark">
          Final loading decision
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(["APPROVED", "REJECTED"] as const).map((decision) => (
            <button
              key={decision}
              type="button"
              aria-pressed={loadingDecision === decision}
              onClick={() => setLoadingDecision(decision)}
              className="min-h-12 rounded-[var(--nelna-radius)] border-2 px-3 text-sm font-semibold"
              style={{
                borderColor:
                  loadingDecision === decision
                    ? decision === "APPROVED"
                      ? "var(--nelna-primary)"
                      : "var(--nelna-danger)"
                    : "var(--nelna-border)",
                background:
                  loadingDecision === decision
                    ? decision === "APPROVED"
                      ? "var(--nelna-success-bg)"
                      : "var(--nelna-danger-bg)"
                    : "white",
              }}
            >
              {LOADING_DECISION_LABELS[decision]}
            </button>
          ))}
        </div>
        {errors.loadingDecision ? (
          <p className="mt-2 text-sm text-[var(--nelna-danger)]">
            {errors.loadingDecision}
          </p>
        ) : null}
      </section>

      {submitMessage ? (
        <p
          role="status"
          className="rounded-[var(--nelna-radius)] border border-nelna-primary bg-[var(--nelna-success-bg)] px-3 py-3 text-sm text-nelna-primary-dark"
        >
          {submitMessage}
        </p>
      ) : null}

      <StickySubmitBar draftHint={formatDraftSavedAt(draftSavedAt)}>
        <NelnaButton variant="primary" fullWidth onClick={handleSubmit}>
          Submit freezer truck inspection
        </NelnaButton>
      </StickySubmitBar>
    </div>
  );
}
