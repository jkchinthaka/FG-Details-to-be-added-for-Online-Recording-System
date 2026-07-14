import type { CurrentUser } from "@nelna/shared";
import type { VerifiedSession } from "./middleware-logic";

const API_BASE_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

function collectSetCookie(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

/**
 * Verifies the browser session against the Nest API using forwarded cookies.
 * Attempts one refresh when `/auth/me` returns 401.
 * Access/refresh token values are never returned to application JS — only status + CurrentUser.
 */
export async function verifySessionFromCookieHeader(
  cookieHeader: string | null,
): Promise<{
  session: VerifiedSession;
  setCookieHeaders: string[];
}> {
  if (!cookieHeader || !cookieHeader.trim()) {
    return { session: { status: "missing" }, setCookieHeaders: [] };
  }

  const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: { cookie: cookieHeader, accept: "application/json" },
    cache: "no-store",
  });

  if (meResponse.ok) {
    const user = (await meResponse.json()) as CurrentUser;
    if (user.status !== "ACTIVE") {
      return { session: { status: "inactive" }, setCookieHeaders: [] };
    }
    return { session: { status: "ok", user }, setCookieHeaders: [] };
  }

  if (meResponse.status === 403) {
    // Forbidden with valid auth often means inactive / forbidden — treat inactive specially if coded
    const body = (await meResponse.json().catch(() => ({}))) as { code?: string };
    if (body.code === "ACCOUNT_INACTIVE") {
      return { session: { status: "inactive" }, setCookieHeaders: [] };
    }
  }

  if (meResponse.status === 401) {
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { cookie: cookieHeader, accept: "application/json" },
      cache: "no-store",
    });
    const setCookieHeaders = collectSetCookie(refreshResponse);
    if (!refreshResponse.ok) {
      return { session: { status: "expired" }, setCookieHeaders };
    }
    // Re-read me with refreshed cookies merged into the cookie header when possible
    const refreshedCookies = mergeSetCookieIntoHeader(cookieHeader, setCookieHeaders);
    const retry = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: { cookie: refreshedCookies, accept: "application/json" },
      cache: "no-store",
    });
    if (!retry.ok) {
      return { session: { status: "expired" }, setCookieHeaders };
    }
    const user = (await retry.json()) as CurrentUser;
    if (user.status !== "ACTIVE") {
      return { session: { status: "inactive" }, setCookieHeaders };
    }
    return { session: { status: "ok", user }, setCookieHeaders };
  }

  return { session: { status: "expired" }, setCookieHeaders: [] };
}

function mergeSetCookieIntoHeader(original: string, setCookies: string[]): string {
  if (setCookies.length === 0) return original;
  const jar = new Map<string, string>();
  for (const part of original.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const line of setCookies) {
    const first = line.split(";")[0] ?? "";
    const eq = first.indexOf("=");
    if (eq === -1) continue;
    jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
