import { AUTH_COOKIE_NAMES } from "@nelna/shared";
import { buildLoginRedirectUrl } from "./session";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Pure decision function behind `middleware.ts`, kept separate so it's
 * testable without needing Next's edge runtime request/response objects.
 *
 * This is a lightweight, defense-in-depth check: it only confirms an auth
 * cookie is *present*, not that the token is still valid — the API's
 * JwtAuthGuard is what actually verifies the token on every request. A
 * client-side AuthGate (see AppShell) provides a second layer that reacts to
 * a live 401 from the API (e.g. an access token that expired mid-session).
 */
export function decideMiddlewareAction(
  pathname: string,
  hasCookie: (name: string) => boolean,
): { action: "allow" } | { action: "redirect"; url: string } {
  if (isPublicPath(pathname)) {
    return { action: "allow" };
  }

  const hasSession =
    hasCookie(AUTH_COOKIE_NAMES.accessToken) || hasCookie(AUTH_COOKIE_NAMES.refreshToken);

  if (!hasSession) {
    return { action: "redirect", url: buildLoginRedirectUrl(pathname) };
  }

  return { action: "allow" };
}
