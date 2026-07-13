import type { BadgeTone } from "@nelna/ui";
import type { TaskCardBucket } from "@nelna/shared";

/** Time-of-day greeting for the dashboard header — pure so it's trivially unit-testable. */
export function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Long-form current date for the dashboard header, e.g. "Tuesday, 14 July 2026". */
export function formatDashboardDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Maps a task card's summary bucket to the `Badge`/accent tone used to render it. */
export function toneForTaskCardBucket(bucket: TaskCardBucket): BadgeTone {
  switch (bucket) {
    case "completed":
      return "success";
    case "attention":
      return "danger";
    case "pending":
    default:
      return "gold";
  }
}
