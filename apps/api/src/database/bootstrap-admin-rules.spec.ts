import {
  assertBootstrapAllowed,
  assertBootstrapDatabaseUrl,
  formatBootstrapValidationError,
  isValidBootstrapEmail,
  readBootstrapAdminInput,
  BOOTSTRAP_MIN_PASSWORD_LENGTH,
  redactBootstrapErrorMessage,
} from "./bootstrap-admin-rules";

describe("bootstrap-admin-rules (username)", () => {
  const complete = {
    BOOTSTRAP_ADMIN_USERNAME: "sys.admin",
    BOOTSTRAP_ADMIN_PASSWORD: "SecurePass!234",
    BOOTSTRAP_ADMIN_EMPLOYEE_CODE: "EMP-ADMIN-100",
    BOOTSTRAP_ADMIN_FULL_NAME: "Production Administrator",
  } satisfies NodeJS.ProcessEnv;

  it("accepts complete valid bootstrap input", () => {
    const { input, issues } = readBootstrapAdminInput(complete);
    expect(issues).toEqual([]);
    expect(input).toEqual({
      username: "sys.admin",
      password: "SecurePass!234",
      employeeCode: "EMP-ADMIN-100",
      fullName: "Production Administrator",
      email: undefined,
    });
  });

  it("refuses bootstrap without ALLOW_PRODUCTION_ADMIN_BOOTSTRAP=YES", () => {
    expect(() => assertBootstrapAllowed({})).toThrow(/ALLOW_PRODUCTION_ADMIN_BOOTSTRAP=YES/);
    expect(() =>
      assertBootstrapAllowed({ ALLOW_PRODUCTION_ADMIN_BOOTSTRAP: "YES" }),
    ).not.toThrow();
  });

  it("requires username, password, employee code and full name", () => {
    const { issues } = readBootstrapAdminInput({});
    const fields = issues.map((i) => i.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "BOOTSTRAP_ADMIN_USERNAME",
        "BOOTSTRAP_ADMIN_PASSWORD",
        "BOOTSTRAP_ADMIN_EMPLOYEE_CODE",
        "BOOTSTRAP_ADMIN_FULL_NAME",
      ]),
    );
  });

  it("rejects missing username", () => {
    const { issues } = readBootstrapAdminInput({
      ...complete,
      BOOTSTRAP_ADMIN_USERNAME: "",
    });
    expect(issues.some((i) => i.field === "BOOTSTRAP_ADMIN_USERNAME")).toBe(true);
  });

  it("rejects invalid username", () => {
    const { issues } = readBootstrapAdminInput({
      ...complete,
      BOOTSTRAP_ADMIN_USERNAME: "ab",
    });
    expect(issues.some((i) => i.field === "BOOTSTRAP_ADMIN_USERNAME")).toBe(true);
  });

  it("normalizes username to lowercase", () => {
    const { input } = readBootstrapAdminInput({
      ...complete,
      BOOTSTRAP_ADMIN_USERNAME: "Sys.Admin",
    });
    expect(input?.username).toBe("sys.admin");
  });

  it("rejects passwords shorter than 12 characters", () => {
    const { issues } = readBootstrapAdminInput({
      ...complete,
      BOOTSTRAP_ADMIN_PASSWORD: "short",
    });
    expect(issues.some((i) => i.field === "BOOTSTRAP_ADMIN_PASSWORD")).toBe(true);
    expect(BOOTSTRAP_MIN_PASSWORD_LENGTH).toBe(12);
  });

  it("accepts optional valid email and rejects invalid optional email", () => {
    expect(
      readBootstrapAdminInput({
        ...complete,
        BOOTSTRAP_ADMIN_EMAIL: "Admin@Nelna.Example",
      }).input?.email,
    ).toBe("admin@nelna.example");

    expect(
      readBootstrapAdminInput({
        ...complete,
        BOOTSTRAP_ADMIN_EMAIL: "not-an-email",
      }).issues.some((i) => i.field === "BOOTSTRAP_ADMIN_EMAIL"),
    ).toBe(true);
    expect(isValidBootstrapEmail("ok@nelna.lk")).toBe(true);
  });

  it("formats validation errors without embedding passwords", () => {
    const password = "ThisShouldNeverAppearInOutput!";
    const message = formatBootstrapValidationError(
      readBootstrapAdminInput({
        ...complete,
        BOOTSTRAP_ADMIN_PASSWORD: password,
        BOOTSTRAP_ADMIN_USERNAME: "ab",
      }).issues,
    );
    expect(message).not.toContain(password);
    expect(message).toMatch(/BOOTSTRAP_ADMIN_USERNAME/);
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
  });

  it("redacts secrets from bootstrap error messages", () => {
    const safe = redactBootstrapErrorMessage(
      "fail mongodb+srv://u:SecretPass@host/fg_online password=SecretPass $2b$12$abcdefghijklmnopqrstuv",
    );
    expect(safe).not.toContain("SecretPass");
    expect(safe).toMatch(/\[redacted/);
  });
});
