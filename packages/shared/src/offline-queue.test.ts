import { describe, expect, it } from "vitest";
import {
  createIdempotencyKey,
  isServerSubmissionSuccess,
  nextRetryDelayMs,
  OFFLINE_QUEUE_STATES,
} from "./offline-queue";

describe("offline-queue helpers", () => {
  it("lists required queue states", () => {
    expect(OFFLINE_QUEUE_STATES).toContain("WAITING_TO_SYNC");
    expect(OFFLINE_QUEUE_STATES).toContain("CONFLICT_REQUIRES_REVIEW");
  });

  it("does not treat device-saved as server success", () => {
    expect(isServerSubmissionSuccess("SAVED_ON_DEVICE")).toBe(false);
    expect(isServerSubmissionSuccess("WAITING_TO_SYNC")).toBe(false);
    expect(isServerSubmissionSuccess("SYNCED")).toBe(true);
  });

  it("applies exponential backoff with a ceiling", () => {
    expect(nextRetryDelayMs(0)).toBe(2000);
    expect(nextRetryDelayMs(1)).toBe(4000);
    expect(nextRetryDelayMs(10)).toBe(60_000);
  });

  it("creates unique-ish idempotency keys", () => {
    expect(createIdempotencyKey()).not.toEqual(createIdempotencyKey());
  });
});
