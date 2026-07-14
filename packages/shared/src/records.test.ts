import { describe, expect, it } from "vitest";
import {
  RECORD_STATUSES,
  RECORD_STATUS_LABELS,
  RECORD_TYPE_META,
  RECORD_TYPES,
  recordTypeForDocumentCode,
} from "./records";

describe("recordTypeForDocumentCode", () => {
  it("resolves the daily cleaning and freezer truck document codes", () => {
    expect(recordTypeForDocumentCode("NMS/PPU/CL/24")).toBe(
      "DAILY_CLEANING_VERIFICATION",
    );
    expect(recordTypeForDocumentCode("NMS/PPU/CL/30")).toBe("FREEZER_TRUCK_INSPECTION");
  });

  it("returns null for an unrecognised document code", () => {
    expect(recordTypeForDocumentCode("NOT/A/CODE")).toBeNull();
  });

  it("round-trips every declared record type's own document code", () => {
    for (const recordType of RECORD_TYPES) {
      expect(recordTypeForDocumentCode(RECORD_TYPE_META[recordType].documentCode)).toBe(
        recordType,
      );
    }
  });
});

describe("RECORD_STATUS_LABELS", () => {
  it("has a label for every declared record status", () => {
    for (const status of RECORD_STATUSES) {
      expect(RECORD_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});
