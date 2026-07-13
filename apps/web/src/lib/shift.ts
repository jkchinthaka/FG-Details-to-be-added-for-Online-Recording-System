import { WORK_SHIFTS, type WorkShift } from "@nelna/shared";

export function detectCurrentShift(now = new Date()): WorkShift {
  const hour = now.getHours();
  if (hour < 14) return "MORNING";
  if (hour < 22) return "AFTERNOON";
  return "NIGHT";
}

export function isWorkShift(value: string): value is WorkShift {
  return (WORK_SHIFTS as readonly string[]).includes(value);
}
