/**
 * Validation and normalization for Cloudflare Worker → Render API proxy upstream.
 * Never log credentials. Public Render origin is allowed in wrangler vars.
 */

export const PRODUCTION_RENDER_API_ORIGIN =
  "https://fg-details-to-be-added-for-online.onrender.com";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export type ApiInternalUrlIssue =
  | "missing"
  | "invalid_url"
  | "invalid_protocol"
  | "localhost"
  | "private_host"
  | "duplicated_api_path";

export class ApiInternalUrlError extends Error {
  readonly code: ApiInternalUrlIssue;

  constructor(code: ApiInternalUrlIssue, message: string) {
    super(message);
    this.name = "ApiInternalUrlError";
    this.code = code;
  }
}

function stripBrackets(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

/** True for loopback, link-local, and RFC1918 private IPv4 (and common IPv6 locals). */
export function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = stripBrackets(hostname.trim().toLowerCase());
  if (!host) return true;
  if (LOCAL_HOSTS.has(host)) return true;
  if (
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  if (host.includes(":")) {
    // IPv6: unique local fc00::/7, link-local fe80::/10, loopback ::1
    if (host === "::1") return true;
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
      return true;
    }
    return false;
  }

  const parts = host.split(".").map((p) => Number(p));
  if (
    parts.length === 4 &&
    parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
  ) {
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  return false;
}

/**
 * Normalize upstream to origin only. Rejects a path of `/api` (or `/api/...`)
 * so callers never produce `…/api/api/...`.
 */
export function normalizeApiInternalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ApiInternalUrlError("missing", "API_INTERNAL_URL is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ApiInternalUrlError(
      "invalid_url",
      "API_INTERNAL_URL must be an absolute http(s) URL",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiInternalUrlError(
      "invalid_protocol",
      "API_INTERNAL_URL must use http or https",
    );
  }

  const path = url.pathname.replace(/\/+$/, "") || "";
  if (path === "/api" || path.startsWith("/api/")) {
    throw new ApiInternalUrlError(
      "duplicated_api_path",
      "API_INTERNAL_URL must not include /api — browser paths already use /api/*",
    );
  }

  if (path !== "" && path !== "/") {
    throw new ApiInternalUrlError(
      "invalid_url",
      "API_INTERNAL_URL must be an origin only (no path)",
    );
  }

  return url.origin;
}

/**
 * Production / Cloudflare Worker upstream: HTTPS public origin only.
 * Rejects missing, localhost, private IPs, and `/api` suffix.
 */
export function assertProductionApiInternalUrl(raw: string | undefined | null): string {
  if (raw === undefined || raw === null || !String(raw).trim()) {
    throw new ApiInternalUrlError(
      "missing",
      "API_INTERNAL_URL is required for Cloudflare/OpenNext production builds",
    );
  }

  const origin = normalizeApiInternalUrl(String(raw));
  const url = new URL(origin);

  if (url.username || url.password) {
    throw new ApiInternalUrlError(
      "invalid_url",
      "Production API_INTERNAL_URL must not embed credentials",
    );
  }

  if (url.protocol !== "https:") {
    throw new ApiInternalUrlError(
      "invalid_protocol",
      "Production API_INTERNAL_URL must use https",
    );
  }

  const host = url.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost")) {
    throw new ApiInternalUrlError(
      "localhost",
      "Production API_INTERNAL_URL must not point at localhost",
    );
  }

  if (isPrivateOrLocalHostname(host)) {
    throw new ApiInternalUrlError(
      "private_host",
      "Production API_INTERNAL_URL must not point at a private or local host",
    );
  }

  return origin;
}

export type WranglerProxyVars = {
  NEXT_PUBLIC_API_URL?: string;
  API_INTERNAL_URL?: string;
};

/**
 * Validates production top-level wrangler vars used by OpenNext Workers.
 */
export function assertProductionWranglerProxyVars(vars: WranglerProxyVars): string {
  if (vars.NEXT_PUBLIC_API_URL !== undefined && vars.NEXT_PUBLIC_API_URL !== "/api") {
    throw new Error(
      `Production NEXT_PUBLIC_API_URL must be "/api" (got ${JSON.stringify(vars.NEXT_PUBLIC_API_URL)})`,
    );
  }
  return assertProductionApiInternalUrl(vars.API_INTERNAL_URL);
}

/**
 * UAT must not silently reuse production. Either omit API_INTERNAL_URL
 * (MANUAL_ACTION_REQUIRED) or set an explicit non-production HTTPS origin.
 */
export function assertUatApiInternalUrl(
  raw: string | undefined | null,
  productionOrigin: string = PRODUCTION_RENDER_API_ORIGIN,
): string | null {
  if (raw === undefined || raw === null || !String(raw).trim()) {
    return null;
  }
  const origin = assertProductionApiInternalUrl(String(raw));
  if (origin === new URL(productionOrigin).origin) {
    throw new Error(
      "UAT API_INTERNAL_URL must not point at the production Render API — set an explicit UAT origin (MANUAL_ACTION_REQUIRED)",
    );
  }
  return origin;
}

/**
 * Resolve upstream for Worker/Node: process.env first, then Cloudflare env binding.
 * Never returns localhost in production.
 */
export async function resolveRuntimeApiInternalUrl(): Promise<string> {
  let raw = process.env.API_INTERNAL_URL?.trim();

  if (!raw) {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const ctx = await getCloudflareContext({ async: true });
      const env = ctx.env as { API_INTERNAL_URL?: string };
      raw = typeof env?.API_INTERNAL_URL === "string" ? env.API_INTERNAL_URL.trim() : "";
    } catch {
      // Not running on Cloudflare / context unavailable.
    }
  }

  // Production Worker: public Render origin is configured in wrangler.jsonc.
  // If process.env injection fails, fall back to that known public origin only
  // (never localhost). Credentials must never appear in this constant.
  if (!raw && process.env.NODE_ENV === "production") {
    raw = PRODUCTION_RENDER_API_ORIGIN;
  }

  if (process.env.NODE_ENV === "production") {
    return assertProductionApiInternalUrl(raw);
  }

  try {
    return normalizeApiInternalUrl(raw || "http://localhost:3001");
  } catch {
    return "http://localhost:3001";
  }
}
