/**
 * Production-safe username cutover.
 *
 * Defaults to dry-run. Use --execute only against fg_online with explicit approval.
 *
 * Required env:
 *   BOOTSTRAP_ADMIN_USERNAME
 *   BOOTSTRAP_ADMIN_PASSWORD
 *   BOOTSTRAP_ADMIN_EMPLOYEE_CODE
 *   BOOTSTRAP_ADMIN_FULL_NAME
 *   BOOTSTRAP_ADMIN_EMAIL (optional)
 *   DATABASE_URL (must target fg_online)
 *
 * Never prints passwords, hashes, DATABASE_URL, JWTs, or cookies.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import * as bcrypt from "bcrypt";
import { PrismaClient, UserStatus } from "../generated/prisma-client";
import { normalizeUsername } from "@nelna/shared";
import {
  assertCutoverDatabaseUrl,
  buildCutoverPlan,
  CUTOVER_ADMIN_ROLE,
  CUTOVER_BCRYPT_ROUNDS,
  detectCutoverConflicts,
  parseCutoverMode,
  readCutoverAdminInput,
  verifyCutoverInvariants,
  type CutoverUserSnapshot,
} from "../src/database/cutover-users-to-username-rules";
import {
  formatBootstrapValidationError,
  redactBootstrapErrorMessage,
} from "../src/database/bootstrap-admin-rules";

function reportPath(mode: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(process.cwd(), "reports");
  mkdirSync(dir, { recursive: true });
  return join(dir, `user-cutover-${mode}-${stamp}.json`);
}

function writeSafeReport(path: string, payload: Record<string, unknown>): void {
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
}

async function main(): Promise<void> {
  const mode = parseCutoverMode(process.argv.slice(2));
  assertCutoverDatabaseUrl(process.env.DATABASE_URL);

  const { input, issues } = readCutoverAdminInput(process.env);
  if (!input || issues.length > 0) {
    throw new Error(formatBootstrapValidationError(issues));
  }

  const prisma = new PrismaClient();
  const reportFile = reportPath(mode);

  try {
    const adminRole = await prisma.role.findUnique({
      where: { name: CUTOVER_ADMIN_ROLE },
      include: { rolePermissions: { include: { permission: true } } },
    });

    const usersRaw = await prisma.user.findMany({
      select: {
        id: true,
        employeeCode: true,
        username: true,
        email: true,
        status: true,
      },
    });

    const users: CutoverUserSnapshot[] = usersRaw.map((u) => ({
      id: u.id,
      employeeCode: u.employeeCode,
      username: u.username,
      email: u.email,
      status: u.status,
    }));

    const conflicts = detectCutoverConflicts({
      users,
      admin: input,
      hasAdminRole: Boolean(adminRole),
    });
    const plan = buildCutoverPlan({ users, admin: input });

    const dryReport = {
      mode,
      databaseName: "fg_online",
      adminUsername: input.username,
      adminEmployeeCode: input.employeeCode,
      conflictCount: conflicts.length,
      conflicts,
      plan: plan.map((p) => ({
        userId: p.userId,
        employeeCode: p.employeeCode,
        action: p.action,
        archivedUsername: p.archivedUsername ?? null,
      })),
      totals: {
        ensureAdmin: plan.filter((p) => p.action === "ensure-admin").length,
        archive: plan.filter((p) => p.action === "archive").length,
        skipAdmin: plan.filter((p) => p.action === "skip-admin").length,
        skipAlreadyArchived: plan.filter((p) => p.action === "skip-already-archived")
          .length,
      },
    };

    if (conflicts.length > 0) {
      writeSafeReport(reportFile, { ...dryReport, aborted: true });
      throw new Error(
        `Cutover aborted: ${conflicts.length} conflict(s) — see ${reportFile}`,
      );
    }

    if (mode === "dry-run") {
      writeSafeReport(reportFile, dryReport);
      console.log(
        `DRY-RUN complete: archive=${dryReport.totals.archive} skipAdmin=${dryReport.totals.skipAdmin} report=${reportFile}`,
      );
      return;
    }

    if (!adminRole) {
      throw new Error(`Role ${CUTOVER_ADMIN_ROLE} not found`);
    }

    const passwordHash = await bcrypt.hash(input.password, CUTOVER_BCRYPT_ROUNDS);

    const adminUser = await prisma.user.upsert({
      where: { employeeCode: input.employeeCode },
      create: {
        employeeCode: input.employeeCode,
        username: input.username,
        email: input.email ?? null,
        fullName: input.fullName,
        passwordHash,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        passwordChangedAt: null,
        deactivatedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      update: {
        username: input.username,
        email: input.email ?? null,
        fullName: input.fullName,
        passwordHash,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        passwordChangedAt: null,
        deactivatedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
      create: { userId: adminUser.id, roleId: adminRole.id },
      update: {},
    });

    await prisma.refreshToken.updateMany({
      where: { userId: adminUser.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const adminCheck = await prisma.user.findUnique({
      where: { id: adminUser.id },
      include: {
        userRoles: {
          include: {
            role: { include: { rolePermissions: { include: { permission: true } } } },
          },
        },
      },
    });

    const hasUsersManage = Boolean(
      adminCheck?.userRoles.some((ur) =>
        ur.role.rolePermissions.some((rp) => rp.permission.key === "users:manage"),
      ),
    );

    if (
      !adminCheck ||
      adminCheck.status !== "ACTIVE" ||
      adminCheck.username !== input.username ||
      !adminCheck.userRoles.some((ur) => ur.role.name === CUTOVER_ADMIN_ROLE) ||
      !hasUsersManage
    ) {
      throw new Error("Replacement administrator verification failed — aborting cutover");
    }

    let archived = 0;
    for (const item of plan) {
      if (item.action !== "archive" || !item.archivedUsername) continue;
      if (item.userId === adminUser.id) {
        throw new Error(
          "Safety abort: plan attempted to archive replacement administrator",
        );
      }

      const uniqueSecret = randomBytes(32).toString("hex");
      const undisclosedHash = await bcrypt.hash(uniqueSecret, CUTOVER_BCRYPT_ROUNDS);

      await prisma.refreshToken.updateMany({
        where: { userId: item.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await prisma.user.update({
        where: { id: item.userId },
        data: {
          username: item.archivedUsername,
          email: null,
          passwordHash: undisclosedHash,
          status: UserStatus.INACTIVE,
          mustChangePassword: true,
          deactivatedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      archived += 1;
    }

    const after = await prisma.user.findMany({
      include: { userRoles: { include: { role: true } } },
    });

    const failures = verifyCutoverInvariants({
      adminEmployeeCode: input.employeeCode,
      adminUsername: input.username,
      users: after.map((u) => ({
        id: u.id,
        employeeCode: u.employeeCode,
        username: u.username,
        status: u.status,
        roles: u.userRoles.map((ur) => ur.role.name),
      })),
    });

    if (failures.length > 0) {
      writeSafeReport(reportFile, {
        mode,
        aborted: true,
        failures,
        archived,
        adminUsername: input.username,
      });
      throw new Error(`Cutover post-verification failed: ${failures.join("; ")}`);
    }

    writeSafeReport(reportFile, {
      mode,
      archived,
      adminUsername: input.username,
      adminEmployeeCode: input.employeeCode,
      totalUsers: after.length,
      failures: [],
    });

    console.log(
      `EXECUTE complete: archived=${archived} adminUsername=${input.username} report=${reportFile}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redactBootstrapErrorMessage(message));
  process.exit(1);
});
