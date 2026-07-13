import type { RecentRecordsResponse, TodaysTasksResponse } from "@nelna/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class DashboardApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DashboardApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", cache: "no-store" });
  } catch {
    throw new DashboardApiError(0, "Could not reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Non-JSON error body — fall back to the generic message above.
    }
    throw new DashboardApiError(response.status, message);
  }

  return (await response.json()) as T;
}

/** Role-aware "Today's Tasks" dashboard payload: summary, task cards, compliance/admin widgets. */
export function fetchTodaysTasks(): Promise<TodaysTasksResponse> {
  return apiFetch<TodaysTasksResponse>("/tasks/today");
}

/** Compact list of the most recent records visible to the current user. */
export function fetchRecentRecords(limit = 5): Promise<RecentRecordsResponse> {
  return apiFetch<RecentRecordsResponse>(`/records/recent?limit=${encodeURIComponent(String(limit))}`);
}
