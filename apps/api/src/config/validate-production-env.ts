/**
 * Fails fast when critical production configuration is missing.
 * Dev/test remain permissive so local work does not require a full secret set.
 *
 * Production deploy target: Render API + Cloudflare Worker frontend + MongoDB Atlas.
 * Prefer same-origin browser traffic via `/api` proxy (COOKIE_DOMAIN optional).
 * Never log or return the raw DATABASE_URL (credentials).
 */
export type ProductionEnvIssue = { variable: string; message: string };

const PRODUCTION_FRONTEND_ORIGIN = "https://fg.nelna.lk";
const PRODUCTION_COOKIE_DOMAIN = ".nelna.lk";
const PRODUCTION_DB_NAME = "fg_online";
const UAT_DB_NAME = "fg_online_uat";

export function isMongoConnectionUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith("mongodb://") || trimmed.startsWith("mongodb+srv://");
}

/** Extract DB name from a Mongo URI without surfacing userinfo. */
export function extractMongoDatabaseName(databaseUrl: string): string | null {
  const trimmed = databaseUrl.trim();
  if (!trimmed) return null;
  try {
    const withoutProtocol = trimmed.replace(/^mongodb(\+srv)?:\/\//i, "");
    const afterAuth = withoutProtocol.includes("@")
      ? withoutProtocol.slice(withoutProtocol.lastIndexOf("@") + 1)
      : withoutProtocol;
    const pathAndQuery = afterAuth.includes("/")
      ? afterAuth.slice(afterAuth.indexOf("/") + 1)
      : "";
    const dbName = pathAndQuery.split("?")[0]?.trim() ?? "";
    return dbName || null;
  } catch {
    return null;
  }
}

function deployTier(env: NodeJS.ProcessEnv): "production" | "uat" {
  const raw = (env.NELNA_DEPLOY_TIER ?? "production").trim().toLowerCase();
  return raw === "uat" ? "uat" : "production";
}

/** Same-origin /api proxy: host-only cookies (no Domain). Cross-subdomain needs COOKIE_DOMAIN. */
export function isSameOriginCookieMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = (env.NELNA_COOKIE_MODE ?? "").trim().toLowerCase();
  if (mode === "same_origin") return true;
  if (mode === "cross_subdomain") return false;
  // Default when COOKIE_DOMAIN is unset: same-origin proxy (fg.nelna.lk → /api).
  return !(env.COOKIE_DOMAIN ?? "").trim();
}

