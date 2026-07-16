import { describe, expect, it } from "vitest";
import {
  canAccessRoute,
  isApiProxyPath,
  isPublicAppPath,
  PAGE_MIDDLEWARE_MATCHER,
  pathMatchesPageMiddleware,
} from "./route-access";
import { config as middlewareConfig } from "../../middleware";

describe("route-access", () => {
  it("treats login, account and release endpoints as public", () => {
    expect(isPublicAppPath("/login")).toBe(true);
    expect(isPublicAppPath("/account-inactive")).toBe(true);
    expect(isPublicAppPath("/unauthorized")).toBe(true);
    expect(isPublicAppPath("/release")).toBe(true);
    expect(isPublicAppPath("/records")).toBe(false);
  });

  it("allows operators on records but not admin", () => {
    expect(canAccessRoute("/records", ["FG_OPERATOR"], ["records:read"])).toBe(true);
    expect(canAccessRoute("/admin/users", ["FG_OPERATOR"], ["records:read"])).toBe(false);
  });

  it("allows supervisors on pending check via permission", () => {
    expect(
      canAccessRoute("/records/pending-check", ["FG_SUPERVISOR"], ["records:check"]),
    ).toBe(true);
  });
});

describe("page middleware matcher / API bypass", () => {
  it("keeps middleware.config.matcher in sync with PAGE_MIDDLEWARE_MATCHER", () => {
    expect(middlewareConfig.matcher).toEqual([PAGE_MIDDLEWARE_MATCHER]);
  });

  it("does not match API proxy paths (auth and health)", () => {
    expect(pathMatchesPageMiddleware("/api/auth/login")).toBe(false);
    expect(pathMatchesPageMiddleware("/api/auth/me")).toBe(false);
    expect(pathMatchesPageMiddleware("/api/health/ready")).toBe(false);
    expect(pathMatchesPageMiddleware("/api")).toBe(false);
    expect(isApiProxyPath("/api/auth/login")).toBe(true);
    expect(isApiProxyPath("/api/auth/me")).toBe(true);
    expect(isApiProxyPath("/api/health/ready")).toBe(true);
  });

  it("still matches public login and protected dashboard/records pages", () => {
    expect(pathMatchesPageMiddleware("/release-manifest.json")).toBe(false);
    expect(pathMatchesPageMiddleware("/release")).toBe(true);
    expect(isPublicAppPath("/release")).toBe(true);
  });
});
