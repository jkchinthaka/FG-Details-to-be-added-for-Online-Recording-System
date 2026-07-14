import {
  assertProductionEnv,
  collectProductionEnvIssues,
} from "./validate-production-env";

describe("validate-production-env", () => {
  it("allows incomplete env outside production", () => {
    expect(collectProductionEnvIssues({ NODE_ENV: "development" })).toEqual([]);
  });

  it("rejects production without critical variables", () => {
    const issues = collectProductionEnvIssues({ NODE_ENV: "production" });
    const vars = issues.map((i) => i.variable);
    expect(vars).toEqual(
      expect.arrayContaining([
        "DATABASE_URL",
        "JWT_ACCESS_SECRET",
        "JWT_REFRESH_SECRET",
        "API_CORS_ORIGIN",
        "COOKIE_SECURE",
      ]),
    );
  });

  it("passes a complete production env", () => {
    expect(
      collectProductionEnvIssues({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://u:p@db:5432/nelna_fg",
        JWT_ACCESS_SECRET: "access-secret-with-sufficient-entropy-01",
        JWT_REFRESH_SECRET: "refresh-secret-with-sufficient-entropy-02",
        API_CORS_ORIGIN: "https://fg.example.nelna",
        COOKIE_SECURE: "true",
      }),
    ).toEqual([]);
  });

  it("assertProductionEnv throws with readable detail", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "production" })).toThrow(
      /Refusing to start Nelna FG API/,
    );
  });
});
