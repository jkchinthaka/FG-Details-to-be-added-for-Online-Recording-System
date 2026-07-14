/**
 * Fails fast when critical production configuration is missing.
 * Dev/test remain permissive so local work does not require a full secret set.
 */
export type ProductionEnvIssue = { variable: string; message: string };

export function collectProductionEnvIssues(
  env: NodeJS.ProcessEnv = process.env,
): ProductionEnvIssue[] {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const issues: ProductionEnvIssue[] = [];

  const requireNonEmpty = (variable: string, hint: string) => {
    const value = env[variable];
    if (!value || !value.trim()) {
      issues.push({ variable, message: hint });
    }
  };

  requireNonEmpty("DATABASE_URL", "PostgreSQL connection string is required");
  requireNonEmpty("JWT_ACCESS_SECRET", "Access-token signing secret is required");
  requireNonEmpty("JWT_REFRESH_SECRET", "Refresh-token signing secret is required");
  requireNonEmpty("API_CORS_ORIGIN", "Explicit CORS origin is required in production");

  if ((env.COOKIE_SECURE ?? "").toLowerCase() !== "true") {
    issues.push({
      variable: "COOKIE_SECURE",
      message: 'Must be the string "true" when serving over HTTPS',
    });
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
