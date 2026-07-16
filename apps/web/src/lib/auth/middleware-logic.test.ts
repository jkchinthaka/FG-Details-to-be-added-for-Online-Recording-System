import { describe, expect, it } from "vitest";
import {
  decideMiddlewareAction,
  decideVerifiedMiddlewareAction,
} from "./middleware-logic";
import type { CurrentUser } from "@nelna/shared";

function cookieSet(names: string[]) {
  return (name: string) => names.includes(name);
}

const activeUser: CurrentUser = {
  id: "u1",
  employeeCode: "E1",
  username: "fg.operator01",
  fullName: "Op",
  email: "op@example.com",
  status: "ACTIVE",
  mustChangePassword: false,
  roles: ["FG_OPERATOR"],
  permissions: ["records:create", "records:read"],
  lastLoginAt: null,
};

describe("decideMiddlewareAction (cookie presence)", () => {
  it("always allows /login through, even with no session", () => {
    expect(decideMiddlewareAction("/login", cookieSet([]))).toEqual({ action: "allow" });
  });

  it("never redirects unauthenticated API POSTs to a page route", () => {
    expect(decideMiddlewareAction("/api/auth/login", cookieSet([]))).toEqual({
      action: "allow",
    });
    expect(decideMiddlewareAction("/api/auth/me", cookieSet([]))).toEqual({
      action: "allow",
    });
  });

  it("redirects protected pages without cookies to /login", () => {
    expect(decideMiddlewareAction("/dashboard", cookieSet([]))).toEqual({
      action: "redirect",
      url: "/login?next=%2Fdashboard",
    });
  });

  it("allows a protected route when the access token cookie is present", () => {
    expect(decideMiddlewareAction("/records", cookieSet(["nelna_access_token"]))).toEqual(
      {
        action: "allow",
      },
    );
  });

  it("allows a protected route when only the refresh token cookie is present (access token expired)", () => {
    expect(
      decideMiddlewareAction("/records", cookieSet(["nelna_refresh_token"])),
    ).toEqual({
      action: "allow",
    });
  });

  it("redirects to /login with a next param when no session cookies exist", () => {
    expect(decideMiddlewareAction("/records", cookieSet([]))).toEqual({
      action: "redirect",
      url: "/login?next=%2Frecords",
    });
  });

  it("redirects the home page to a bare /login (no next param needed)", () => {
    expect(decideMiddlewareAction("/", cookieSet([]))).toEqual({
      action: "redirect",
      url: "/login",
    });
  });
});

describe("decideVerifiedMiddlewareAction", () => {
  it("redirects missing session to login with session-expired reason", () => {
    expect(decideVerifiedMiddlewareAction("/records", { status: "missing" })).toEqual({
      action: "redirect",
      url: "/login?next=%2Frecords&reason=session-expired",
    });
  });

  it("redirects expired session to login", () => {
    expect(decideVerifiedMiddlewareAction("/tasks", { status: "expired" })).toEqual({
      action: "redirect",
      url: "/login?next=%2Ftasks&reason=session-expired",
    });
  });

  it("redirects inactive users to account-inactive", () => {
    expect(decideVerifiedMiddlewareAction("/tasks", { status: "inactive" })).toEqual({
      action: "redirect",
      url: "/account-inactive",
    });
  });

  it("redirects users who must change password away from app pages", () => {
    expect(
      decideVerifiedMiddlewareAction("/tasks", {
        status: "ok",
        user: { ...activeUser, mustChangePassword: true },
      }),
    ).toEqual({
      action: "redirect",
      url: "/change-password",
    });
  });

  it("allows change-password page when password change is required", () => {
    expect(
      decideVerifiedMiddlewareAction("/change-password", {
        status: "ok",
        user: { ...activeUser, mustChangePassword: true },
      }),
    ).toEqual({ action: "allow" });
  });

  it("allows an operator on records", () => {
    expect(
      decideVerifiedMiddlewareAction("/records", { status: "ok", user: activeUser }),
    ).toEqual({
      action: "allow",
    });
  });

  it("blocks an operator from /admin (wrong role)", () => {
    expect(
      decideVerifiedMiddlewareAction("/admin", { status: "ok", user: activeUser }),
    ).toEqual({
      action: "redirect",
      url: "/unauthorized?from=%2Fadmin",
    });
  });

  it("allows public unauthorized page without a session", () => {
    expect(
      decideVerifiedMiddlewareAction("/unauthorized", { status: "missing" }),
    ).toEqual({
      action: "allow",
    });
  });
});
