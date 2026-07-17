import { describe, expect, it } from "vitest";
import {
  TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY,
  buildOperationalDraftDeduplicationKey,
  normalizeDedupSegment,
  resolveDraftDuplicateUnderPolicy,
  shouldRetainDraftDeduplicationKey,
  statusesRetainingDraftDeduplicationKey,
  type DraftReusePolicy,
} from "./draft-deduplication-strategy";

describe("draft deduplication strategy (FG-DB-001)", () => {
  it("builds deterministic keys and normalizes whitespace/case", () => {
    const a = buildOperationalDraftDeduplicationKey({
      documentCode: "nms/ppu/cl/24",
      recordDateIso: "2026-07-16T00:00:00.000Z",
      shiftCode: " day ",
      areaLabel: "Loading  Bay",
    });
    const b = buildOperationalDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/24",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: "LOADING BAY",
    });
    expect(a).toBe(b);
    expect(normalizeDedupSegment("  ab  c ")).toBe("AB C");
  });

  it("includes vehicle for truck scope and leaves it empty for cleaning", () => {
    const cleaning = buildOperationalDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/24",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: "AREA",
    });
    const truck = buildOperationalDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/30",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: "AREA",
      vehicleNumber: "WP-CA-1234",
    });
    expect(cleaning.endsWith("|")).toBe(true);
    expect(truck).toContain("WP-CA-1234");
    expect(cleaning).not.toBe(truck);
  });

  it("differentiates date, shift, area, and vehicle", () => {
    const base = {
      documentCode: "NMS/PPU/CL/30",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: "BAY",
      vehicleNumber: "V1",
    };
    expect(
      buildOperationalDraftDeduplicationKey({ ...base, recordDateIso: "2026-07-17" }),
    ).not.toBe(buildOperationalDraftDeduplicationKey(base));
    expect(
      buildOperationalDraftDeduplicationKey({ ...base, shiftCode: "NIGHT" }),
    ).not.toBe(buildOperationalDraftDeduplicationKey(base));
    expect(
      buildOperationalDraftDeduplicationKey({ ...base, areaLabel: "OTHER" }),
    ).not.toBe(buildOperationalDraftDeduplicationKey(base));
    expect(
      buildOperationalDraftDeduplicationKey({ ...base, vehicleNumber: "V2" }),
    ).not.toBe(buildOperationalDraftDeduplicationKey(base));
  });

  it("technical default retains REJECTED keys and clears ARCHIVED", () => {
    expect(shouldRetainDraftDeduplicationKey("DRAFT")).toBe(true);
    expect(shouldRetainDraftDeduplicationKey("REJECTED")).toBe(true);
    expect(shouldRetainDraftDeduplicationKey("ARCHIVED")).toBe(false);
    expect(statusesRetainingDraftDeduplicationKey()).toContain("REJECTED");
  });

  it("archived policy allow_new_draft vs conflict", () => {
    const row = { id: "r1", status: "ARCHIVED" as const, createdById: "u1" };
    expect(resolveDraftDuplicateUnderPolicy(row, "u1").outcome).toBe("create");
    const conflictPolicy: DraftReusePolicy = {
      ...TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY,
      whenArchived: "conflict",
    };
    expect(resolveDraftDuplicateUnderPolicy(row, "u1", conflictPolicy).outcome).toBe(
      "conflict",
    );
  });

  it("rejected policy resume / allow_new_draft / conflict", () => {
    const row = { id: "r1", status: "REJECTED" as const, createdById: "u1" };
    expect(resolveDraftDuplicateUnderPolicy(row, "u1").outcome).toBe("resume");
    expect(
      resolveDraftDuplicateUnderPolicy(row, "u1", {
        ...TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY,
        whenRejected: "allow_new_draft",
      }).outcome,
    ).toBe("create");
    expect(
      resolveDraftDuplicateUnderPolicy(row, "u1", {
        ...TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY,
        whenRejected: "conflict",
      }).outcome,
    ).toBe("conflict");
  });
});
