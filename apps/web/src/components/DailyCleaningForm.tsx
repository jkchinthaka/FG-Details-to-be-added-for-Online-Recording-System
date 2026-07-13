"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALL_CLEANING_ITEMS,
  CHANGING_ROOM_CLEANING_ITEMS,
  DOCUMENT_CODES,
  FG_CLEANING_ITEMS,
  WORK_SHIFT_LABELS,
  dailyCleaningVerificationSchema,
  markAllCleaningAcceptable,
  type CheckItemResult,
  type CleaningItemId,
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
  itemId: CleaningItemId;
  result: CheckItemResult | null;
  failureNote?: string;
  correctiveAction?: string;
};

type CleaningDraft = {
  lines: LineState[];
  savedAt: string;
};

const DRAFT_KEY = "daily-cleaning-verification";

function emptyLines(): LineState[] {
  return ALL_CLEANING_ITEMS.map((item) => ({
    itemId: item.id,
    result: null,
  }));
}

export function DailyCleaningForm() {
  const [lines, setLines] = useState<LineState[]>(emptyLines);
  const [draftSavedAt, setDraftSavedAt] = useState<string | undefined>();
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shift = useMemo(() => detectCurrentShift(), []);
  const recordedAt = useMemo(() => new Date(), []);

  useEffect(() => {
    const draft = loadDraft<CleaningDraft>(DRAFT_KEY);
    if (draft?.lines?.length) {
      setLines(draft.lines);
      setDraftSavedAt(draft.savedAt);
    }
  }, []);

  useEffect(() => {
    const savedAt = new Date().toISOString();
    saveDraft<CleaningDraft>(DRAFT_KEY, { lines, savedAt });
    setDraftSavedAt(savedAt);
  }, [lines]);

  function updateLine(itemId: CleaningItemId, patch: Partial<LineState>) {
    setSubmitMessage(null);
    setLines((prev) =>
      prev.map((line) => (line.itemId === itemId ? { ...line, ...patch } : line)),
    );
  }

  function handleMarkAll() {
    setErrors({});
    setSubmitMessage(null);
    setLines(
      markAllCleaningAcceptable().map((line) => ({
        ...line,
        failureNote: undefined,
        correctiveAction: undefined,
      })),
    );
  }

  function handleSubmit() {
    const payload = {
      documentCode: DOCUMENT_CODES.DAILY_CLEANING,
      recordedAt: new Date().toISOString(),
      shift,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        result: line.result ?? "ACCEPTABLE",
        failureNote: line.failureNote,
        correctiveAction: line.correctiveAction,
      })),
    };

    // Require every item to have an explicit result before submit
    const missing = lines.filter((line) => line.result === null);
    if (missing.length > 0) {
      const nextErrors: Record<string, string> = {};
      for (const line of missing) {
        nextErrors[line.itemId] = "Select Acceptable or Fail";
      }
      setErrors(nextErrors);
      setSubmitMessage("Complete all checklist items before submitting.");
      return;
    }

    const parsed = dailyCleaningVerificationSchema.safeParse(payload);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const itemIndex = issue.path[1];
        if (typeof itemIndex === "number" && lines[itemIndex]) {
          nextErrors[lines[itemIndex].itemId] = issue.message;
        }
      }
      setErrors(nextErrors);
      setSubmitMessage("Fix the highlighted failures, then submit again.");
      return;
    }

    setErrors({});
    clearDraft(DRAFT_KEY);
    setSubmitMessage(
      "Cleaning verification validated and ready for API submit (Phase 2). Draft cleared.",
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <RecordHeader
        title="Daily Cleaning Verification"
        documentCode={DOCUMENT_CODES.DAILY_CLEANING}
        recordedAt={recordedAt}
        shiftLabel={WORK_SHIFT_LABELS[shift]}
      />

      <MarkAllAcceptableBar
        itemCount={ALL_CLEANING_ITEMS.length}
        onMarkAll={handleMarkAll}
      />

      <ChecklistSection title="Finished Goods" items={[...FG_CLEANING_ITEMS]} lines={lines} errors={errors} onUpdate={updateLine} />
      <ChecklistSection
        title="Changing Room"
        items={[...CHANGING_ROOM_CLEANING_ITEMS]}
        lines={lines}
        errors={errors}
        onUpdate={updateLine}
      />

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
          Submit cleaning verification
        </NelnaButton>
      </StickySubmitBar>
    </div>
  );
}

function RecordHeader({
  title,
  documentCode,
  recordedAt,
  shiftLabel,
}: {
  title: string;
  documentCode: string;
  recordedAt: Date;
  shiftLabel: string;
}) {
  return (
    <section className="rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white/90 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-nelna-primary">
        {documentCode}
      </p>
      <h2
        className="mt-1 text-2xl text-nelna-primary-dark"
        style={{ fontFamily: "var(--nelna-font-display)" }}
      >
        {title}
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
          <dd className="font-semibold text-nelna-primary-dark">{shiftLabel}</dd>
        </div>
      </dl>
    </section>
  );
}

function ChecklistSection({
  title,
  items,
  lines,
  errors,
  onUpdate,
}: {
  title: string;
  items: { id: CleaningItemId; label: string }[];
  lines: LineState[];
  errors: Record<string, string>;
  onUpdate: (itemId: CleaningItemId, patch: Partial<LineState>) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white">
      <h3
        className="border-b border-[var(--nelna-border)] bg-[var(--nelna-surface-muted)] px-4 py-3 text-base font-bold text-nelna-primary-dark"
        style={{ fontFamily: "var(--nelna-font-display)" }}
      >
        {title}
      </h3>
      {items.map((item) => {
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
            correctiveAction={line.correctiveAction}
            showCorrectiveAction
            error={errors[item.id]}
            onChange={(result) =>
              onUpdate(item.id, {
                result,
                failureNote: result === "FAIL" ? line.failureNote : undefined,
                correctiveAction:
                  result === "FAIL" ? line.correctiveAction : undefined,
              })
            }
            onFailureNoteChange={(failureNote) =>
              onUpdate(item.id, { failureNote })
            }
            onCorrectiveActionChange={(correctiveAction) =>
              onUpdate(item.id, { correctiveAction })
            }
          />
        );
      })}
    </section>
  );
}
