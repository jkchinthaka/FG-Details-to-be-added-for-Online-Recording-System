/**
 * One-time production administrator bootstrap (username + password).
 *
 * Required env (never commit real values):
 *   BOOTSTRAP_ADMIN_USERNAME
 *   BOOTSTRAP_ADMIN_PASSWORD
 *   BOOTSTRAP_ADMIN_EMPLOYEE_CODE
 *   BOOTSTRAP_ADMIN_FULL_NAME
 *   BOOTSTRAP_ADMIN_EMAIL (optional)
 *   DATABASE_URL  (must target MongoDB database fg_online)
 *
 * Usage:
 *   pnpm --filter @nelna/api bootstrap:admin
 *
 * Does not print passwords, password hashes, or DATABASE_URL.
 */
import * as bcrypt from "bcrypt";
import { PrismaClient, UserStatus } from "../generated/prisma-client";
import {
  assertBootstrapDatabaseUrl,
  BOOTSTRAP_ADMIN_ROLE,
  BOOTSTRAP_BCRYPT_ROUNDS,
  formatBootstrapValidationError,
  readBootstrapAdminInput,
  redactBootstrapErrorMessage,
} from "../src/database/bootstrap-admin-rules";

async function main(): Promise<void> {
  assertBootstrapDatabaseUrl(process.env.DATABASE_URL);

  const { input, issues } = readBootstrapAdminInput(process.env);
  if (!input || issues.length > 0) {
    throw new Error(formatBootstrapValidationError(issues));
  }

  const prisma = new PrismaClient();

  try {
    const role = await prisma.role.findUnique({
      where: { name: BOOTSTRAP_ADMIN_ROLE },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    if (!role) {
      throw new Error(
        `Role ${BOOTSTRAP_ADMIN_ROLE} not found — run production reference-data seed before bootstrap`,
      );
    }

    const passwordHash = await bcrypt.hash(input.password, BOOTSTRAP_BCRYPT_ROUNDS);

    const user = await prisma.user.upsert({
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
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      create: {
        userId: user.id,
        roleId: role.id,
      },
      update: {},
    });

    const revoked = await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const verified = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (
      !verified ||
      verified.username !== input.username ||
      verified.status !== "ACTIVE"
    ) {
      throw new Error("Administrator bootstrap post-write verification failed");
    }

    const hasAdminRole = verified.userRoles.some(
      (ur) => ur.role.name === BOOTSTRAP_ADMIN_ROLE,
    );
    const hasUsersManage = verified.userRoles.some((ur) =>
      ur.role.rolePermissions.some((rp) => rp.permission.key === "users:manage"),
    );

    if (!hasAdminRole || !hasUsersManage) {
      throw new Error(
        "Administrator bootstrap verification failed: SYSTEM_ADMINISTRATOR / users:manage missing",
      );
    }

    console.log(
      `Administrator bootstrap OK: username=${input.username} employeeCode=${input.employeeCode} status=ACTIVE role=${BOOTSTRAP_ADMIN_ROLE} sessionsRevoked=${revoked.count}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redactBootstrapErrorMessage(message));
  process.exitCode = 1;
});
