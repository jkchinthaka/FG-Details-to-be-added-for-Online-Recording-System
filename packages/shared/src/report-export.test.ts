import { describe, expect, it } from "vitest";
import {
  REPORT_MAX_EXPORT_ROWS,
  REPORT_SYNC_EXPORT_MAX_ROWS,
  reportExportJobCreateSchema,
} from "./reports";

describe("FG-PERF-001 report export contracts", () => {
  it("keeps sync export below worker-safe bounds", () => {
    expect(REPORT_SYNC_EXPORT_MAX_ROWS).toBeLessThanOrEqual(500);
    expect(REPORT_MAX_EXPORT_ROWS).toBeGreaterThan(REPORT_SYNC_EXPORT_MAX_ROWS);
  });

  it("validates idempotent export job create payloads", () => {
    const ok = reportExportJobCreateSchema.safeParse({
      kind: "daily_record_completion",
      filters: { fromDate: "2026-07-01", toDate: "2026-07-07" },
      idempotencyKey: "job-key-001",
    });
    expect(ok.success).toBe(true);

    const bad = reportExportJobCreateSchema.safeParse({
      kind: "daily_record_completion",
      filters: { fromDate: "2026-07-01", toDate: "2026-07-07" },
      idempotencyKey: "bad key",
    });
    expect(bad.success).toBe(false);
  });
});
