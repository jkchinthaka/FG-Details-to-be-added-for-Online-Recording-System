import type { CookieOptions, Response } from "express";
import { AUTH_COOKIE_NAMES } from "@nelna/shared";
import type { AuthConfig } from "../auth.config";

function baseCookieOptions(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
    domain: config.cookieDomain,
  };
}

/** Sets the httpOnly access + refresh token cookies on a login/refresh response. */
export function setAuthCookies(
  res: Response,
  config: AuthConfig,
  tokens: { accessToken: string; refreshToken: string },
): void {
  res.cookie(AUTH_COOKIE_NAMES.accessToken, tokens.accessToken, {
    ...baseCookieOptions(config),
    maxAge: config.accessTokenTtlMs,
  });
  res.cookie(AUTH_COOKIE_NAMES.refreshToken, tokens.refreshToken, {
    ...baseCookieOptions(config),
    maxAge: config.refreshTokenTtlMs,
  });
}

/** Clears both auth cookies on logout (or a failed refresh). */
export function clearAuthCookies(res: Response, config: AuthConfig): void {
  const options = baseCookieOptions(config);
  res.clearCookie(AUTH_COOKIE_NAMES.accessToken, options);
  res.clearCookie(AUTH_COOKIE_NAMES.refreshToken, options);
}
