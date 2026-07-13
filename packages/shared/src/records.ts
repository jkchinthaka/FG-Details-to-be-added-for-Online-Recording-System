/** Document codes and checklist definitions for Nelna factory records */

export const DOCUMENT_CODES = {
  DAILY_CLEANING: "NMS/PPU/CL/24",
  FREEZER_TRUCK: "NMS/PPU/CL/30",
} as const;

export type DocumentCode = (typeof DOCUMENT_CODES)[keyof typeof DOCUMENT_CODES];

export const RECORD_TYPES = [
  "DAILY_CLEANING_VERIFICATION",
  "FREEZER_TRUCK_INSPECTION",
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export const RECORD_TYPE_META: Record<
  RecordType,
  { title: string; documentCode: DocumentCode; shortLabel: string }
> = {
  DAILY_CLEANING_VERIFICATION: {
    title: "Daily Cleaning Verification",
    documentCode: DOCUMENT_CODES.DAILY_CLEANING,
    shortLabel: "Cleaning",
  },
  FREEZER_TRUCK_INSPECTION: {
    title: "Inspection of Freezer Truck Before Loading",
    documentCode: DOCUMENT_CODES.FREEZER_TRUCK,
    shortLabel: "Freezer Truck",
  },
};

/** Reverse lookup of `RECORD_TYPE_META` — the routing/display join key
 *  between a document code (as stored on a TaskAssignment/InspectionRecord)
 *  and the record type the mobile forms and dashboard know how to render. */
export function recordTypeForDocumentCode(documentCode: string): RecordType | null {
  const match = RECORD_TYPES.find(
    (recordType) => RECORD_TYPE_META[recordType].documentCode === documentCode,
  );
  return match ?? null;
}

export const CHECK_ITEM_RESULTS = ["ACCEPTABLE", "FAIL"] as const;
export type CheckItemResult = (typeof CHECK_ITEM_RESULTS)[number];

export const TASK_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  VERIFIED: "Verified",
  REJECTED: "Needs correction",
};

/** Mirrors the Prisma `RecordStatus` enum (apps/api/prisma/schema.prisma). */
export const RECORD_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "CHECKED",
  "VERIFIED",
  "REJECTED",
  "ARCHIVED",
] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CHECKED: "Checked",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

/** Detects the current work shift for a given hour of day (0–23), local time.
 *  Shared by the seed script and any server-side "today's tasks" defaults so
 *  the shift boundaries never drift between the two. */
export function detectWorkShiftForHour(hour: number): WorkShift {
  if (hour < 14) return "MORNING";
  if (hour < 22) return "AFTERNOON";
  return "NIGHT";
}

/** Finished Goods area checklist — NMS/PPU/CL/24 */
export const FG_CLEANING_ITEMS = [
  { id: "fg_wall", label: "Wall", area: "FINISHED_GOODS" },
  { id: "fg_floor", label: "Floor", area: "FINISHED_GOODS" },
  { id: "fg_drainage", label: "Drainage Line", area: "FINISHED_GOODS" },
  { id: "fg_foot_bath", label: "Foot Bath", area: "FINISHED_GOODS" },
  { id: "fg_weighing_1", label: "Weighing Machine 1", area: "FINISHED_GOODS" },
  { id: "fg_weighing_2", label: "Weighing Machine 2", area: "FINISHED_GOODS" },
  { id: "fg_cold_room_1", label: "Cold Room 1", area: "FINISHED_GOODS" },
  { id: "fg_cold_room_2", label: "Cold Room 2", area: "FINISHED_GOODS" },
] as const;

/** Changing Room checklist — NMS/PPU/CL/24 */
export const CHANGING_ROOM_CLEANING_ITEMS = [
  { id: "cr_wall", label: "Wall", area: "CHANGING_ROOM" },
  { id: "cr_floor", label: "Floor", area: "CHANGING_ROOM" },
  { id: "cr_locker", label: "Locker", area: "CHANGING_ROOM" },
] as const;

export const ALL_CLEANING_ITEMS = [
  ...FG_CLEANING_ITEMS,
  ...CHANGING_ROOM_CLEANING_ITEMS,
] as const;

export type CleaningItemId = (typeof ALL_CLEANING_ITEMS)[number]["id"];

/** Freezer truck pre-loading inspection areas — NMS/PPU/CL/30 */
export const FREEZER_TRUCK_CHECK_ITEMS = [
  { id: "overall_cleanliness", label: "Overall cleanliness" },
  { id: "pallet", label: "Pallet" },
  { id: "floor", label: "Floor" },
  { id: "side_wall", label: "Side wall" },
  { id: "curtain", label: "Curtain" },
  { id: "door", label: "Door" },
  { id: "door_lock", label: "Door lock" },
  { id: "sealing", label: "Sealing" },
  { id: "freezer_unit_operational", label: "Freezer unit operational" },
  { id: "insects_presence", label: "Presence of insects" },
  { id: "insect_signs", label: "Signs of insects" },
  { id: "bad_smell", label: "Bad smell" },
  { id: "contamination_evidence", label: "Evidence of contamination" },
] as const;

export type FreezerTruckCheckId =
  (typeof FREEZER_TRUCK_CHECK_ITEMS)[number]["id"];

/**
 * Final freezer-truck-before-loading decision vocabulary (mirrors the
 * Prisma `LoadingDecisionStatus` enum). `PENDING` only applies before an
 * operator has submitted the inspection; every other value is either the
 * system-computed recommendation or the supervisor/QA final decision — see
 * `computeRecommendedLoadingDecision` and docs/records.md.
 */
export const LOADING_DECISIONS = [
  "PENDING",
  "APPROVED_FOR_LOADING",
  "CONDITIONALLY_APPROVED",
  "LOADING_BLOCKED",
  "REJECTED",
] as const;
export type LoadingDecision = (typeof LOADING_DECISIONS)[number];

/** The subset of `LOADING_DECISIONS` a supervisor/QA may record as the
 *  *final* decision — `PENDING` is never a valid final decision. */
export const FINAL_LOADING_DECISIONS = [
  "APPROVED_FOR_LOADING",
  "CONDITIONALLY_APPROVED",
  "LOADING_BLOCKED",
  "REJECTED",
] as const;
export type FinalLoadingDecision = (typeof FINAL_LOADING_DECISIONS)[number];

export const LOADING_DECISION_LABELS: Record<LoadingDecision, string> = {
  PENDING: "Pending decision",
  APPROVED_FOR_LOADING: "Approved for loading",
  CONDITIONALLY_APPROVED: "Conditionally approved",
  LOADING_BLOCKED: "Loading temporarily blocked",
  REJECTED: "Rejected",
};

/** Compact tone for badges/status chips, mirroring `RECORD_STATUS_LABELS`'s
 *  sibling usage across the dashboard/detail views. */
export const LOADING_DECISION_TONES: Record<LoadingDecision, "neutral" | "success" | "warning" | "danger"> = {
  PENDING: "neutral",
  APPROVED_FOR_LOADING: "success",
  CONDITIONALLY_APPROVED: "warning",
  LOADING_BLOCKED: "danger",
  REJECTED: "danger",
};

export const WORK_SHIFTS = ["MORNING", "AFTERNOON", "NIGHT"] as const;
export type WorkShift = (typeof WORK_SHIFTS)[number];

export const WORK_SHIFT_LABELS: Record<WorkShift, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  NIGHT: "Night",
};
