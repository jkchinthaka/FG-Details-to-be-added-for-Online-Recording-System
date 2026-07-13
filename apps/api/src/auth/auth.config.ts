import { parseDurationMs } from "./lib/duration";

export type AuthConfig = {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenTtl: string;
  refreshTokenTtl: string;
  accessTokenTtlMs: number;
  refreshTokenTtlMs: number;
  cookieSecure: boolean;
  cookieDomain: string | undefined;
  loginMaxAttempts: number;
  loginLockoutMinutes: number;
};

const DEV_ONLY_DEFAULT_ACCESS_SECRET = "dev-only-insecure-access-secret-change-me";
const DEV_ONLY_DEFAULT_REFRESH_SECRET = "dev-only-insecure-refresh-secret-change-me";

/**
 * Reads auth configuration from `process.env`, following the rest of this
 * codebase's convention of reading env vars directly (no @nestjs/config).
 * Falls back to clearly-labelled insecure dev defaults outside production so
 * local setup keeps working without a `.env` file; production requires real
 * secrets to be set.
 */
export function getAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const isProduction = env.NODE_ENV === "production";

  const accessTokenSecret = env.JWT_ACCESS_SECRET ?? DEV_ONLY_DEFAULT_ACCESS_SECRET;
  const refreshTokenSecret = env.JWT_REFRESH_SECRET ?? DEV_ONLY_DEFAULT_REFRESH_SECRET;

  if (isProduction) {
    if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET) {
      throw new Error(
        "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production",
      );
    }
  }

  const accessTokenTtl = env.ACCESS_TOKEN_TTL ?? "15m";
  const refreshTokenTtl = env.REFRESH_TOKEN_TTL ?? "7d";

  return {
    accessTokenSecret,
    refreshTokenSecret,
    accessTokenTtl,
    refreshTokenTtl,
    accessTokenTtlMs: parseDurationMs(accessTokenTtl),
    refreshTokenTtlMs: parseDurationMs(refreshTokenTtl),
    cookieSecure: (env.COOKIE_SECURE ?? "false").toLowerCase() === "true",
    cookieDomain: env.COOKIE_DOMAIN || undefined,
    loginMaxAttempts: Number(env.LOGIN_MAX_ATTEMPTS ?? 5),
    loginLockoutMinutes: Number(env.LOGIN_LOCKOUT_MINUTES ?? 15),
  };
}
