import { describe, expect, it } from "vitest";
import { validateLogin } from "./validation";

describe("validateLogin", () => {
  it("accepts a well-formed email and non-empty password", () => {
    expect(validateLogin({ email: "operator@example.local", password: "s3cret!" })).toBeNull();
  });

  it("rejects an empty email", () => {
    const errors = validateLogin({ email: "", password: "s3cret!" });
    expect(errors?.email).toBeTruthy();
  });

  it("rejects a malformed email", () => {
    const errors = validateLogin({ email: "not-an-email", password: "s3cret!" });
    expect(errors?.email).toBeTruthy();
  });

  it("rejects an empty password", () => {
    const errors = validateLogin({ email: "operator@example.local", password: "" });
    expect(errors?.password).toBeTruthy();
    expect(errors?.email).toBeUndefined();
  });

  it("trims whitespace-only email as invalid", () => {
    const errors = validateLogin({ email: "   ", password: "s3cret!" });
    expect(errors?.email).toBeTruthy();
  });

  it("reports both fields when both are invalid", () => {
    const errors = validateLogin({ email: "", password: "" });
    expect(errors?.email).toBeTruthy();
    expect(errors?.password).toBeTruthy();
  });
});
