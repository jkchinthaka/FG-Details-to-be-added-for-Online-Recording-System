/**
 * Pure validation helpers for the one-time production administrator bootstrap.
 * Never log passwords or DATABASE_URL from call sites that use these helpers.
 */
import {
  extractMongoDatabaseName,
  isMongoConnectionUrl,
} from "../config/validate-production-env";

export const BOOTSTRAP_ADMIN_ENV_KEYS = [
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PASSWORD",
  "BOOTSTRAP_ADMIN_EMPLOYEE_CODE",
  "BOOTSTRAP_ADMIN_FULL_NAME",
] as const;

export const BOOTSTRAP_ADMIN_ROLE = "SYSTEM_ADMINISTRATOR" as const;
export const BOOTSTRAP_BCRYPT_ROUNDS = 12;
export const BOOTSTRAP_MIN_PASSWORD_LENGTH = 12;

/** Loose but practical production email check (no delivery probe). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BootstrapAdminInput = {
  email: string;
  password: string;
  employeeCode: string;
  fullName: string;
};

export type BootstrapAdminValidationIssue = {
  field: string;
  message: string;
};

export function isValidBootstrapEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return EMAIL_PATTERN.test(trimmed);
}

export function readBootstrapAdminInput(env: NodeJS.ProcessEnv = process.env): {
  input?: BootstrapAdminInput;
  issues: BootstrapAdminValidationIssue[];
} {
  const issues: BootstrapAdminValidationIssue[] = [];

  const email = (env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const employeeCode = (env.BOOTSTRAP_ADMIN_EMPLOYEE_CODE ?? "").trim();
  const fullName = (env.BOOTSTRAP_ADMIN_FULL_NAME ?? "").trim();

  if (!email) {
    issues.push({
      field: "BOOTSTRAP_ADMIN_EMAIL",
      message: "Required",
    });
  } else if (!isValidBootstrapEmail(email)) {
    issues.push({
      field: "BOOTSTRAP_ADMIN_EMAIL",
      message: "Must be a valid email address",
    });
  }

  if (!password) {
    issues.push({
      field: "BOOTSTRAP_ADMIN_PASSWORD",
      message: "Required",
    });
  } else if (password.length < BOOTSTRAP_MIN_PASSWORD_LENGTH) {
    issues.push({
      field: "BOOTSTRAP_ADMIN_PASSWORD",
      message: `Must be at least ${BOOTSTRAP_MIN_PASSWORD_LENGTH} characters`,
    });
  }

  if (!employeeCode) {
    issues.push({
      field: "BOOTSTRAP_ADMIN_EMPLOYEE_CODE",
      message: "Required",
    });
  }

  if (!fullName) {
    issues.push({
      field: "BOOTSTRAP_ADMIN_FULL_NAME",
      message: "Required",
    });
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    input: {
      email: email.toLowerCase(),
      password,
      employeeCode,
      fullName,
    },
    issues: [],
  };
}

/**
 * Ensures DATABASE_URL targets production fg_online. Never return or log the URL.
 */
export function assertBootstrapDatabaseUrl(databaseUrl: string | undefined): void {
  const trimmed = (databaseUrl ?? "").trim();
  if (!trimmed) {
    throw new Error("DATABASE_URL is required for administrator bootstrap");
  }
  if (!isMongoConnectionUrl(trimmed)) {
    throw new Error("DATABASE_URL must be a MongoDB connection string");
  }
  const dbName = extractMongoDatabaseName(trimmed);
  if (dbName !== "fg_online") {
    throw new Error(
      `Administrator bootstrap refuses database "${dbName ?? "none"}" — only fg_online is allowed`,
    );
  }
}

export function formatBootstrapValidationError(
  issues: BootstrapAdminValidationIssue[],
): string {
  const detail = issues.map((i) => `  - ${i.field}: ${i.message}`).join("\n");
  return `Administrator bootstrap rejected invalid input:\n${detail}`;
}
