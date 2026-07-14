import type { CookieOptions, Response } from "express";
import { AUTH_COOKIE_NAMES } from "@nelna/shared";
import { clearAuthCookies, setAuthCookies } from "./cookies";
import type { AuthConfig } from "../auth.config";

describe("auth cookies", () => {
  const baseConfig: AuthConfig = {
    accessTokenSecret: "a",
    refreshTokenSecret: "b",
    accessTokenTtl: "15m",
    refreshTokenTtl: "7d",
    accessTokenTtlMs: 15 * 60 * 1000,
    refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000,
    cookieSecure: true,
    cookieDomain: undefined,
    loginMaxAttempts: 5,
    loginLockoutMinutes: 15,
  };

  it("sets HttpOnly, secure, SameSite cookies with both token lifetimes", () => {
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;

    setAuthCookies(response, baseConfig, {
      accessToken: "access",
      refreshToken: "refresh",
    });

    expect(cookie).toHaveBeenCalledTimes(2);
    const accessOptions = cookie.mock.calls[0]?.[2] as CookieOptions;
    const refreshOptions = cookie.mock.calls[1]?.[2] as CookieOptions;
    expect(cookie.mock.calls[0]?.[0]).toBe(AUTH_COOKIE_NAMES.accessToken);
    expect(accessOptions).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(refreshOptions).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: baseConfig.refreshTokenTtlMs,
    });
  });

  it("sets Cookie Domain=.nelna.lk for cross-subdomain auth on production", () => {
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;
    const prodConfig: AuthConfig = {
      ...baseConfig,
      cookieSecure: true,
      cookieDomain: ".nelna.lk",
    };

    setAuthCookies(response, prodConfig, {
      accessToken: "access",
      refreshToken: "refresh",
    });

    const accessOptions = cookie.mock.calls[0]?.[2] as CookieOptions;
    expect(accessOptions.domain).toBe(".nelna.lk");
    expect(accessOptions.httpOnly).toBe(true);
    expect(accessOptions.secure).toBe(true);
    expect(accessOptions.sameSite).toBe("lax");
  });

  it("clears cookies with the same domain options used at set time", () => {
    const clearCookie = jest.fn();
    const response = { clearCookie } as unknown as Response;
    const prodConfig: AuthConfig = {
      ...baseConfig,
      cookieDomain: ".nelna.lk",
      cookieSecure: true,
    };

    clearAuthCookies(response, prodConfig);

    expect(clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAMES.accessToken,
      expect.objectContaining({
        domain: ".nelna.lk",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      }),
    );
    expect(clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAMES.refreshToken,
      expect.objectContaining({ domain: ".nelna.lk" }),
    );
  });
});
