"use client";

import { useCallback } from "react";
import type { TodaysTasksResponse } from "@nelna/shared";
import { fetchTodaysTasks } from "./api";
import { useAsyncResource, type AsyncResource } from "./useAsyncResource";

/** Role-aware "Today's Tasks" dashboard payload — summary, task cards, compliance/admin widgets. */
export function useTodaysTasks(): AsyncResource<TodaysTasksResponse> {
  const fetcher = useCallback(() => fetchTodaysTasks(), []);
  return useAsyncResource(fetcher);
}
