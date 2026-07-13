import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { useRecentRecords } from "./useRecentRecords";

describe("useRecentRecords", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to a small limit and resolves to the API payload", async () => {
    const spy = vi.spyOn(api, "fetchRecentRecords").mockResolvedValue({ records: [] });

    const { result } = renderHook(() => useRecentRecords());

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(spy).toHaveBeenCalledWith(4);
    expect(result.current.data).toEqual({ records: [] });
  });

  it("passes a custom limit through to the API", async () => {
    const spy = vi.spyOn(api, "fetchRecentRecords").mockResolvedValue({ records: [] });

    renderHook(() => useRecentRecords(2));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(2));
  });
});
