import {
  assertProductionEnv,
  collectProductionEnvIssues,
  extractMongoDatabaseName,
  isMongoConnectionUrl,
  isSameOriginCookieMode,
  type ProductionEnvIssue,
} from "./validate-production-env";
import {
  buildCorsOptions,
  isCorsOriginAllowed,
  PRODUCTION_FRONTEND_ORIGIN,
} from "./cors-origin";

describe("validate-production-env (Cloudflare + Render + Atlas)", () => {
  const completeProduction = {
    NODE_ENV: "production",
    NELNA_DEPLOY_TIER: "production",
    DATABASE_URL:
      "mongodb+srv://user:secret@cluster0.example.mongodb.net/fg_online?retryWrites=true&w=majority",
    JWT_ACCESS_SECRET: "access-secret-with-sufficient-entropy-01",
    JWT_REFRESH_SECRET: "refresh-secret-with-sufficient-entropy-02",
    API_CORS_ORIGIN: "https://fg.nelna.lk",
    COOKIE_SECURE: "true",
    COOKIE_DOMAIN: ".nelna.lk",
    NELNA_COOKIE_MODE: "cross_subdomain",
    ACCESS_TOKEN_TTL: "15m",
    REFRESH_TOKEN_TTL: "7d",
    APP_VERSION: "1.0.0",
    APP_BUILD_ID: "abc1234",
  } satisfies NodeJS.ProcessEnv;

  const sameOriginProduction = {
    ...completeProduction,
    NELNA_COOKIE_MODE: "same_origin",
    COOKIE_DOMAIN: "",
  } satisfies NodeJS.ProcessEnv;

  it("allows incomplete env outside production", () => {
    expect(collectProductionEnvIssues({ NODE_ENV: "development" })).toEqual([]);
  });

  it("rejects production without critical variables", () => {
    const issues = collectProductionEnvIssues({ NODE_ENV: "production" });
    const vars = issues.map((i: ProductionEnvIssue) => i.variable);
    expect(vars).toEqual(
      expect.arrayContaining([
        "DATABASE_URL",
        "JWT_ACCESS_SECRET",
        "JWT_REFRESH_SECRET",
        "API_CORS_ORIGIN",
        "COOKIE_SECURE",
        "ACCESS_TOKEN_TTL",
        "REFRESH_TOKEN_TTL",
        "APP_VERSION",
        "APP_BUILD_ID",
      ]),
    );
    // Same-origin proxy is the default when COOKIE_DOMAIN is unset — not an error.
    expect(vars).not.toContain("COOKIE_DOMAIN");
  });

  it("passes a complete production env for fg.nelna.lk (cross-subdomain)", () => {
    expect(collectProductionEnvIssues(completeProduction)).toEqual([]);
  });

  it("passes same-origin proxy production with empty COOKIE_DOMAIN", () => {
    expect(collectProductionEnvIssues(sameOriginProduction)).toEqual([]);
    expect(
      collectProductionEnvIssues({
        ...completeProduction,
        COOKIE_DOMAIN: undefined,
        NELNA_COOKIE_MODE: undefined,
      }),
    ).toEqual([]);
  });

  it("requires API_CORS_ORIGIN to be https://fg.nelna.lk in production tier", () => {
    const issues = collectProductionEnvIssues({
      ...completeProduction,
      API_CORS_ORIGIN: "https://evil.example",
    });
    expect(issues.some((i) => i.variable === "API_CORS_ORIGIN")).toBe(true);
  });

  it("allows FRONTEND_PUBLIC_URL to define the expected CORS origin", () => {
    expect(
      collectProductionEnvIssues({
        ...completeProduction,
        FRONTEND_PUBLIC_URL: "https://fg.custom.example",
        API_CORS_ORIGIN: "https://fg.custom.example",
      }),
    ).toEqual([]);
  });

  it("requires COOKIE_DOMAIN=.nelna.lk in cross-subdomain mode", () => {
    const issues = collectProductionEnvIssues({
      ...completeProduction,
      COOKIE_DOMAIN: "fg-api.nelna.lk",
    });
    expect(issues.some((i) => i.variable === "COOKIE_DOMAIN")).toBe(true);
  });

  it("rejects COOKIE_DOMAIN when NELNA_COOKIE_MODE=same_origin", () => {
    const issues = collectProductionEnvIssues({
      ...sameOriginProduction,
      COOKIE_DOMAIN: ".nelna.lk",
    });
    expect(issues.some((i) => i.variable === "COOKIE_DOMAIN")).toBe(true);
  });

  it("requires MongoDB Atlas URL and database fg_online", () => {
    expect(
      collectProductionEnvIssues({
        ...completeProduction,
        DATABASE_URL: "postgresql://u:p@db:5432/nelna_fg",
      }).some((i) => i.variable === "DATABASE_URL"),
    ).toBe(true);

    expect(
      collectProductionEnvIssues({
        ...completeProduction,
        DATABASE_URL:
          "mongodb+srv://user:secret@cluster0.example.mongodb.net/wrong_db?retryWrites=true",
      }).some((i) => i.variable === "DATABASE_URL"),
    ).toBe(true);
  });

  it("UAT tier requires fg_online_uat and forbids production DB name", () => {
    const issues = collectProductionEnvIssues({
      ...completeProduction,
      NELNA_DEPLOY_TIER: "uat",
      DATABASE_URL:
        "mongodb+srv://user:secret@cluster0.example.mongodb.net/fg_online_uat?retryWrites=true",
      API_CORS_ORIGIN: "https://fg-uat.nelna.lk",
    });
    expect(issues).toEqual([]);

    const blocked = collectProductionEnvIssues({
      ...completeProduction,
      NELNA_DEPLOY_TIER: "uat",
      DATABASE_URL:
        "mongodb+srv://user:secret@cluster0.example.mongodb.net/fg_online?retryWrites=true",
      API_CORS_ORIGIN: "https://fg-uat.nelna.lk",
    });
    expect(blocked.some((i) => i.variable === "DATABASE_URL")).toBe(true);
  });

  it("accepts APP_BUILD_ID as the production build identifier", () => {
    expect(
      collectProductionEnvIssues({
        ...completeProduction,
        APP_BUILD_ID: "explicit-build-id",
        RENDER: undefined,
        RENDER_GIT_COMMIT: undefined,
      }),
    ).toEqual([]);
  });

  it("accepts RENDER_GIT_COMMIT when RENDER=true and APP_BUILD_ID is absent", () => {
    expect(
      collectProductionEnvIssues({
        ...completeProduction,
        APP_BUILD_ID: undefined,
        RENDER: "true",
        RENDER_GIT_COMMIT: "abc1234deadbeef",
      }),
    ).toEqual([]);
  });

  it("does not accept RENDER_GIT_COMMIT outside Render", () => {
    const issues = collectProductionEnvIssues({
      ...completeProduction,
      APP_BUILD_ID: undefined,
      RENDER: undefined,
      RENDER_GIT_COMMIT: "abc1234deadbeef",
    });
    expect(issues.some((i) => i.variable === "APP_BUILD_ID")).toBe(true);
  });

  it("rejects production when both APP_BUILD_ID and Render commit are missing", () => {
    const issues = collectProductionEnvIssues({
      ...completeProduction,
      APP_BUILD_ID: undefined,
      RENDER: "true",
      RENDER_GIT_COMMIT: undefined,
    });
    expect(issues.some((i) => i.variable === "APP_BUILD_ID")).toBe(true);

    const outsideRender = collectProductionEnvIssues({
      ...completeProduction,
      APP_BUILD_ID: "",
      RENDER: "false",
      RENDER_GIT_COMMIT: "",
    });
    expect(outsideRender.some((i) => i.variable === "APP_BUILD_ID")).toBe(true);
  });

  it("assertProductionEnv throws with readable detail", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "production" })).toThrow(
      /Refusing to start Nelna FG API/,
    );
  });

  it("never includes password material in issue messages", () => {
    const issues = collectProductionEnvIssues({
      ...completeProduction,
      DATABASE_URL:
        "mongodb+srv://testuser:FakePasswordForRedactionTest99@cluster0.example.mongodb.net/bad",
    });
    const blob = JSON.stringify(issues);
    expect(blob).not.toMatch(/FakePasswordForRedactionTest99/);
    expect(blob).not.toMatch(/testuser:Fake/);
  });
});

