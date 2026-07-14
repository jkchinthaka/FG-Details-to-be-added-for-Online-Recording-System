import type { CurrentUser, PermissionKey, UserRole } from "@nelna/shared";
import { AUTH_COOKIE_NAMES } from "@nelna/shared";
import { canAccessRoute, isPublicAppPath } from "./route-access";
import { buildLoginRedirectUrl } from "./session";

export type MiddlewareDecision =
  | { action: "allow" }
  | { action: "redirect"; url: string }
  | { action: "continue_with_cookies"; setCookieHeaders: string[] };

export type VerifiedSession =
  | { status: "ok"; user: CurrentUser }
  | { status: "expired" }
  | { status: "inactive" }
  | { status: "missing" };

/**
 * Cookie-presence gate only. Prefer `decideVerifiedMiddlewareAction` once the
 * session has been verified against `/auth/me`.
 */
export function decideMiddlewareAction(
  pathname: string,
  hasCookie: (name: string) => boolean,
): { action: "allow" } | { action: "redirect"; url: string } {
  if (isPublicAppPath(pathname)) {
    return { action: "allow" };
  }

  const hasSession =
    hasCookie(AUTH_COOKIE_NAMES.accessToken) || hasCookie(AUTH_COOKIE_NAMES.refreshToken);

  if (!hasSession) {
    return { action: "redirect", url: buildLoginRedirectUrl(pathname) };
  }

  return { action: "allow" };
}

/**
 * Verified gate: requires a live CurrentUser from the API (or inactive/expired).
 * Does not rely on cookie presence alone for authorizing page entry.
 */
export function decideVerifiedMiddlewareAction(
  pathname: string,
  session: VerifiedSession,
): MiddlewareDecision {
  if (isPublicAppPath(pathname)) {
    return { action: "allow" };
  }

  if (session.status === "missing" || session.status === "expired") {
    return {
      action: "redirect",
      url: buildLoginRedirectUrl(pathname, "session-expired"),
    };
  }

  if (session.status === "inactive") {
    return { action: "redirect", url: "/account-inactive" };
  }

  if (!canAccessRoute(pathname, session.user.roles, session.user.permissions)) {
    return {
      action: "redirect",
      url: `/unauthorized?from=${encodeURIComponent(pathname)}`,
    };
  }

  return { action: "allow" };
}

export function userHasPermission(user: CurrentUser, key: PermissionKey): boolean {
  return user.permissions.includes(key);
}

export function userHasAnyRole(user: CurrentUser, roles: readonly UserRole[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}
