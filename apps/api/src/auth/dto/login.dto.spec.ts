import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { LoginDto } from "./login.dto";

async function validateLogin(payload: Record<string, unknown>) {
  const dto = plainToInstance(LoginDto, payload);
  return validate(dto);
}

describe("LoginDto validation", () => {
  it("accepts a well-formed email and non-empty password", async () => {
    const errors = await validateLogin({
      email: "operator@example.local",
      password: "s3cret!",
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects a missing email", async () => {
    const errors = await validateLogin({ password: "s3cret!" });
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });

  it("rejects a malformed email", async () => {
    const errors = await validateLogin({ email: "not-an-email", password: "s3cret!" });
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });

  it("rejects an empty password", async () => {
    const errors = await validateLogin({ email: "operator@example.local", password: "" });
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });

  it("rejects a missing password", async () => {
    const errors = await validateLogin({ email: "operator@example.local" });
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });

  it("never echoes the password value back inside a constraint message", async () => {
    const errors = await validateLogin({ email: "operator@example.local", password: "" });
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    for (const message of messages) {
      expect(message).not.toContain("s3cret");
    }
  });
});
