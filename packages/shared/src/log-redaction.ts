/**
 * Shared log redaction helpers (FG-SEC-001 / FG-AUD-001).
 * Never log passwords, tokens, cookies, or DATABASE_URL.
 */
const SENSITIVE_KEY =
  /pass(word)?|passwd|pwd|secret|token|authorization|cookie|database_url|connectionstring|refresh|jwt|hash/i;

const MONGO_URI = /mongodb(?:\+srv)?:\/\/[^\s"']+/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const COOKIE_PAIR = /(?:nelna_access_token|nelna_refresh_token)=[^;\s]+/gi;

export function redactString(value: string): string {
  return value
    .replace(MONGO_URI, "[REDACTED_MONGO_URI]")
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(COOKIE_PAIR, "[REDACTED_COOKIE]")
    .replace(/\/\/[^/\s@]*:[^/\s@]*@/g, "//****:****@");
}

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactForLog(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactForLog(nested, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

/** Keys stripped from audit before/after diffs. */
export const AUDIT_EXCLUDED_FIELDS = [
  "password",
  "passwordHash",
  "currentPassword",
  "newPassword",
  "refreshToken",
  "accessToken",
  "token",
  "authorization",
  "cookie",
  "DATABASE_URL",
] as const;

export function redactAuditDiff(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  const redacted = redactForLog(value) as Record<string, unknown>;
  for (const key of AUDIT_EXCLUDED_FIELDS) {
    if (key in redacted) redacted[key] = "[REDACTED]";
  }
  return redacted;
}
