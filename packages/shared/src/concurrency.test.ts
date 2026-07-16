import { describe, expect, it } from "vitest";
import {
  buildDraftDeduplicationKey,
  normalizeDedupSegment,
  shouldRetainDraftDeduplicationKey,
  staleStatePayload,
  workflowCycleFromVersion,
} from "./concurrency";

describe("concurrency helpers", () => {
  it("builds deterministic draft keys", () => {
    const a = buildDraftDeduplicationKey({
      documentCode: "nms/ppu/cl/24",
      recordDateIso: "2026-07-16T00:00:00.000Z",
      shiftCode: " day ",
      areaLabel: "Loading  Bay",
    });
    const b = buildDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/24",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: "LOADING BAY",
    });
    expect(a).toBe(b);
    expect(a).toContain("NMS/PPU/CL/24");
  });

  it("normalizes whitespace and case", () => {
    expect(normalizeDedupSegment("  ab  c ")).toBe("AB C");
  });

  it("retains keys only for active draft statuses", () => {
    expect(shouldRetainDraftDeduplicationKey("DRAFT")).toBe(true);
    expect(shouldRetainDraftDeduplicationKey("PENDING_CHECK")).toBe(false);
  });

  it("exposes STALE_STATE payload shape", () => {
    const payload = staleStatePayload();
    expect(payload.code).toBe("STALE_STATE");
    expect(payload.retryable).toBe(false);
  });

  it("maps workflow version to cycle", () => {
    expect(workflowCycleFromVersion(0)).toBe(1);
    expect(workflowCycleFromVersion(3)).toBe(3);
  });
});
