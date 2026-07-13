import { describe, expect, it } from "vitest";
import {
  buildLoginRedirectUrl,
  isSessionExpiredCode,
  loginFormStateForErrorCode,
  resolvePostLoginPath,
} from "./session";

describe("loginFormStateForErrorCode", () => {
  it("maps every known auth error code to a distinct, specific form state", () => {
    expect(loginFormStateForErrorCode("INVALID_CREDENTIALS")).toBe("invalid-credentials");
    expect(loginFormStateForErrorCode("ACCOUNT_INACTIVE")).toBe("account-inactive");
    expect(loginFormStateForErrorCode("ACCOUNT_LOCKED")).toBe("account-locked");
    expect(loginFormStateForErrorCode("SESSION_EXPIRED")).toBe("session-expired");
  });

  it("falls back to unknown-error for unrecognised codes", () => {
    expect(loginFormStateForErrorCode("UNKNOWN")).toBe("unknown-error");
    expect(loginFormStateForErrorCode("FORBIDDEN")).toBe("unknown-error");
  });
});

describe("isSessionExpiredCode", () => {
  it("treats SESSION_EXPIRED and NOT_AUTHENTICATED as session-expiry signals", () => {
    expect(isSessionExpiredCode("SESSION_EXPIRED")).toBe(true);
    expect(isSessionExpiredCode("NOT_AUTHENTICATED")).toBe(true);
  });

  it("does not treat login failures as session expiry", () => {
    expect(isSessionExpiredCode("INVALID_CREDENTIALS")).toBe(false);
    expect(isSessionExpiredCode("ACCOUNT_LOCKED")).toBe(false);
    expect(isSessionExpiredCode("UNKNOWN")).toBe(false);
  });
});

describe("buildLoginRedirectUrl", () => {
  it("builds a bare /login for the home path with no reason", () => {
    expect(buildLoginRedirectUrl("/")).toBe("/login");
  });

  it("includes the next path for a protected route", () => {
    expect(buildLoginRedirectUrl("/records")).toBe("/login?next=%2Frecords");
  });

  it("includes a session-expired reason", () => {
    expect(buildLoginRedirectUrl("/records", "session-expired")).toBe(
      "/login?next=%2Frecords&reason=session-expired",
    );
  });
});

describe("resolvePostLoginPath", () => {
  it("defaults to home when no next param is given", () => {
    expect(resolvePostLoginPath(undefined)).toBe("/");
    expect(resolvePostLoginPath(null)).toBe("/");
    expect(resolvePostLoginPath("")).toBe("/");
  });

  it("accepts a same-site absolute path", () => {
    expect(resolvePostLoginPath("/records")).toBe("/records");
  });

  it("rejects protocol-relative or external URLs to prevent open redirects", () => {
    expect(resolvePostLoginPath("//evil.example.com")).toBe("/");
    expect(resolvePostLoginPath("https://evil.example.com")).toBe("/");
    expect(resolvePostLoginPath("evil.example.com")).toBe("/");
  });
});
