import { describe, expect, it } from "vitest";
import { validateLogin } from "./validation";

describe("validateLogin", () => {
  it("accepts a well-formed username and non-empty password", () => {
    expect(
      validateLogin({ username: "fg.operator01", password: "s3cret!" }),
    ).toBeNull();
  });

  it("rejects an empty username", () => {
    const errors = validateLogin({ username: "", password: "s3cret!" });
    expect(errors?.username).toBeTruthy();
  });

  it("rejects an invalid username", () => {
    const errors = validateLogin({ username: "ab", password: "s3cret!" });
    expect(errors?.username).toBeTruthy();
  });

  it("rejects an empty password", () => {
    const errors = validateLogin({ username: "fg.operator01", password: "" });
    expect(errors?.password).toBeTruthy();
    expect(errors?.username).toBeUndefined();
  });

  it("rejects both fields empty", () => {
    const errors = validateLogin({ username: "", password: "" });
    expect(errors?.username).toBeTruthy();
    expect(errors?.password).toBeTruthy();
  });
});
