import { describe, expect, it } from "vitest";
import { isServerSubmissionSuccess, nextRetryDelayMs } from "@nelna/shared";
import { loadRecoverableDraft, saveDraft } from "@/lib/draft-storage";

describe("offline submission semantics", () => {
  it("never treats waiting/device states as server success", () => {
    expect(isServerSubmissionSuccess("WAITING_TO_SYNC")).toBe(false);
    expect(isServerSubmissionSuccess("SAVED_ON_DEVICE")).toBe(false);
    expect(isServerSubmissionSuccess("SYNC_FAILED")).toBe(false);
  });

  it("backoff grows then caps", () => {
    expect(nextRetryDelayMs(0)).toBeLessThan(nextRetryDelayMs(3));
    expect(nextRetryDelayMs(20)).toBe(60_000);
  });

  it("loadRecoverableDraft rejects older offline snapshots", () => {
    saveDraft("inspection-record:r1", {
      responses: {},
      savedAt: "2026-07-14T08:00:00.000Z",
    });
    expect(
      loadRecoverableDraft("inspection-record:r1", "2026-07-14T09:00:00.000Z"),
    ).toBeNull();
  });
});
