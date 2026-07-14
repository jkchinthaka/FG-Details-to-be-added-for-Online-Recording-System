import { describe, expect, it } from "vitest";
import {
  assertAllSourceFieldsCovered,
  correctionConceptsAreDistinct,
  coverageSummary,
  REQUIREMENT_FIELD_COVERAGE,
} from "./requirement-coverage";

describe("requirement field coverage", () => {
  it("classifies every registered source field", () => {
    expect(() => assertAllSourceFieldsCovered()).not.toThrow();
    expect(REQUIREMENT_FIELD_COVERAGE.length).toBeGreaterThan(20);
  });

  it("covers both reference document codes", () => {
    const codes = new Set(REQUIREMENT_FIELD_COVERAGE.map((row) => row.documentCode));
    expect(codes.has("NMS/PPU/CL/24")).toBe(true);
    expect(codes.has("NMS/PPU/CL/30")).toBe(true);
  });

  it("keeps Correction and Corrective Action as distinct concepts", () => {
    expect(correctionConceptsAreDistinct()).toBe(true);
  });

  it("does not leave any field without a status", () => {
    const summary = coverageSummary();
    expect(summary.implemented + summary.partial + summary.deferred + summary.na).toBe(
      REQUIREMENT_FIELD_COVERAGE.length,
    );
  });

  it("marks Checked By / Verified By as deferred rather than silently claiming done", () => {
    const deferredActors = REQUIREMENT_FIELD_COVERAGE.filter((row) =>
      ["Checked By", "Verified By"].includes(row.sourceField),
    );
    expect(deferredActors.length).toBeGreaterThanOrEqual(2);
    expect(deferredActors.every((row) => row.status === "deferred")).toBe(true);
  });

  it("implements CL/30 Final Loading Decision and Time", () => {
    const decision = REQUIREMENT_FIELD_COVERAGE.find(
      (row) =>
        row.documentCode === "NMS/PPU/CL/30" &&
        row.sourceField === "Final Loading Decision",
    );
    const time = REQUIREMENT_FIELD_COVERAGE.find(
      (row) => row.documentCode === "NMS/PPU/CL/30" && row.sourceField === "Time",
    );
    expect(decision?.status).toBe("implemented");
    expect(time?.status).toBe("implemented");
  });
});
