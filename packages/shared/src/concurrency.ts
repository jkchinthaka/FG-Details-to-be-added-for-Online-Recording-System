/**
 * Pure helpers for atomic workflow claims and draft deduplication payloads.
 * Key-building / reuse policy live in draft-deduplication-strategy.ts.
 */

export type StaleStatePayload = {
  code: "STALE_STATE";
  message: string;
  /** Clients must refresh expected version/status; blind retry is unsafe. */
  retryable: false;
};

export function staleStatePayload(
  message = "This record was changed by someone else. Refresh and try again.",
): StaleStatePayload {
  return { code: "STALE_STATE", message, retryable: false };
}

export type DuplicateRecordPayload = {
  code: "DUPLICATE_RECORD";
  message: string;
};

export function duplicateRecordPayload(message: string): DuplicateRecordPayload {
  return { code: "DUPLICATE_RECORD", message };
}

export {
  ACTIVE_DRAFT_DEDUP_STATUSES,
  buildDraftDeduplicationKey,
  buildOperationalDraftDeduplicationKey,
  normalizeDedupSegment,
  resolveDraftDuplicateUnderPolicy,
  shouldRetainDraftDeduplicationKey,
  statusesRetainingDraftDeduplicationKey,
  TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY,
  type DraftReusePolicy,
  type DraftDuplicateResolution,
  type ExistingDraftRecordCheck,
} from "./draft-deduplication-strategy";

/**
 * Workflow cycle for approval uniqueness (recordId + approvalType + cycle).
 * Uses the post-claim workflowVersion so each accepted transition gets a
 * distinct slot. HUMAN_DECISION_REQUIRED for business meaning of "cycle"
 * beyond technical uniqueness.
 */
export function workflowCycleFromVersion(workflowVersion: number): number {
  return Math.max(1, workflowVersion);
}
