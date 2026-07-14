/** Offline submission queue states for Nelna FG records. */
export const OFFLINE_QUEUE_STATES = [
  "SAVED_ON_DEVICE",
  "WAITING_TO_SYNC",
  "SYNCING",
  "SYNCED",
  "SYNC_FAILED",
  "CONFLICT_REQUIRES_REVIEW",
] as const;

export type OfflineQueueState = (typeof OFFLINE_QUEUE_STATES)[number];

export const OFFLINE_CONFLICT_REASONS = [
  "SERVER_RECORD_ALREADY_SUBMITTED",
  "RECORD_ALREADY_CHECKED",
  "RECORD_ALREADY_VERIFIED",
  "TEMPLATE_VERSION_CHANGED",
  "USER_PERMISSION_CHANGED",
  "RECORD_DATE_OR_TASK_INVALID",
  "NEWER_SERVER_VERSION",
] as const;

export type OfflineConflictReason = (typeof OFFLINE_CONFLICT_REASONS)[number];

export type OfflineQueueRecordType = "DAILY_CLEANING" | "FREEZER_TRUCK" | "CORRECTIVE_ACTION_DRAFT";

export const OFFLINE_QUEUE_MAX_ENTRIES = 40;
export const OFFLINE_RETRY_BASE_MS = 2_000;
export const OFFLINE_RETRY_MAX_MS = 60_000;

export function nextRetryDelayMs(attempt: number): number {
  const exp = Math.min(OFFLINE_RETRY_MAX_MS, OFFLINE_RETRY_BASE_MS * 2 ** Math.max(0, attempt));
  return exp;
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Never treat offline-only storage as a successful server submission. */
export function isServerSubmissionSuccess(state: OfflineQueueState): boolean {
  return state === "SYNCED";
}