describe("same-origin cookie mode helper", () => {
  it("defaults to same-origin when COOKIE_DOMAIN is empty", () => {
    expect(isSameOriginCookieMode({})).toBe(true);
    expect(isSameOriginCookieMode({ COOKIE_DOMAIN: "" })).toBe(true);
  });

  it("honours explicit NELNA_COOKIE_MODE", () => {
    expect(isSameOriginCookieMode({ NELNA_COOKIE_MODE: "same_origin" })).toBe(true);
    expect(
      isSameOriginCookieMode({
        NELNA_COOKIE_MODE: "cross_subdomain",
        COOKIE_DOMAIN: ".nelna.lk",
      }),
    ).toBe(false);
  });
});

describe("mongo url helpers", () => {
  it("detects mongodb schemes", () => {
    expect(isMongoConnectionUrl("mongodb://localhost:27017/fg_online")).toBe(true);
    expect(isMongoConnectionUrl("mongodb+srv://h/fg_online")).toBe(true);
    expect(isMongoConnectionUrl("postgresql://h/db")).toBe(false);
  });

  it("extracts database name without exposing credentials", () => {
    expect(
      extractMongoDatabaseName(
        "mongodb+srv://user:pass@cluster0.example.mongodb.net/fg_online?retryWrites=true",
      ),
    ).toBe("fg_online");
  });
});

describe("CORS origin policy", () => {
  it("production allows only the configured frontend origin", () => {
    const env = {
      NODE_ENV: "production",
      API_CORS_ORIGIN: PRODUCTION_FRONTEND_ORIGIN,
    };
    expect(isCorsOriginAllowed("https://fg.nelna.lk", env)).toBe(true);
    expect(isCorsOriginAllowed("http://localhost:3000", env)).toBe(false);
    expect(isCorsOriginAllowed("https://evil.example", env)).toBe(false);
    expect(buildCorsOptions(env).credentials).toBe(true);
  });

  it("non-production allows localhost and rejects arbitrary origins", () => {
    const env = { NODE_ENV: "development", API_CORS_ORIGIN: "http://localhost:3000" };
    expect(isCorsOriginAllowed("http://localhost:3000", env)).toBe(true);
    expect(isCorsOriginAllowed("https://fg.nelna.lk", env)).toBe(false);
  });
});
