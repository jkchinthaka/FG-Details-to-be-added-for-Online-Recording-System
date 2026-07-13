import { describe, expect, it } from "vitest";
import {
  dailyCleaningVerificationSchema,
  freezerTruckInspectionSchema,
  markAllCleaningAcceptable,
  markAllFreezerTruckAcceptable,
} from "./schemas";

describe("markAllCleaningAcceptable", () => {
  it("produces a valid daily cleaning payload when stamped with metadata", () => {
    const payload = {
      documentCode: "NMS/PPU/CL/24" as const,
      recordedAt: new Date().toISOString(),
      shift: "MORNING" as const,
      lines: markAllCleaningAcceptable(),
    };

    const result = dailyCleaningVerificationSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects a failed line without a failure note", () => {
    const lines = markAllCleaningAcceptable();
    lines[0] = { itemId: "fg_wall", result: "FAIL" };

    const result = dailyCleaningVerificationSchema.safeParse({
      documentCode: "NMS/PPU/CL/24",
      recordedAt: new Date().toISOString(),
      shift: "MORNING",
      lines,
    });

    expect(result.success).toBe(false);
  });
});

describe("freezerTruckInspectionSchema", () => {
  it("accepts all-acceptable trucks approved for loading", () => {
    const result = freezerTruckInspectionSchema.safeParse({
      documentCode: "NMS/PPU/CL/30",
      recordedAt: new Date().toISOString(),
      shift: "AFTERNOON",
      freezerTruckNumber: "FT-12",
      vehicleNumber: "WP CAB-1234",
      lines: markAllFreezerTruckAcceptable(),
      loadingDecision: "APPROVED",
    });

    expect(result.success).toBe(true);
  });

  it("blocks loading approval when any check fails", () => {
    const lines = markAllFreezerTruckAcceptable();
    lines[0] = {
      itemId: "cleanliness",
      result: "FAIL",
      failureNote: "Residue on floor",
    };

    const result = freezerTruckInspectionSchema.safeParse({
      documentCode: "NMS/PPU/CL/30",
      recordedAt: new Date().toISOString(),
      shift: "AFTERNOON",
      freezerTruckNumber: "FT-12",
      vehicleNumber: "WP CAB-1234",
      lines,
      correctiveAction: "Reclean before loading",
      loadingDecision: "APPROVED",
    });

    expect(result.success).toBe(false);
  });
});
