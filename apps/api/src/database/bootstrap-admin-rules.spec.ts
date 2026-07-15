import {
  assertBootstrapDatabaseUrl,
  formatBootstrapValidationError,
  isValidBootstrapEmail,
  readBootstrapAdminInput,
  BOOTSTRAP_MIN_PASSWORD_LENGTH,
} from "./bootstrap-admin-rules";

describe("bootstrap-admin-rules", () => {
  const complete = {
    BOOTSTRAP_ADMIN_EMAIL: "admin@nelna.example",
    BOOTSTRAP_ADMIN_PASSWORD: "SecurePass!234",
    BOOTSTRAP_ADMIN_EMPLOYEE_CODE: "EMP-ADMIN-100",
    BOOTSTRAP_ADMIN_FULL_NAME: "Production Administrator",
  } satisfies NodeJS.ProcessEnv;

  it("accepts complete valid bootstrap input", () => {
    const { input, issues } = readBootstrapAdminInput(complete);
    expect(issues).toEqual([]);
    expect(input).toEqual({
      email: "admin@nelna.example",
      password: "SecurePass!234",
      employeeCode: "EMP-ADMIN-100",
      fullName: "Production Administrator",
    });
  });

  it("requires all four environment variables", () => {
    const { issues } = readBootstrapAdminInput({});
    const fields = issues.map((i) => i.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "BOOTSTRAP_ADMIN_EMAIL",
        "BOOTSTRAP_ADMIN_PASSWORD",
        "BOOTSTRAP_ADMIN_EMPLOYEE_CODE",
        "BOOTSTRAP_ADMIN_FULL_NAME",
      ]),
    );
  });

  it("rejects invalid email", () => {
    const { issues } = readBootstrapAdminInput({
      ...complete,
      BOOTSTRAP_ADMIN_EMAIL: "not-an-email",
    });
    expect(issues.some((i) => i.field === "BOOTSTRAP_ADMIN_EMAIL")).toBe(true);
    expect(isValidBootstrapEmail("not-an-email")).toBe(false);
    expect(isValidBootstrapEmail("ok@nelna.lk")).toBe(true);
  });

  it("rejects passwords shorter than 12 characters", () => {
    const { issues } = readBootstrapAdminInput({
      ...complete,
      BOOTSTRAP_ADMIN_PASSWORD: "short",
    });
    expect(issues.some((i) => i.field === "BOOTSTRAP_ADMIN_PASSWORD")).toBe(true);
    expect(BOOTSTRAP_MIN_PASSWORD_LENGTH).toBe(12);
  });

  it("normalizes email to lowercase without altering password", () => {
    const { input } = readBootstrapAdminInput({
      ...complete,
      BOOTSTRAP_ADMIN_EMAIL: "Admin@Nelna.Example",
      BOOTSTRAP_ADMIN_PASSWORD: "SecurePass!234",
    });
    expect(input?.email).toBe("admin@nelna.example");
    expect(input?.password).toBe("SecurePass!234");
  });

  it("formats validation errors without embedding passwords", () => {
    const password = "ThisShouldNeverAppearInOutput!";
    const message = formatBootstrapValidationError(
      readBootstrapAdminInput({
        ...complete,
        BOOTSTRAP_ADMIN_PASSWORD: password,
        BOOTSTRAP_ADMIN_EMAIL: "bad",
      }).issues,
    );
    expect(message).not.toContain(password);
    expect(message).toMatch(/BOOTSTRAP_ADMIN_EMAIL/);
  });

  it("accepts only fg_online for DATABASE_URL", () => {
    expect(() =>
      assertBootstrapDatabaseUrl(
        "mongodb+srv://u:p@cluster0.example.mongodb.net/fg_online?retryWrites=true",
      ),
    ).not.toThrow();

    expect(() =>
      assertBootstrapDatabaseUrl(
        "mongodb+srv://u:p@cluster0.example.mongodb.net/fg_online_test",
      ),
    ).toThrow(/fg_online/);

    expect(() => assertBootstrapDatabaseUrl(undefined)).toThrow(/DATABASE_URL/);
  });

  it("never returns the connection string from assertBootstrapDatabaseUrl", () => {
    const secretUrl =
      "mongodb+srv://secretUser:SuperSecretPassword99@cluster0.example.mongodb.net/wrong_db";
    try {
      assertBootstrapDatabaseUrl(secretUrl);
      fail("expected throw");
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      expect(text).not.toContain("SuperSecretPassword99");
      expect(text).not.toContain("secretUser");
      expect(text).not.toContain(secretUrl);
    }
  });
});
