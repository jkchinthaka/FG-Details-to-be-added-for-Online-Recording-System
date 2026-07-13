import type { RecordType, TaskStatus, WorkShift } from "@nelna/shared";
import { RECORD_TYPE_META, WORK_SHIFT_LABELS } from "@nelna/shared";

export type TodayTask = {
  id: string;
  recordType: RecordType;
  status: TaskStatus;
  shift: WorkShift;
  areaLabel: string;
  href: string;
};

/**
 * Phase 1 local task board — represents assigned FG work for the current shift.
 * Persisted assignment API arrives in a later phase; structure matches shared domain types.
 */
export function getTodaysTasks(now = new Date()): TodayTask[] {
  const hour = now.getHours();
  const shift: WorkShift =
    hour < 14 ? "MORNING" : hour < 22 ? "AFTERNOON" : "NIGHT";

  return [
    {
      id: "task-cleaning-today",
      recordType: "DAILY_CLEANING_VERIFICATION",
      status: "ASSIGNED",
      shift,
      areaLabel: "Finished Goods + Changing Room",
      href: "/records/cleaning",
    },
    {
      id: "task-freezer-truck-today",
      recordType: "FREEZER_TRUCK_INSPECTION",
      status: "ASSIGNED",
      shift,
      areaLabel: "Dispatch bay",
      href: "/records/freezer-truck",
    },
  ];
}

export function formatTaskSubtitle(task: TodayTask): string {
  const meta = RECORD_TYPE_META[task.recordType];
  return `${meta.documentCode} · ${WORK_SHIFT_LABELS[task.shift]}`;
}
