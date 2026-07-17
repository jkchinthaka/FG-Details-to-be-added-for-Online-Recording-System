/**
 * Stable API error envelope (FG-ERR-001).
 * Clients must branch on `code`, never on message text.
 */
export type ApiFieldError = {
  field: string;
  code?: string;
  message: string;
};

export type ApiErrorEnvelope = {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors: ApiFieldError[];
  requestId: string;
  retryable: boolean;
};

export type BuildApiErrorInput = {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: ApiFieldError[];
  retryable?: boolean;
};

export function buildApiErrorEnvelope(input: BuildApiErrorInput): ApiErrorEnvelope {
  return {
    statusCode: input.statusCode,
    code: input.code,
    message: input.message,
    fieldErrors: input.fieldErrors ?? [],
    requestId: input.requestId,
    retryable: Boolean(input.retryable),
  };
}

/** Header name used Worker → API → client. */
export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;

export function isValidRequestId(value: string | null | undefined): boolean {
  if (!value) return false;
  return REQUEST_ID_PATTERN.test(value.trim());
}
