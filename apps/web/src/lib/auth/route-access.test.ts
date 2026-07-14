import { describe, expect, it } from "vitest";
import { canAccessRoute, isPublicAppPath } from "./route-access";

describe("route-access", () => {
  it("treats login and account pages as public", () => {
    expect(isPublicAppPath("/login")).toBe(true);
    expect(isPublicAppPath("/account-inactive")).toBe(true);
    expect(isPublicAppPath("/unauthorized")).toBe(true);
    expect(isPublicAppPath("/records")).toBe(false);
  });

  it("allows operators on records but not admin", () => {
    expect(canAccessRoute("/records", ["FG_OPERATOR"], ["records:read"])).toBe(true);
    expect(canAccessRoute("/admin/users", ["FG_OPERATOR"], ["records:read"])).toBe(false);
  });

  it("allows supervisors on pending check via permission", () => {
    expect(canAccessRoute("/records/pending-check", ["FG_SUPERVISOR"], ["records:check"])).toBe(true);
  });
});
