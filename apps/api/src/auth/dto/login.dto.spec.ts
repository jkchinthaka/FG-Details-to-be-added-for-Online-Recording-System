import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { LoginDto } from "./login.dto";

async function validateLogin(input: Record<string, unknown>) {
  const dto = plainToInstance(LoginDto, input);
  return validate(dto);
}

describe("LoginDto", () => {
  it("accepts a well-formed username and non-empty password", async () => {
    const errors = await validateLogin({
      username: "fg.operator01",
      password: "s3cret!",
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects a missing username", async () => {
    const errors = await validateLogin({ password: "s3cret!" });
    expect(errors.some((e) => e.property === "username")).toBe(true);
  });

  it("rejects an invalid username", async () => {
    const errors = await validateLogin({ username: "ab", password: "s3cret!" });
    expect(errors.some((e) => e.property === "username")).toBe(true);
  });

  it("rejects an empty password", async () => {
    const errors = await validateLogin({ username: "fg.operator01", password: "" });
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });

  it("rejects a missing password", async () => {
    const errors = await validateLogin({ username: "fg.operator01" });
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });
});
