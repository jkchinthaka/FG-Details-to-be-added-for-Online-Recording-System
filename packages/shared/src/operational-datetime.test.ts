import { describe, expect, it } from "vitest";
import {
  colomboDateOnly,
  colomboHour,
  colomboTimeHm,
  dateOnlyToUtcMidnight,
  monthLabelFromDateOnly,
  NELNA_TIME_ZONE,
  utcDateToDateOnly,
} from "./operational-datetime";

describe("operational-datetime (Asia/Colombo)", () => {
  it("uses Asia/Colombo as the operational zone", () => {
    expect(NELNA_TIME_ZONE).toBe("Asia/Colombo");
  });

  it("formats a known UTC Instant into Colombo date and time", () => {
    // 2026-07-13T20:30:00Z → 2026-07-14 02:00 in Colombo
    const instant = new Date("2026-07-13T20:30:00.000Z");
    expect(colomboDateOnly(instant)).toBe("2026-07-14");
    expect(colomboTimeHm(instant)).toBe("02:00");
    expect(colomboHour(instant)).toBe(2);
  });

  it("derives month labels from date-only strings", () => {
    expect(monthLabelFromDateOnly("2026-07-14")).toMatch(/July/i);
    expect(monthLabelFromDateOnly("2026-01-05")).toMatch(/January/i);
  });

  it("round-trips date-only via UTC midnight Date storage", () => {
    const stored = dateOnlyToUtcMidnight("2026-07-14");
    expect(utcDateToDateOnly(stored)).toBe("2026-07-14");
  });
});
