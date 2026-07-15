/**
 * One-time production administrator bootstrap.
 *
 * Required env (never commit real values):
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_PASSWORD
 *   BOOTSTRAP_ADMIN_EMPLOYEE_CODE
 *   BOOTSTRAP_ADMIN_FULL_NAME
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
    });
    if (!role) {
      throw new Error(
        `Role ${BOOTSTRAP_ADMIN_ROLE} not found — run production seed before bootstrap`,
      );
    }

    const passwordHash = await bcrypt.hash(input.password, BOOTSTRAP_BCRYPT_ROUNDS);

    const user = await prisma.user.upsert({
      where: { employeeCode: input.employeeCode },
      create: {
        employeeCode: input.employeeCode,
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      update: {
        employeeCode: input.employeeCode,
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        status: UserStatus.ACTIVE,
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

    const revoked = await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    // Safe success only — never password or hash.
    console.log(
      `Administrator bootstrap OK: email=${input.email} employeeCode=${input.employeeCode} refreshTokensCleared=${revoked.count}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // Guard against accidental secret leakage from nested drivers.
  const safe = message
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, "mongodb://***")
    .replace(/passwordHash["']?\s*[:=]\s*["'][^"']+["']/gi, "passwordHash:***");
  console.error(safe);
  process.exitCode = 1;
});
