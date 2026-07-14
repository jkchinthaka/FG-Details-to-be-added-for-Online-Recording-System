/**
 * Operational calendar helpers for Nelna FG plant recording.
 * Factory operations follow Sri Lanka Standard Time (Asia/Colombo, UTC+05:30).
 * Date-of-record and inspection time must not silently drift to browser UTC.
 */
export const NELNA_TIME_ZONE = "Asia/Colombo" as const;

const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Returns YYYY-MM-DD for `instant` in Asia/Colombo. */
export function colomboDateOnly(instant: Date = new Date()): string {
  const shifted = new Date(instant.getTime() + COLOMBO_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** Returns HH:mm (24h) for `instant` in Asia/Colombo. */
export function colomboTimeHm(instant: Date = new Date()): string {
  const shifted = new Date(instant.getTime() + COLOMBO_OFFSET_MS);
  const hours = shifted.getUTCHours().toString().padStart(2, "0");
  const minutes = shifted.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Calendar month label for a YYYY-MM-DD operational date (English, Sri Lanka locale). */
export function monthLabelFromDateOnly(dateOnly: string): string {
  const [year, month] = dateOnly.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid operational date: ${dateOnly}`);
  }
  // Use noon UTC so DST-free Colombo month labels stay correct for the date string.
  const anchor = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  return new Intl.DateTimeFormat("en-LK", {
    month: "long",
    year: "numeric",
    timeZone: NELNA_TIME_ZONE,
  }).format(anchor);
}

/** Store YYYY-MM-DD as a UTC midnight Date for Prisma `@db.Date` columns. */
export function dateOnlyToUtcMidnight(dateOnly: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new Error(`Invalid date-only value: ${dateOnly}`);
  }
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/** Extract YYYY-MM-DD from a Prisma `@db.Date` / Date value. */
export function utcDateToDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Hour 0–23 in Asia/Colombo for shift detection. */
export function colomboHour(instant: Date = new Date()): number {
  const shifted = new Date(instant.getTime() + COLOMBO_OFFSET_MS);
  return shifted.getUTCHours();
}
