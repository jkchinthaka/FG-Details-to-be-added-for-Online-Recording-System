/**
 * Pure planning helpers for username cutover.
 * Never log passwords, hashes, or DATABASE_URL.
 */
import {
  archivedUsernameForEmployeeCode,
  isValidUsername,
  normalizeUsername,
} from "@nelna/shared";
import {
  assertBootstrapDatabaseUrl,
  readBootstrapAdminInput,
  type BootstrapAdminInput,
} from "./bootstrap-admin-rules";
import { parseCleanupMode } from "./sample-data-rules";

export const CUTOVER_BCRYPT_ROUNDS = 12;
export const CUTOVER_ADMIN_ROLE = "SYSTEM_ADMINISTRATOR" as const;

export type CutoverMode = "dry-run" | "execute";

export type CutoverUserSnapshot = {
  id: string;
  employeeCode: string;
  username: string | null;
  email: string | null;
  status: string;
};

export type CutoverPlanItem = {
  userId: string;
  employeeCode: string;
  action: "ensure-admin" | "archive" | "skip-already-archived" | "skip-admin";
  archivedUsername?: string;
};

export type CutoverConflict = {
  code:
    | "DUPLICATE_EMPLOYEE_CODE"
    | "DUPLICATE_USERNAME"
    | "INVALID_USERNAME"
    | "ARCHIVED_USERNAME_COLLISION"
    | "MISSING_ADMIN_ROLE";
  detail: string;
};

export function parseCutoverMode(argv: string[]): CutoverMode {
  return parseCleanupMode(argv);
}

export function readCutoverAdminInput(env: NodeJS.ProcessEnv = process.env): {
  input?: BootstrapAdminInput;
  issues: { field: string; message: string }[];
} {
  return readBootstrapAdminInput(env);
}

export function assertCutoverDatabaseUrl(databaseUrl: string | undefined): void {
  assertBootstrapDatabaseUrl(databaseUrl);
}

export function isReplacementAdmin(
  user: CutoverUserSnapshot,
  admin: BootstrapAdminInput,
): boolean {
  if (user.employeeCode === admin.employeeCode) return true;
  if (
    user.username &&
    normalizeUsername(user.username) === normalizeUsername(admin.username)
  ) {
    return true;
  }
  return false;
}

export function detectCutoverConflicts(args: {
  users: CutoverUserSnapshot[];
  admin: BootstrapAdminInput;
  hasAdminRole: boolean;
}): CutoverConflict[] {
  const conflicts: CutoverConflict[] = [];
  if (!args.hasAdminRole) {
    conflicts.push({
      code: "MISSING_ADMIN_ROLE",
      detail: `${CUTOVER_ADMIN_ROLE} role is required`,
    });
  }

  if (!isValidUsername(normalizeUsername(args.admin.username))) {
    conflicts.push({
      code: "INVALID_USERNAME",
      detail: `Administrator username is invalid`,
    });
  }

  const employeeCodes = new Map<string, number>();
  const usernames = new Map<string, number>();

  for (const user of args.users) {
    employeeCodes.set(user.employeeCode, (employeeCodes.get(user.employeeCode) ?? 0) + 1);
    if (user.username) {
      const normalized = normalizeUsername(user.username);
      if (!isValidUsername(normalized)) {
        conflicts.push({
          code: "INVALID_USERNAME",
          detail: `Invalid username on employeeCode=${user.employeeCode}`,
        });
      }
      usernames.set(normalized, (usernames.get(normalized) ?? 0) + 1);
    }
  }

  for (const [code, count] of employeeCodes) {
    if (count > 1) {
      conflicts.push({
        code: "DUPLICATE_EMPLOYEE_CODE",
        detail: `employeeCode=${code} count=${count}`,
      });
    }
  }

  for (const [username, count] of usernames) {
    if (count > 1) {
      conflicts.push({
        code: "DUPLICATE_USERNAME",
        detail: `username=${username} count=${count}`,
      });
    }
  }

  const plannedArchived = new Set<string>();
  for (const user of args.users) {
    if (isReplacementAdmin(user, args.admin)) continue;
    const archived = user.username ?? archivedUsernameForEmployeeCode(user.employeeCode);
    if (plannedArchived.has(archived) || usernames.get(archived)) {
      if (archived !== normalizeUsername(args.admin.username)) {
        conflicts.push({
          code: "ARCHIVED_USERNAME_COLLISION",
          detail: `archived username collision for employeeCode=${user.employeeCode}`,
        });
      }
    }
    plannedArchived.add(archived);
  }

  return conflicts;
}

export function buildCutoverPlan(args: {
  users: CutoverUserSnapshot[];
  admin: BootstrapAdminInput;
}): CutoverPlanItem[] {
  const plan: CutoverPlanItem[] = [
    {
      userId: "admin-upsert",
      employeeCode: args.admin.employeeCode,
      action: "ensure-admin",
    },
  ];

  for (const user of args.users) {
    if (isReplacementAdmin(user, args.admin)) {
      plan.push({
        userId: user.id,
        employeeCode: user.employeeCode,
        action: "skip-admin",
      });
      continue;
    }

    const archivedUsername =
      user.username ?? archivedUsernameForEmployeeCode(user.employeeCode);
    const alreadyArchived =
      user.status === "INACTIVE" &&
      Boolean(user.username && normalizeUsername(user.username).startsWith("archived-"));

    plan.push({
      userId: user.id,
      employeeCode: user.employeeCode,
      action: alreadyArchived ? "skip-already-archived" : "archive",
      archivedUsername,
    });
  }

  return plan;
}

/** Pure post-condition checks used by tests and the execute verifier. */
export function verifyCutoverInvariants(args: {
  users: Array<{
    id: string;
    employeeCode: string;
    username: string | null;
    status: string;
    roles: string[];
  }>;
  adminEmployeeCode: string;
  adminUsername: string;
}): string[] {
  const failures: string[] = [];
  const usernames = new Set<string>();

  const admin = args.users.find((u) => u.employeeCode === args.adminEmployeeCode);
  if (!admin) {
    failures.push("replacement administrator missing");
  } else {
    if (admin.status !== "ACTIVE")
      failures.push("replacement administrator is not ACTIVE");
    if (admin.username !== normalizeUsername(args.adminUsername)) {
      failures.push("replacement administrator username mismatch");
    }
    if (!admin.roles.includes(CUTOVER_ADMIN_ROLE)) {
      failures.push("replacement administrator missing SYSTEM_ADMINISTRATOR");
    }
  }

  for (const user of args.users) {
    if (!user.username) {
      failures.push(`username null for employeeCode=${user.employeeCode}`);
      continue;
    }
    const normalized = normalizeUsername(user.username);
    if (usernames.has(normalized)) {
      failures.push(`duplicate username=${normalized}`);
    }
    usernames.add(normalized);

    if (
      user.employeeCode !== args.adminEmployeeCode &&
      user.status === "ACTIVE" &&
      !normalized.startsWith("archived-")
    ) {
      // Non-admin ACTIVE accounts after cutover are unexpected for default policy.
      failures.push(`active legacy account remains employeeCode=${user.employeeCode}`);
    }
  }

  const activeAdmins = args.users.filter(
    (u) => u.status === "ACTIVE" && u.roles.includes(CUTOVER_ADMIN_ROLE),
  );
  if (activeAdmins.length < 1) {
    failures.push("no ACTIVE SYSTEM_ADMINISTRATOR remains");
  }

  return failures;
}