function expectedFrontendOrigin(env: NodeJS.ProcessEnv): string {
  const fromPublic = (env.FRONTEND_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  if (fromPublic) return fromPublic;
  return PRODUCTION_FRONTEND_ORIGIN;
}

export function collectProductionEnvIssues(
  env: NodeJS.ProcessEnv = process.env,
): ProductionEnvIssue[] {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const issues: ProductionEnvIssue[] = [];
  const tier = deployTier(env);
  const sameOriginCookies = isSameOriginCookieMode(env);

  const requireNonEmpty = (variable: string, hint: string) => {
    const value = env[variable];
    if (!value || !value.trim()) {
      issues.push({ variable, message: hint });
    }
  };

  requireNonEmpty("DATABASE_URL", "MongoDB Atlas connection string is required");
  requireNonEmpty("JWT_ACCESS_SECRET", "Access-token signing secret is required");
  requireNonEmpty("JWT_REFRESH_SECRET", "Refresh-token signing secret is required");
  requireNonEmpty(
    "API_CORS_ORIGIN",
    "Explicit CORS origin is required (safety if the browser ever calls the API host directly)",
  );
  requireNonEmpty("ACCESS_TOKEN_TTL", "Access token TTL is required");
  requireNonEmpty("REFRESH_TOKEN_TTL", "Refresh token TTL is required");
  requireNonEmpty("APP_VERSION", "Release version label is required");

  // Render injects RENDER=true and RENDER_GIT_COMMIT; accept that when APP_BUILD_ID is unset.
  // Outside Render, APP_BUILD_ID remains mandatory (do not weaken non-Render production).
  const buildId =
    (env.APP_BUILD_ID ?? "").trim() ||
    (env.RENDER === "true" ? (env.RENDER_GIT_COMMIT ?? "").trim() : "");
  if (!buildId) {
    issues.push({
      variable: "APP_BUILD_ID",
      message:
        'Build identifier is required (set APP_BUILD_ID, or on Render rely on RENDER_GIT_COMMIT when RENDER="true")',
    });
  }

  if ((env.COOKIE_SECURE ?? "").toLowerCase() !== "true") {
    issues.push({
      variable: "COOKIE_SECURE",
      message: 'Must be the string "true" when serving over HTTPS',
    });
  }

  const cookieDomain = (env.COOKIE_DOMAIN ?? "").trim();
  if (sameOriginCookies) {
    // Host-only cookies for fg.nelna.lk + /api proxy — COOKIE_DOMAIN may be empty.
    if (cookieDomain) {
      issues.push({
        variable: "COOKIE_DOMAIN",
        message:
          'Leave empty for same-origin proxy mode, or set NELNA_COOKIE_MODE=cross_subdomain with COOKIE_DOMAIN=".nelna.lk"',
      });
    }
  } else if (!cookieDomain) {
    issues.push({
      variable: "COOKIE_DOMAIN",
      message: `Required for cross-subdomain auth (expected "${PRODUCTION_COOKIE_DOMAIN}")`,
    });
  } else if (cookieDomain !== PRODUCTION_COOKIE_DOMAIN) {
    issues.push({
      variable: "COOKIE_DOMAIN",
      message: `Must be "${PRODUCTION_COOKIE_DOMAIN}" for fg.nelna.lk / fg-api.nelna.lk`,
    });
  }

  const corsOrigin = (env.API_CORS_ORIGIN ?? "").trim().replace(/\/$/, "");
  const expectedCors = expectedFrontendOrigin(env);
  if (tier === "production") {
    if (corsOrigin && corsOrigin !== expectedCors) {
      issues.push({
        variable: "API_CORS_ORIGIN",
        message: `Must be "${expectedCors}" for production tier (or set FRONTEND_PUBLIC_URL to match)`,
      });
    }
  } else if (corsOrigin === PRODUCTION_FRONTEND_ORIGIN) {
    issues.push({
      variable: "API_CORS_ORIGIN",
      message: "UAT tier must not reuse the production frontend origin",
    });
  }

  const databaseUrl = (env.DATABASE_URL ?? "").trim();
  if (databaseUrl) {
    if (!isMongoConnectionUrl(databaseUrl)) {
      issues.push({
        variable: "DATABASE_URL",
        message:
          "Must use mongodb:// or mongodb+srv:// (PostgreSQL URLs are not valid for this deploy)",
      });
    } else {
      const dbName = extractMongoDatabaseName(databaseUrl);
      const expected = tier === "uat" ? UAT_DB_NAME : PRODUCTION_DB_NAME;
      if (dbName !== expected) {
        issues.push({
          variable: "DATABASE_URL",
          message:
            tier === "uat"
              ? `UAT must target database "${UAT_DB_NAME}" (not production "${PRODUCTION_DB_NAME}")`
              : `Production must target database "${PRODUCTION_DB_NAME}"`,
        });
      }
      const lower = databaseUrl.toLowerCase();
      if (
        lower.includes("<db_password>") ||
        lower.includes("changeme") ||
        lower.includes(":<password>@") ||
        /:(?:|null|password)@/i.test(databaseUrl)
      ) {
        issues.push({
          variable: "DATABASE_URL",
          message: "Placeholder or empty credentials are not allowed in production",
        });
      }
    }
  }

  const access = env.JWT_ACCESS_SECRET ?? "";
  const refresh = env.JWT_REFRESH_SECRET ?? "";
  if (access && refresh && access === refresh) {
    issues.push({
      variable: "JWT_REFRESH_SECRET",
      message: "Must differ from JWT_ACCESS_SECRET",
    });
  }

  if (
    access.toLowerCase().includes("dev-only") ||
    refresh.toLowerCase().includes("dev-only")
  ) {
    issues.push({
      variable: "JWT_ACCESS_SECRET / JWT_REFRESH_SECRET",
      message: "Dev-only placeholder secrets are not allowed in production",
    });
  }

  return issues;
}

export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  const issues = collectProductionEnvIssues(env);
  if (issues.length === 0) {
    return;
  }
  const detail = issues.map((i) => `  - ${i.variable}: ${i.message}`).join("\n");
  throw new Error(
    `Refusing to start Nelna FG API: missing or invalid production configuration.\n${detail}`,
  );
}

/** Safe diagnostic payload — never includes host, user, or password. */
export function getSafeDatabaseConfigDiagnostic(env: NodeJS.ProcessEnv = process.env): {
  provider: "MongoDB" | "unknown" | "not_configured";
  databaseConnectedHint: "configured" | "missing";
  databaseName: string | null;
  clusterDetails: "hidden";
  credentials: "hidden";
} {
  const url = (env.DATABASE_URL ?? "").trim();
  if (!url) {
    return {
      provider: "not_configured",
      databaseConnectedHint: "missing",
      databaseName: null,
      clusterDetails: "hidden",
      credentials: "hidden",
    };
  }
  return {
    provider: isMongoConnectionUrl(url) ? "MongoDB" : "unknown",
    databaseConnectedHint: "configured",
    databaseName: isMongoConnectionUrl(url) ? extractMongoDatabaseName(url) : null,
    clusterDetails: "hidden",
    credentials: "hidden",
  };
}
