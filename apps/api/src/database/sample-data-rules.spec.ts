import {
  assertDatabaseIsFgOnline,
  demoSeedAllowed,
  isConfirmedSampleUser,
  parseCleanupMode,
} from "./sample-data-rules";

describe("sample-data-rules", () => {
  it("classifies known seed emails and codes as confirmed sample", () => {
    expect(
      isConfirmedSampleUser({
        email: "admin@example.local",
        employeeCode: "EMP-ADMIN-001",
      }),
    ).toBe(true);
    expect(
      isConfirmedSampleUser({
        email: "operator@example.local",
        employeeCode: "EMP-OPERATOR-001",
      }),
    ).toBe(true);
  });

  it("does not classify real-looking users as sample", () => {
    expect(
      isConfirmedSampleUser({
        email: "chinthaka@nelna.lk",
        employeeCode: "EMP-1001",
      }),
    ).toBe(false);
  });

  it("refuses any database except fg_online", () => {
    expect(() => assertDatabaseIsFgOnline("fg_online_test")).toThrow(/fg_online/);
    expect(() => assertDatabaseIsFgOnline("fg_online")).not.toThrow();
  });

  it("defaults cleanup mode to dry-run", () => {
    expect(parseCleanupMode([])).toBe("dry-run");
    expect(parseCleanupMode(["--dry-run"])).toBe("dry-run");
    expect(parseCleanupMode(["--execute"])).toBe("execute");
  });

  it("blocks demo seed in production", () => {
    expect(
      demoSeedAllowed({ NODE_ENV: "production", ENABLE_DEMO_SEED: "true" }).allowed,
    ).toBe(false);
    expect(
      demoSeedAllowed({ NODE_ENV: "development", ENABLE_DEMO_SEED: "true" }).allowed,
    ).toBe(true);
    expect(demoSeedAllowed({ NODE_ENV: "development" }).allowed).toBe(false);
  });
});
