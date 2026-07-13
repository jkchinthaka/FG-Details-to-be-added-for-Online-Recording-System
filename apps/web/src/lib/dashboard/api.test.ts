import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardApiError, fetchRecentRecords, fetchTodaysTasks } from "./api";

describe("dashboard api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and returns the today's-tasks payload on a 200 response", async () => {
    const payload = { generatedAt: "now", roles: [], summary: {}, tasks: [], complianceIndicators: [], adminShortcuts: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTodaysTasks();

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/today"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("appends the limit query param when fetching recent records", async () => {
    const payload = { records: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    await fetchRecentRecords(7);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/records/recent?limit=7"), expect.anything());
  });

  it("throws a DashboardApiError with the server's message on a non-OK response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: "Forbidden" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTodaysTasks()).rejects.toMatchObject(
      new DashboardApiError(403, "Forbidden"),
    );
  });

  it("throws a network-failure DashboardApiError when fetch itself rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(fetchTodaysTasks()).rejects.toMatchObject({
      status: 0,
      message: "Could not reach the server. Check your connection and try again.",
    });
  });
});
