import type { AuthErrorCode, CurrentUser, LoginInput } from "@nelna/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function isSessionExpiredAuthCode(code: AuthErrorCode | "UNKNOWN"): boolean {
  return code === "SESSION_EXPIRED" || code === "NOT_AUTHENTICATED";
}

export class ApiError extends Error {
  readonly code: AuthErrorCode | "UNKNOWN";
  readonly status: number;

  constructor(status: number, code: AuthErrorCode | "UNKNOWN", message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
  let code: AuthErrorCode | "UNKNOWN" = "UNKNOWN";
  let message = "Something went wrong. Please try again.";
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    if (body.code) code = body.code as AuthErrorCode;
    if (body.message) message = body.message;
  } catch {
    // Non-JSON error body (e.g. network-level failure) — fall back to the generic message.
  }
  return new ApiError(response.status, code, message);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      0,
      "UNKNOWN",
      "Could not reach the server. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    const isAuthBootstrap =
      path.startsWith("/auth/login") || path.startsWith("/auth/refresh");
    if (
      typeof window !== "undefined" &&
      !isAuthBootstrap &&
      (response.status === 401 || isSessionExpiredAuthCode(error.code))
    ) {
      window.dispatchEvent(new CustomEvent("nelna:session-expired"));
    }
    throw error;
  }

  if (response.status === HTTP_NO_CONTENT) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

const HTTP_NO_CONTENT = 204;

export function login(input: LoginInput): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me", { method: "GET" });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function refreshSession(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/refresh", { method: "POST" });
}
