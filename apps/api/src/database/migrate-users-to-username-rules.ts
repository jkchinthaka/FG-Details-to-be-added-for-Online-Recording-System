/**
 * Pure validation helpers for the username migration script.
 * Never log passwords, password hashes, or DATABASE_URL from call sites.
 */
import {
  archivedUsernameForEmployeeCode,
  isValidUsername,
  normalizeUsername,
  PASSWORD_MIN_LENGTH,
} from "@nelna/shared";
import { assertDatabaseIsFgOnline, parseCleanupMode } from "./sample-data-rules";
import {
  extractMongoDatabaseName,
  isMongoConnectionUrl,
} from "../config/validate-production-env";

export const USERNAME_BOOTSTRAP_ADMIN_ENV_KEYS = [
  "USERNAME_BOOTSTRAP_ADMIN_USERNAME",
  "USERNAME_BOOTSTRAP_ADMIN_PASSWORD",
  "USERNAME_BOOTSTRAP_ADMIN_EMPLOYEE_CODE",
  "USERNAME_BOOTSTRAP_ADMIN_FULL_NAME",
] as const;

export const USERNAME_BOOTSTRAP_ADMIN_ROLE = "SYSTEM_ADMINISTRATOR" as const;
export const USERNAME_MIGRATION_BCRYPT_ROUNDS = 12;

export type UsernameBootstrapAdminInput = {
  username: string;
  password: string;
  employeeCode: string;
  fullName: string;
  email?: string;
};

export type UsernameMigrationValidationIssue = {
  field: string;
  message: string;
};

export function readUsernameBootstrapAdminInput(env: NodeJS.ProcessEnv = process.env): {
  input?: UsernameBootstrapAdminInput;
  issues: UsernameMigrationValidationIssue[];
} {
  const issues: UsernameMigrationValidationIssue[] = [];

  const rawUsername = (env.USERNAME_BOOTSTRAP_ADMIN_USERNAME ?? "").trim();
  const username = rawUsername ? normalizeUsername(rawUsername) : "";
  const password = env.USERNAME_BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const employeeCode = (env.USERNAME_BOOTSTRAP_ADMIN_EMPLOYEE_CODE ?? "").trim();
  const fullName = (env.USERNAME_BOOTSTRAP_ADMIN_FULL_NAME ?? "").trim();
  const emailRaw = (env.USERNAME_BOOTSTRAP_ADMIN_EMAIL ?? "").trim();
  const email = emailRaw || undefined;

  if (!username) {
    issues.push({ field: "USERNAME_BOOTSTRAP_ADMIN_USERNAME", message: "Required" });
  } else if (!isValidUsername(username)) {
    issues.push({
      field: "USERNAME_BOOTSTRAP_ADMIN_USERNAME",
      message: "Must be a valid username (4–40 chars, lowercase alphanumeric . _ -)",
    });
  }

  if (!password) {
    issues.push({ field: "USERNAME_BOOTSTRAP_ADMIN_PASSWORD", message: "Required" });
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push({
      field: "USERNAME_BOOTSTRAP_ADMIN_PASSWORD",
      message: `Must be at least ${PASSWORD_MIN_LENGTH} characters`,
    });
  }

  if (!employeeCode) {
    issues.push({
      field: "USERNAME_BOOTSTRAP_ADMIN_EMPLOYEE_CODE",
      message: "Required",
    });
  }

  if (!fullName) {
    issues.push({ field: "USERNAME_BOOTSTRAP_ADMIN_FULL_NAME", message: "Required" });
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    input: { username, password, employeeCode, fullName, email },
    issues: [],
  };
}

export function assertUsernameMigrationDatabaseUrl(
  databaseUrl: string | undefined,
): void {
  const trimmed = (databaseUrl ?? "").trim();
  if (!trimmed) {
    throw new Error("DATABASE_URL is required for username migration");
  }
  if (!isMongoConnectionUrl(trimmed)) {
    throw new Error("DATABASE_URL must be a MongoDB connection string");
  }
  const dbName = extractMongoDatabaseName(trimmed);
  assertDatabaseIsFgOnline(dbName);
}

export function parseUsernameMigrationMode(argv: string[]): "dry-run" | "execute" {
  return parseCleanupMode(argv);
}

export function formatUsernameMigrationValidationError(
  issues: UsernameMigrationValidationIssue[],
): string {
  const detail = issues.map((i) => `  - ${i.field}: ${i.message}`).join("\n");
  return `Username migration rejected invalid input:\n${detail}`;
}

export type LegacyUserMigrationPlan = {
  userId: string;
  employeeCode: string;
  archivedUsername: string;
  isReplacementAdmin: boolean;
};

export type UserRelationCounts = {
  createdRecords: number;
  checkedRecords: number;
  verifiedRecords: number;
  uploadedAttachments: number;
  decidedApprovals: number;
  createdCorrectiveActions: number;
  assignedCorrectiveActions: number;
  verifiedCorrectiveActions: number;
  closedCorrectiveActions: number;
  uploadedCorrectiveEvidence: number;
  publishedTemplateVersions: number;
  createdTemplates: number;
  decidedTruckLoadings: number;
  notifications: number;
  auditLogs: number;
  taskAssignments: number;
};

export function userHasHistoricalRelations(counts: UserRelationCounts): boolean {
  return Object.values(counts).some((count) => count > 0);
}

export function planLegacyUserMigration(args: {
  userId: string;
  employeeCode: string;
  username: string | null;
  replacementAdminEmployeeCode: string;
  replacementAdminUsername: string;
}): LegacyUserMigrationPlan {
  const isReplacementAdmin =
    args.employeeCode === args.replacementAdminEmployeeCode ||
    (args.username !== null &&
      normalizeUsername(args.username) ===
        normalizeUsername(args.replacementAdminUsername));

  const archivedUsername =
    args.username ?? archivedUsernameForEmployeeCode(args.employeeCode);

  return {
    userId: args.userId,
    employeeCode: args.employeeCode,
    archivedUsername,
    isReplacementAdmin,
  };
}
