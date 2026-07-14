import { getAuthConfig } from "./auth.config";

describe("getAuthConfig", () => {
  it("falls back to dev-only defaults outside production", () => {
    const config = getAuthConfig({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(config.accessTokenSecret).toContain("dev-only");
    expect(config.refreshTokenSecret).toContain("dev-only");
    expect(config.accessTokenTtl).toBe("15m");
    expect(config.refreshTokenTtl).toBe("7d");
    expect(config.cookieSecure).toBe(false);
  });

  it("reads real secrets and TTLs when configured", () => {
    const config = getAuthConfig({
      NODE_ENV: "development",
      JWT_ACCESS_SECRET: "access-secret",
      JWT_REFRESH_SECRET: "refresh-secret",
      ACCESS_TOKEN_TTL: "10m",
      REFRESH_TOKEN_TTL: "3d",
      COOKIE_SECURE: "true",
      LOGIN_MAX_ATTEMPTS: "3",
      LOGIN_LOCKOUT_MINUTES: "30",
    } as NodeJS.ProcessEnv);

    expect(config.accessTokenSecret).toBe("access-secret");
    expect(config.refreshTokenSecret).toBe("refresh-secret");
    expect(config.accessTokenTtlMs).toBe(10 * 60 * 1000);
    expect(config.refreshTokenTtlMs).toBe(3 * 24 * 60 * 60 * 1000);
    expect(config.cookieSecure).toBe(true);
    expect(config.loginMaxAttempts).toBe(3);
    expect(config.loginLockoutMinutes).toBe(30);
  });

  it("throws in production when secrets are missing", () => {
    expect(() => getAuthConfig({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(
      /must be set in production/,
    );
  });

  it("does not throw in production when secrets and secure cookies are configured", () => {
    expect(() =>
      getAuthConfig({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a",
        JWT_REFRESH_SECRET: "b",
        COOKIE_SECURE: "true",
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("requires secure auth cookies in production", () => {
    expect(() =>
      getAuthConfig({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a",
        JWT_REFRESH_SECRET: "b",
        COOKIE_SECURE: "false",
      } as NodeJS.ProcessEnv),
    ).toThrow(/COOKIE_SECURE must be true/);
  });
});
