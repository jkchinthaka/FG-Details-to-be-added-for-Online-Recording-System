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

/** Freezer truck inspection checkpoints — NMS/PPU/CL/30 */
export const FREEZER_TRUCK_CHECK_ITEMS = [
  { id: "cleanliness", label: "Cleanliness of freezer truck" },
  { id: "physical_condition", label: "Truck physical condition" },
  { id: "pallets", label: "Pallets" },
  { id: "floor", label: "Floor" },
  { id: "side_walls", label: "Side walls" },
  { id: "curtains", label: "Curtains" },
  { id: "door_lock", label: "Door lock" },
  { id: "insects", label: "Presence of insects or signs" },
] as const;

export type FreezerTruckCheckId =
  (typeof FREEZER_TRUCK_CHECK_ITEMS)[number]["id"];

export const LOADING_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type LoadingDecision = (typeof LOADING_DECISIONS)[number];

export const LOADING_DECISION_LABELS: Record<LoadingDecision, string> = {
  APPROVED: "Approved for loading",
  REJECTED: "Not approved for loading",
};

export const WORK_SHIFTS = ["MORNING", "AFTERNOON", "NIGHT"] as const;
export type WorkShift = (typeof WORK_SHIFTS)[number];

export const WORK_SHIFT_LABELS: Record<WorkShift, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  NIGHT: "Night",
};
