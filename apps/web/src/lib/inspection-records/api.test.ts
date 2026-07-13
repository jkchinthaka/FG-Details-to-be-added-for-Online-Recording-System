import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InspectionRecordApiError,
  createCleaningDraft,
  fetchInspectionRecord,
  saveInspectionDraft,
  submitInspectionRecord,
} from "./api";

describe("inspection-records api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the cleaning draft endpoint and returns the record detail", async () => {
    const payload = { header: { id: "record-1" } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCleaningDraft({ taskAssignmentId: "assign-1" });

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inspection-records/cleaning/draft"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("fetches a record by id", async () => {
    const payload = { header: { id: "record-1" } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    await fetchInspectionRecord("record-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inspection-records/record-1"),
      expect.anything(),
    );
  });

  it("PATCHes responses to the draft endpoint", async () => {
    const payload = { header: { id: "record-1" } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    await saveInspectionDraft("record-1", { responses: {} });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inspection-records/record-1/draft"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("POSTs to the submit endpoint", async () => {
    const payload = { recordId: "record-1", status: "SUBMITTED" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitInspectionRecord("record-1", {});

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inspection-records/record-1/submit"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws an InspectionRecordApiError carrying validation errors on a 400 submit failure", async () => {
    const validationErrors = [{ itemId: "item-1", code: "REQUIRED", message: '"Wall" requires a response' }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "This record has validation errors and cannot be submitted", errors: validationErrors }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const error = await submitInspectionRecord("record-1", {}).catch((e) => e);

    expect(error).toBeInstanceOf(InspectionRecordApiError);
    expect(error.validationErrors).toEqual(validationErrors);
  });

  it("throws a network-failure error when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchInspectionRecord("record-1")).rejects.toMatchObject({
      status: 0,
      message: "Could not reach the server. Check your connection and try again.",
    });
  });
});
