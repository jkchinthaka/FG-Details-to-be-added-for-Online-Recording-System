import type { CookieOptions, Response } from "express";
import { setAuthCookies } from "./cookies";
import type { AuthConfig } from "../auth.config";

const config: AuthConfig = {
  accessTokenSecret: "access",
  refreshTokenSecret: "refresh",
  accessTokenTtl: "15m",
  refreshTokenTtl: "7d",
  accessTokenTtlMs: 15 * 60 * 1000,
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000,
  cookieSecure: true,
  cookieDomain: undefined,
  loginMaxAttempts: 5,
  loginLockoutMinutes: 15,
};

describe("setAuthCookies", () => {
  it("sets HttpOnly, secure, SameSite cookies with both token lifetimes", () => {
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;

    setAuthCookies(response, config, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    expect(cookie).toHaveBeenCalledTimes(2);
    const accessOptions = cookie.mock.calls[0]?.[2] as CookieOptions;
    const refreshOptions = cookie.mock.calls[1]?.[2] as CookieOptions;
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
    });
    expect(accessOptions.maxAge).toBe(config.accessTokenTtlMs);
    expect(refreshOptions.maxAge).toBe(config.refreshTokenTtlMs);
  });
});
