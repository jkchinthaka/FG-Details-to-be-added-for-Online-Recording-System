import type { AuthErrorCode } from "@nelna/shared";

/** Rendered states the login form and route gate can be in. */
export type LoginFormState =
  | "idle"
  | "submitting"
  | "invalid-credentials"
  | "account-inactive"
  | "account-locked"
  | "session-expired"
  | "unknown-error";

/**
 * Maps an API auth error code (see @nelna/shared AUTH_ERROR_CODES) to the
 * login form state that should be rendered. Pure and unit-testable in
 * isolation from any network/React concerns.
 */
export function loginFormStateForErrorCode(code: AuthErrorCode | "UNKNOWN"): LoginFormState {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "invalid-credentials";
    case "ACCOUNT_INACTIVE":
      return "account-inactive";
    case "ACCOUNT_LOCKED":
      return "account-locked";
    case "SESSION_EXPIRED":
      return "session-expired";
    default:
      return "unknown-error";
  }
}

/** True for the auth error codes that mean "the session is no longer valid" — as opposed to a login attempt failing. */
export function isSessionExpiredCode(code: AuthErrorCode | "UNKNOWN"): boolean {
  return code === "SESSION_EXPIRED" || code === "NOT_AUTHENTICATED";
}

/**
 * Builds the `/login?next=...&reason=...` URL used both by the server-side
 * middleware and any client-side redirect fallback, so both always agree on
 * the query param shape.
 */
export function buildLoginRedirectUrl(
  pathname: string,
  reason?: "session-expired",
): string {
  const params = new URLSearchParams();
  if (pathname && pathname !== "/") {
    params.set("next", pathname);
  }
  if (reason) {
    params.set("reason", reason);
  }
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

/** Where an unqualified/invalid `next` param falls back to — the "Today's Tasks" dashboard home. */
const DEFAULT_POST_LOGIN_PATH = "/tasks";

/** Resolves where to send the user after a successful login (defends against open-redirect via `next`). */
export function resolvePostLoginPath(nextParam: string | null | undefined): string {
  if (!nextParam) return DEFAULT_POST_LOGIN_PATH;
  if (!nextParam.startsWith("/") || nextParam.startsWith("//")) return DEFAULT_POST_LOGIN_PATH;
  return nextParam;
}
