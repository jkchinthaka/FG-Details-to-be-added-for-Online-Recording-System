import type { CurrentUser, PermissionKey, UserRole } from "@nelna/shared";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAMES } from "@nelna/shared";
import { verifySessionFromCookieHeader } from "./verify-session";
import { canAccessRoute } from "./route-access";

/**
 * Server Component / server-action helper: verify the session with the API.
 * Does not expose raw tokens to the client.
 */
export async function getVerifiedServerSession(): Promise<CurrentUser | null> {
  const store = await cookies();
  const parts: string[] = [];
  for (const name of Object.values(AUTH_COOKIE_NAMES)) {
    const value = store.get(name)?.value;
    if (value) parts.push(`${name}=${value}`);
  }
  const { session } = await verifySessionFromCookieHeader(parts.join("; ") || null);
  return session.status === "ok" ? session.user : null;
}

export async function assertServerRouteAccess(
  pathname: string,
): Promise<
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "inactive" }
> {
  const store = await cookies();
  const parts: string[] = [];
  for (const name of Object.values(AUTH_COOKIE_NAMES)) {
    const value = store.get(name)?.value;
    if (value) parts.push(`${name}=${value}`);
  }
  const { session } = await verifySessionFromCookieHeader(parts.join("; ") || null);
  if (session.status === "missing" || session.status === "expired") {
    return { ok: false, reason: "unauthenticated" };
  }
  if (session.status === "inactive") {
    return { ok: false, reason: "inactive" };
  }
  if (!canAccessRoute(pathname, session.user.roles, session.user.permissions)) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, user: session.user };
}

export function serverUserMay(
  user: CurrentUser,
  roles?: readonly UserRole[],
  permissions?: readonly PermissionKey[],
): boolean {
  if (roles?.some((role) => user.roles.includes(role))) return true;
  if (permissions?.some((permission) => user.permissions.includes(permission)))
    return true;
  return !roles && !permissions;
}
