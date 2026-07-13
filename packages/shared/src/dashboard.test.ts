import { describe, expect, it } from "vitest";
import {
  actionForOwnTaskStatus,
  bucketForOwnTaskStatus,
  computeDashboardSummary,
  hrefForRecordType,
  type TaskCard,
} from "./dashboard";
import { detectWorkShiftForHour } from "./records";

function makeCard(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Daily Cleaning Verification",
    subtitle: overrides.subtitle ?? "NMS/PPU/CL/24 · Morning",
    documentCode: overrides.documentCode ?? "NMS/PPU/CL/24",
    recordType: overrides.recordType ?? "DAILY_CLEANING_VERIFICATION",
    areaLabel: overrides.areaLabel ?? "Finished Goods",
    shiftLabel: overrides.shiftLabel ?? "Morning",
    status: overrides.status ?? "ASSIGNED",
    bucket: overrides.bucket ?? "pending",
    action: overrides.action ?? "START",
    href: overrides.href ?? "/records/cleaning",
  };
}

describe("bucketForOwnTaskStatus", () => {
  it("buckets ASSIGNED and IN_PROGRESS as pending", () => {
    expect(bucketForOwnTaskStatus("ASSIGNED")).toBe("pending");
    expect(bucketForOwnTaskStatus("IN_PROGRESS")).toBe("pending");
  });

  it("buckets REJECTED as attention", () => {
    expect(bucketForOwnTaskStatus("REJECTED")).toBe("attention");
  });

  it("buckets SUBMITTED and VERIFIED as completed", () => {
    expect(bucketForOwnTaskStatus("SUBMITTED")).toBe("completed");
    expect(bucketForOwnTaskStatus("VERIFIED")).toBe("completed");
  });
});

describe("actionForOwnTaskStatus", () => {
  it("maps every status to its single next action", () => {
    expect(actionForOwnTaskStatus("ASSIGNED")).toBe("START");
    expect(actionForOwnTaskStatus("IN_PROGRESS")).toBe("CONTINUE");
    expect(actionForOwnTaskStatus("REJECTED")).toBe("CONTINUE");
    expect(actionForOwnTaskStatus("SUBMITTED")).toBe("REVIEW");
    expect(actionForOwnTaskStatus("VERIFIED")).toBe("COMPLETED");
  });
});

describe("hrefForRecordType", () => {
  it("routes cleaning and freezer-truck tasks to their dedicated forms", () => {
    expect(hrefForRecordType("DAILY_CLEANING_VERIFICATION")).toBe("/records/cleaning");
    expect(hrefForRecordType("FREEZER_TRUCK_INSPECTION")).toBe("/records/freezer-truck");
  });

  it("falls back to the records list for an unknown/null record type", () => {
    expect(hrefForRecordType(null)).toBe("/records");
  });
});

describe("computeDashboardSummary", () => {
  it("returns all zeros (and no divide-by-zero) for an empty task list", () => {
    expect(computeDashboardSummary([])).toEqual({
      completed: 0,
      pending: 0,
      attentionRequired: 0,
      totalCount: 0,
      completionPercent: 0,
    });
  });

  it("tallies each bucket independently", () => {
    const cards = [
      makeCard({ id: "1", bucket: "completed" }),
      makeCard({ id: "2", bucket: "completed" }),
      makeCard({ id: "3", bucket: "pending" }),
      makeCard({ id: "4", bucket: "attention" }),
    ];

    expect(computeDashboardSummary(cards)).toEqual({
      completed: 2,
      pending: 1,
      attentionRequired: 1,
      totalCount: 4,
      completionPercent: 50,
    });
  });

  it("rounds the completion percentage", () => {
    const cards = [
      makeCard({ id: "1", bucket: "completed" }),
      makeCard({ id: "2", bucket: "pending" }),
      makeCard({ id: "3", bucket: "pending" }),
    ];

    expect(computeDashboardSummary(cards).completionPercent).toBe(33);
  });
});

describe("detectWorkShiftForHour", () => {
  it("returns MORNING before 14:00", () => {
    expect(detectWorkShiftForHour(6)).toBe("MORNING");
    expect(detectWorkShiftForHour(13)).toBe("MORNING");
  });

  it("returns AFTERNOON from 14:00 up to (not including) 22:00", () => {
    expect(detectWorkShiftForHour(14)).toBe("AFTERNOON");
    expect(detectWorkShiftForHour(21)).toBe("AFTERNOON");
  });

  it("returns NIGHT from 22:00 onward", () => {
    expect(detectWorkShiftForHour(22)).toBe("NIGHT");
    expect(detectWorkShiftForHour(23)).toBe("NIGHT");
  });
});
