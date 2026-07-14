import type {
  CorrectiveActionDetail,
  CorrectiveActionListResponse,
  CorrectiveActionStatus,
  ReinspectionCandidate,
} from "@nelna/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const API_TIMEOUT_MS = 15_000;

export class CorrectiveActionApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CorrectiveActionApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      signal: timeoutController.signal,
    });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = (await response.json()) as { message?: string | string[] };
        if (typeof body.message === "string") message = body.message;
        else if (Array.isArray(body.message)) message = body.message.join("; ");
      } catch {
        // ignore
      }
      throw new CorrectiveActionApiError(response.status, message);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

export async function listCorrectiveActions(filters: {
  status?: CorrectiveActionStatus;
  assignedToId?: string;
  page?: number;
  pageSize?: number;
}): Promise<CorrectiveActionListResponse> {
  return apiFetch(
    `/corrective-actions${qs({
      status: filters.status,
      assignedToId: filters.assignedToId,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
    })}`,
  );
}

export async function fetchCorrectiveAction(id: string): Promise<CorrectiveActionDetail> {
  return apiFetch(`/corrective-actions/${id}`);
}

export async function startCorrectiveAction(id: string): Promise<CorrectiveActionDetail> {
  return apiFetch(`/corrective-actions/${id}/start`, { method: "PATCH" });
}

export async function completeCorrectiveAction(
  id: string,
  completionComment: string,
): Promise<CorrectiveActionDetail> {
  return apiFetch(`/corrective-actions/${id}/complete`, {
    method: "PATCH",
    body: JSON.stringify({ completionComment }),
  });
}

export async function verifyCorrectiveAction(
  id: string,
  verificationComment: string,
): Promise<CorrectiveActionDetail> {
  return apiFetch(`/corrective-actions/${id}/verify`, {
    method: "PATCH",
    body: JSON.stringify({ verificationComment }),
  });
}

export async function rejectCorrectiveAction(
  id: string,
  rejectionReason: string,
): Promise<CorrectiveActionDetail> {
  return apiFetch(`/corrective-actions/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ rejectionReason }),
  });
}

export async function reopenCorrectiveAction(
  id: string,
): Promise<CorrectiveActionDetail> {
  return apiFetch(`/corrective-actions/${id}/reopen`, { method: "PATCH" });
}

export async function cancelCorrectiveAction(
  id: string,
  cancelReason: string,
): Promise<CorrectiveActionDetail> {
  return apiFetch(`/corrective-actions/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ cancelReason }),
  });
}

export async function searchReinspectionCandidates(input: {
  query?: string;
  vehicleNumber?: string;
  limit?: number;
}): Promise<ReinspectionCandidate[]> {
  return apiFetch(
    `/inspection-records/reinspection-candidates${qs({
      query: input.query,
      vehicleNumber: input.vehicleNumber,
      limit: input.limit ?? 20,
    })}`,
  );
}
