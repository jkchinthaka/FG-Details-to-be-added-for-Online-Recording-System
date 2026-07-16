/**
 * FG-DB-001 — Named draft deduplication strategy.
 *
 * Isolates how operational draft uniqueness keys are built and which record
 * statuses retain those keys. Unsettled business choices are marked
 * HUMAN_DECISION_REQUIRED; technical defaults below are interim safety choices.
 */

import type { RecordStatus } from "./records";

/** Normalize a business key segment for deterministic draft deduplication. */
export function normalizeDedupSegment(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * HUMAN_DECISION_REQUIRED — approval needed before treating these as Nelna policy.
 *
 * Technical defaults (interim):
 * - whenArchived: allow_new_draft (key cleared; a new draft may occupy the scope)
 * - whenRejected: resume (own rejected record is resumed; key retained so the
 *   unique index continues to block a second draft for the same scope)
 */
export type DraftReusePolicy = {
  whenArchived: "allow_new_draft" | "conflict";
  whenRejected: "resume" | "allow_new_draft" | "conflict";
};

export const TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY: DraftReusePolicy = {
  whenArchived: "allow_new_draft",
  whenRejected: "resume",
};

/**
 * Canonical draft deduplication key strategy (FG-DB-001).
 *
 * Cleaning candidate scope (technical):
 *   documentCode + date + shift + area/location (+ empty vehicle)
 *
 * Truck candidate scope (technical):
 *   documentCode + date + shift + area + vehicleNumber
 *
 * Format: DOC|YYYY-MM-DD|SHIFT|AREA|VEHICLE
 *
 * HUMAN_DECISION_REQUIRED: whether load-context / inspection-type / workflow
 * cycle must be additional key segments beyond the technical format above.
 */
export function buildOperationalDraftDeduplicationKey(input: {
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

/** @deprecated Prefer buildOperationalDraftDeduplicationKey — same technical key. */
export const buildDraftDeduplicationKey = buildOperationalDraftDeduplicationKey;

export function statusesRetainingDraftDeduplicationKey(
  policy: DraftReusePolicy = TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY,
): readonly string[] {
  const statuses: string[] = ["DRAFT", "RETURNED_FOR_CORRECTION"];
  if (policy.whenRejected === "resume" || policy.whenRejected === "conflict") {
    statuses.push("REJECTED");
  }
  if (policy.whenArchived === "conflict") {
    statuses.push("ARCHIVED");
  }
  return statuses;
}

export function shouldRetainDraftDeduplicationKey(
  status: string,
  policy: DraftReusePolicy = TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY,
): boolean {
  return statusesRetainingDraftDeduplicationKey(policy).includes(status);
}

/** @deprecated Use statusesRetainingDraftDeduplicationKey(policy). */
export const ACTIVE_DRAFT_DEDUP_STATUSES = [
  "DRAFT",
  "RETURNED_FOR_CORRECTION",
  "REJECTED",
] as const;

/** Statuses that block a second concurrent operational record for the same scope. */
const ACTIVE_BLOCKING_STATUSES: readonly RecordStatus[] = [
  "SUBMITTED",
  "PENDING_CHECK",
  "CHECKED",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "COMPLETED",
  "RESUBMITTED",
];

export type ExistingDraftRecordCheck = {
  id: string;
  status: RecordStatus;
  createdById: string;
};

export type DraftDuplicateResolution =
  | { outcome: "create" }
  | { outcome: "resume"; recordId: string }
  | { outcome: "conflict"; reason: string };

/**
 * Duplicate-prevention decision for create/resume draft.
 * Uses an explicit DraftReusePolicy for ARCHIVED / REJECTED — do not invent
 * additional outcomes without HUMAN_DECISION_REQUIRED approval.
 */
export function resolveDraftDuplicateUnderPolicy(
  existing: ExistingDraftRecordCheck | null,
  requesterId: string,
  policy: DraftReusePolicy = TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY,
): DraftDuplicateResolution {
  if (!existing) {
    return { outcome: "create" };
  }

  if (existing.status === "ARCHIVED") {
    if (policy.whenArchived === "conflict") {
      return {
        outcome: "conflict",
        reason:
          "An archived record already exists for this operational scope (policy: conflict).",
      };
    }
    return { outcome: "create" };
  }

  if (existing.status === "REJECTED") {
    if (policy.whenRejected === "allow_new_draft") {
      return { outcome: "create" };
    }
    if (policy.whenRejected === "conflict") {
      return {
        outcome: "conflict",
        reason:
          "A rejected record already exists for this operational scope (policy: conflict).",
      };
    }
    if (existing.createdById !== requesterId) {
      return {
        outcome: "conflict",
        reason:
          "Another operator already has an active record for this date, shift and area.",
      };
    }
    return { outcome: "resume", recordId: existing.id };
  }

  if ((ACTIVE_BLOCKING_STATUSES as readonly string[]).includes(existing.status)) {
    return {
      outcome: "conflict",
      reason: `A record for this date, shift and area is already ${existing.status.toLowerCase()}.`,
    };
  }

  if (existing.createdById !== requesterId) {
    return {
      outcome: "conflict",
      reason:
        "Another operator already has an active record for this date, shift and area.",
    };
  }

  return { outcome: "resume", recordId: existing.id };
}
