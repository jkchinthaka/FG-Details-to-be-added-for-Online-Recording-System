/**
 * Pure helpers for P0 atomic workflow claims and draft deduplication keys.
 * No I/O — safe for unit tests without MongoDB.
 */

export type StaleStatePayload = {
  code: "STALE_STATE";
  message: string;
};

export function staleStatePayload(
  message = "This record was changed by someone else. Refresh and try again.",
): StaleStatePayload {
  return { code: "STALE_STATE", message };
}

export type DuplicateRecordPayload = {
  code: "DUPLICATE_RECORD";
  message: string;
};

export function duplicateRecordPayload(message: string): DuplicateRecordPayload {
  return { code: "DUPLICATE_RECORD", message };
}

/** Normalize a business key segment for deterministic draft deduplication. */
export function normalizeDedupSegment(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/**
 * Canonical draft deduplication key.
 * Format: DOC|YYYY-MM-DD|SHIFT|AREA|VEHICLE
 * VEHICLE is empty for cleaning records.
 *
 * HUMAN_DECISION_REQUIRED: whether REJECTED/ARCHIVED records keep or clear this
 * key (affects whether a new draft may be opened for the same scope). Technical
 * default: keys apply only while status is DRAFT or RETURNED_FOR_CORRECTION.
 */
export function buildDraftDeduplicationKey(input: {
  documentCode: string;
  recordDateIso: string;
  shiftCode: string | null | undefined;
  areaLabel: string | null | undefined;
  vehicleNumber?: string | null | undefined;
}): string {
  const date = input.recordDateIso.slice(0, 10);
  return [
    normalizeDedupSegment(input.documentCode),
    date,
    normalizeDedupSegment(input.shiftCode),
    normalizeDedupSegment(input.areaLabel),
    normalizeDedupSegment(input.vehicleNumber),
  ].join("|");
}

/** Statuses that retain an active draft deduplication key. */
export const ACTIVE_DRAFT_DEDUP_STATUSES = [
  "DRAFT",
  "RETURNED_FOR_CORRECTION",
] as const;

export function shouldRetainDraftDeduplicationKey(status: string): boolean {
  return (ACTIVE_DRAFT_DEDUP_STATUSES as readonly string[]).includes(status);
}

/**
 * Workflow cycle for approval uniqueness (recordId + approvalType + cycle).
 * Uses the post-claim workflowVersion so each accepted transition gets a
 * distinct slot. HUMAN_DECISION_REQUIRED for business meaning of "cycle"
 * beyond technical uniqueness.
 */
export function workflowCycleFromVersion(workflowVersion: number): number {
  return Math.max(1, workflowVersion);
}
