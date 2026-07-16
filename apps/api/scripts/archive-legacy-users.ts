/**
 * One-time legacy user archival for username/password cutover.
 *
 * Default mode is dry-run.
 * Usage:
 *   pnpm --filter @nelna/api users:migrate:dry-run
 *   pnpm --filter @nelna/api users:migrate:execute
 *
 * Safety:
 * - Requires DATABASE_URL targeting fg_online.
 * - Never logs DATABASE_URL, passwords, or password hashes.
 * - Preserves user rows and all historical relations.
 */
import { randomBytes } from "node:crypto";
import * as bcrypt from "bcrypt";
import { PrismaClient, UserStatus } from "../generated/prisma-client";
import {
  archivedUsernameForEmployeeCode,
  normalizeUsername,
} from "@nelna/shared";
import {
  assertUsernameMigrationDatabaseUrl,
  parseUsernameMigrationMode,
  USERNAME_MIGRATION_BCRYPT_ROUNDS,
} from "../src/database/migrate-users-to-username-rules";

function isArchivedUsername(username: string | null): boolean {
  return Boolean(username && normalizeUsername(username).startsWith("archived-"));
}

async function main(): Promise<void> {
  const mode = parseUsernameMigrationMode(process.argv.slice(2));
  assertUsernameMigrationDatabaseUrl(process.env.DATABASE_URL);

  const prisma = new PrismaClient();
  const undisclosedPassword = randomBytes(32).toString("hex");
  const undisclosedHash = await bcrypt.hash(undisclosedPassword, USERNAME_MIGRATION_BCRYPT_ROUNDS);

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        employeeCode: true,
        username: true,
        status: true,
        mustChangePassword: true,
      },
    });

    let archived = 0;
    let unchanged = 0;

    for (const user of users) {
      const archivedUsername = user.username ?? archivedUsernameForEmployeeCode(user.employeeCode);
      const alreadyArchived =
        user.status === UserStatus.INACTIVE &&
        isArchivedUsername(user.username) &&
        user.mustChangePassword;

      if (alreadyArchived) {
        unchanged += 1;
        continue;
      }

      if (mode === "dry-run") {
        console.log(
          `DRY-RUN: would archive user id=${user.id} username=${archivedUsername} status=INACTIVE`,
        );
        archived += 1;
        continue;
      }

      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          username: user.username ?? archivedUsername,
          status: UserStatus.INACTIVE,
          passwordHash: undisclosedHash,
          mustChangePassword: true,
          deactivatedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      archived += 1;
    }

    console.log(
      `Legacy archive ${mode}: archived=${archived} unchanged=${unchanged} totalUsers=${users.length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const safe = message
    .replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "[redacted-database-url]")
    .replace(/password[=:]\S+/gi, "[redacted]")
    .replace(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, "[redacted-hash]");
  console.error(safe);
  process.exit(1);
});
