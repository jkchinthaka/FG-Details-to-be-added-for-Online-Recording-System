import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TodaysTasksResponse } from "@nelna/shared";
import * as api from "./api";
import { useTodaysTasks } from "./useTodaysTasks";

describe("useTodaysTasks", () => {
  it("resolves to the API payload", async () => {
    const payload: TodaysTasksResponse = {
      generatedAt: "2026-07-14T00:00:00.000Z",
      roles: ["FG_OPERATOR"],
      summary: { completed: 0, pending: 1, attentionRequired: 0, totalCount: 1, completionPercent: 0 },
      tasks: [],
      complianceIndicators: [],
      adminShortcuts: [],
    };
    vi.spyOn(api, "fetchTodaysTasks").mockResolvedValue(payload);

    const { result } = renderHook(() => useTodaysTasks());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(payload);
  });

  it("surfaces an API failure as an error state", async () => {
    vi.spyOn(api, "fetchTodaysTasks").mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useTodaysTasks());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("boom");
  });
});
