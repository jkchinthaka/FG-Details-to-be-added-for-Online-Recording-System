import { describe, expect, it } from "vitest";
import { decideMiddlewareAction } from "./middleware-logic";

function cookieSet(names: string[]) {
  return (name: string) => names.includes(name);
}

describe("decideMiddlewareAction", () => {
  it("always allows /login through, even with no session", () => {
    expect(decideMiddlewareAction("/login", cookieSet([]))).toEqual({ action: "allow" });
  });

  it("allows a protected route when the access token cookie is present", () => {
    expect(decideMiddlewareAction("/records", cookieSet(["nelna_access_token"]))).toEqual({
      action: "allow",
    });
  });

  it("allows a protected route when only the refresh token cookie is present (access token expired)", () => {
    expect(decideMiddlewareAction("/records", cookieSet(["nelna_refresh_token"]))).toEqual({
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
