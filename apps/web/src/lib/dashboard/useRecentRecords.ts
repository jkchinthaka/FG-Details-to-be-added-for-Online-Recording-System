"use client";

import { useCallback } from "react";
import type { RecentRecordsResponse } from "@nelna/shared";
import { fetchRecentRecords } from "./api";
import { useAsyncResource, type AsyncResource } from "./useAsyncResource";

const DEFAULT_RECENT_RECORDS_LIMIT = 4;

/** Compact "last few submitted/completed" list backing the mobile dashboard. */
export function useRecentRecords(
  limit = DEFAULT_RECENT_RECORDS_LIMIT,
): AsyncResource<RecentRecordsResponse> {
  const fetcher = useCallback(() => fetchRecentRecords(limit), [limit]);
  return useAsyncResource(fetcher, [limit]);
}
