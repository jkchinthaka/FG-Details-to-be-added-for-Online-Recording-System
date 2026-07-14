import type {
  ChecklistValidationError,
  CreateCleaningDraftInput,
  CreateTruckDraftInput,
  InspectionRecordDetail,
  LoadingDecisionInput,
  SaveDraftResponsesInput,
  SubmitInspectionRecordInput,
  SubmitRecordResult,
} from "@nelna/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const API_TIMEOUT_MS = 15_000;

export class InspectionRecordApiError extends Error {
  readonly status: number;
  /** Populated only for a 400 from `/submit` that failed checklist validation
   *  (see `RecordValidationException`) — lets the UI jump straight back into
   *  the form instead of just showing a generic error toast. */
  readonly validationErrors?: ChecklistValidationError[];

  constructor(status: number, message: string, validationErrors?: ChecklistValidationError[]) {
    super(message);
    this.name = "InspectionRecordApiError";
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), API_TIMEOUT_MS);
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: init?.signal ?? timeoutController.signal,
    });
  } catch {
    if (timeoutController.signal.aborted) {
      throw new InspectionRecordApiError(0, "The request timed out. Check your connection and try again.");
    }
    throw new InspectionRecordApiError(0, "Could not reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 401) {
      const { notifySessionExpired } = await import("@/lib/http/session-events");
      notifySessionExpired();
    }
    if (response.status === 403) {
      const { notifyForbidden } = await import("@/lib/http/session-events");
      notifyForbidden();
    }
    let message = `Request failed (${response.status})`;
    let validationErrors: ChecklistValidationError[] | undefined;
    try {
      const body = (await response.json()) as { message?: string; errors?: ChecklistValidationError[] };
      if (body.message) message = body.message;
      if (body.errors) validationErrors = body.errors;
    } catch {
      // Non-JSON error body — fall back to the generic message above.
    }
    throw new InspectionRecordApiError(response.status, message, validationErrors);
  }

  return (await response.json()) as T;
}

/** Creates (or resumes) today's Daily Cleaning Verification draft for the current operator. */
export function createCleaningDraft(input: CreateCleaningDraftInput): Promise<InspectionRecordDetail> {
  return apiFetch<InspectionRecordDetail>("/inspection-records/cleaning/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Creates (or resumes) a Freezer Truck Inspection Before Loading draft for the selected/manually-entered vehicle. */
export function createTruckDraft(input: CreateTruckDraftInput): Promise<InspectionRecordDetail> {
  return apiFetch<InspectionRecordDetail>("/inspection-records/truck/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Records the final freezer truck loading decision (supervisor/QA only). */
export function recordLoadingDecision(
  id: string,
  input: LoadingDecisionInput,
): Promise<InspectionRecordDetail> {
  return apiFetch<InspectionRecordDetail>(`/inspection-records/${encodeURIComponent(id)}/loading-decision`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Retrieves a record's header, template version and current responses. */
export function fetchInspectionRecord(id: string): Promise<InspectionRecordDetail> {
  return apiFetch<InspectionRecordDetail>(`/inspection-records/${encodeURIComponent(id)}`);
}

/** Autosaves/saves the current draft responses without submitting. */
export function saveInspectionDraft(id: string, input: SaveDraftResponsesInput): Promise<InspectionRecordDetail> {
  return apiFetch<InspectionRecordDetail>(`/inspection-records/${encodeURIComponent(id)}/draft`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Validates and submits a record, locking it from further operator edits. */
export function submitInspectionRecord(
  id: string,
  input: SubmitInspectionRecordInput,
): Promise<SubmitRecordResult> {
  return apiFetch<SubmitRecordResult>(`/inspection-records/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchPendingCheckQueue(): Promise<InspectionRecordDetail[]> {
  return apiFetch("/inspection-records/queues/pending-check");
}

export function fetchPendingVerificationQueue(): Promise<InspectionRecordDetail[]> {
  return apiFetch("/inspection-records/queues/pending-verification");
}

export function checkInspectionRecord(id: string, comment?: string): Promise<InspectionRecordDetail> {
  return apiFetch(`/inspection-records/${encodeURIComponent(id)}/check`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function verifyInspectionRecord(id: string, comment?: string): Promise<InspectionRecordDetail> {
  return apiFetch(`/inspection-records/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function returnInspectionRecord(id: string, comment: string): Promise<InspectionRecordDetail> {
  return apiFetch(`/inspection-records/${encodeURIComponent(id)}/return`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function rejectInspectionRecord(id: string, comment: string): Promise<InspectionRecordDetail> {
  return apiFetch(`/inspection-records/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function fetchInspectionApprovals(id: string): Promise<unknown[]> {
  return apiFetch(`/inspection-records/${encodeURIComponent(id)}/approvals`);
}
