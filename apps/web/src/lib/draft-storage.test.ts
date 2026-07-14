import { afterEach, describe, expect, it } from "vitest";
import { clearDraft, loadRecoverableDraft, saveDraft } from "./draft-storage";

describe("draft storage recovery", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a newer offline backup for recovery", () => {
    saveDraft("record-1", {
      responses: { wall: { value: "PASS" } },
      savedAt: "2026-07-14T10:05:00.000Z",
    });

    expect(loadRecoverableDraft("record-1", "2026-07-14T10:00:00.000Z")).toEqual({
      responses: { wall: { value: "PASS" } },
      savedAt: "2026-07-14T10:05:00.000Z",
    });
  });

  it("does not restore a stale backup over a newer server record", () => {
    saveDraft("record-1", {
      responses: { wall: { value: "PASS" } },
      savedAt: "2026-07-14T10:00:00.000Z",
    });

    expect(loadRecoverableDraft("record-1", "2026-07-14T10:05:00.000Z")).toBeNull();
  });

  it("rejects malformed timestamps without throwing", () => {
    saveDraft("record-1", {
      responses: { wall: { value: "PASS" } },
      savedAt: "not-a-date",
    });

    expect(loadRecoverableDraft("record-1", "2026-07-14T10:00:00.000Z")).toBeNull();
    clearDraft("record-1");
  });
});
