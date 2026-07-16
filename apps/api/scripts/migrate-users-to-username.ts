/**
 * Safe legacy user migration to username-based authentication.
 *
 * Required env (never commit real values):
 *   USERNAME_BOOTSTRAP_ADMIN_USERNAME
 *   USERNAME_BOOTSTRAP_ADMIN_PASSWORD
 *   USERNAME_BOOTSTRAP_ADMIN_EMPLOYEE_CODE
 *   USERNAME_BOOTSTRAP_ADMIN_FULL_NAME
 *   USERNAME_BOOTSTRAP_ADMIN_EMAIL (optional)
 *   DATABASE_URL (must target MongoDB database fg_online)
 *
 * Usage:
 *   pnpm --filter @nelna/api users:migrate:dry-run
 *   pnpm --filter @nelna/api users:migrate:execute
 *
 * Default is dry-run. Does not print passwords, hashes, or DATABASE_URL.
 */
import { randomBytes } from "node:crypto";
import * as bcrypt from "bcrypt";
import { PrismaClient, UserStatus } from "../generated/prisma-client";
import { normalizeUsername } from "@nelna/shared";
import {
  assertUsernameMigrationDatabaseUrl,
  formatUsernameMigrationValidationError,
  isConfirmedSampleUser,
  parseUsernameMigrationMode,
  planLegacyUserMigration,
  readUsernameBootstrapAdminInput,
  USERNAME_BOOTSTRAP_ADMIN_ROLE,
  USERNAME_MIGRATION_BCRYPT_ROUNDS,
  type UserRelationCounts,
} from "../src/database/migrate-users-to-username-rules";

async function countUserRelations(
  prisma: PrismaClient,
  userId: string,
): Promise<UserRelationCounts> {
  const [
    createdRecords,
    checkedRecords,
    verifiedRecords,
    uploadedAttachments,
    decidedApprovals,
    createdCorrectiveActions,
    assignedCorrectiveActions,
    verifiedCorrectiveActions,
    closedCorrectiveActions,
    uploadedCorrectiveEvidence,
    publishedTemplateVersions,
    createdTemplates,
    decidedTruckLoadings,
    notifications,
    auditLogs,
    taskAssignments,
  ] = await Promise.all([
    prisma.inspectionRecord.count({ where: { createdById: userId } }),
    prisma.inspectionRecord.count({ where: { checkedById: userId } }),
    prisma.inspectionRecord.count({ where: { verifiedById: userId } }),
    prisma.inspectionAttachment.count({ where: { uploadedById: userId } }),
    prisma.approvalRecord.count({ where: { decidedById: userId } }),
    prisma.correctiveAction.count({ where: { createdById: userId } }),
    prisma.correctiveAction.count({ where: { assigneeId: userId } }),
    prisma.correctiveAction.count({ where: { verifiedById: userId } }),
    prisma.correctiveAction.count({ where: { closedById: userId } }),
    prisma.correctiveActionEvidence.count({ where: { uploadedById: userId } }),
    prisma.checklistTemplateVersion.count({ where: { publishedById: userId } }),
    prisma.checklistTemplate.count({ where: { createdById: userId } }),
    prisma.truckInspectionDetail.count({ where: { loadingDecidedById: userId } }),
    prisma.notification.count({ where: { userId } }),
    prisma.auditLog.count({ where: { actorId: userId } }),
    prisma.taskAssignment.count({ where: { userId } }),
  ]);

  return {
    createdRecords,
    checkedRecords,
    verifiedRecords,
    uploadedAttachments,
    decidedApprovals,
    createdCorrectiveActions,
    assignedCorrectiveActions,
    verifiedCorrectiveActions,
    closedCorrectiveActions,
    uploadedCorrectiveEvidence,
    publishedTemplateVersions,
    createdTemplates,
    decidedTruckLoadings,
    notifications,
    auditLogs,
    taskAssignments,
  };
}

async function main(): Promise<void> {
  const mode = parseUsernameMigrationMode(process.argv.slice(2));
  assertUsernameMigrationDatabaseUrl(process.env.DATABASE_URL);

  const { input, issues } = readUsernameBootstrapAdminInput(process.env);
  if (!input || issues.length > 0) {
    throw new Error(formatUsernameMigrationValidationError(issues));
  }

  const prisma = new PrismaClient();
  const undisclosedPassword = randomBytes(32).toString("hex");
  const undisclosedHash = await bcrypt.hash(undisclosedPassword, USERNAME_MIGRATION_BCRYPT_ROUNDS);

  try {
    const adminRole = await prisma.role.findUnique({
      where: { name: USERNAME_BOOTSTRAP_ADMIN_ROLE },
    });
    if (!adminRole) {
      throw new Error(
        `Role ${USERNAME_BOOTSTRAP_ADMIN_ROLE} not found — run production seed before migration`,
      );
    }

    const replacementPasswordHash = await bcrypt.hash(
      input.password,
      USERNAME_MIGRATION_BCRYPT_ROUNDS,
    );

    const replacementAdminPlan = {
      employeeCode: input.employeeCode,
      username: input.username,
      fullName: input.fullName,
      email: input.email ?? null,
      passwordHash: replacementPasswordHash,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      deactivatedAt: null,
    };

    if (mode === "dry-run") {
      console.log(
        `DRY-RUN: would upsert replacement administrator username=${input.username} employeeCode=${input.employeeCode}`,
      );
    } else {
      const replacement = await prisma.user.upsert({
        where: { employeeCode: input.employeeCode },
        create: replacementAdminPlan,
        update: {
          username: input.username,
          fullName: input.fullName,
          email: input.email ?? null,
          passwordHash: replacementPasswordHash,
          status: UserStatus.ACTIVE,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          deactivatedAt: null,
        },
      });

      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: replacement.id, roleId: adminRole.id } },
        create: { userId: replacement.id, roleId: adminRole.id },
        update: {},
      });

      await prisma.refreshToken.updateMany({
        where: { userId: replacement.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      console.log(
        `Replacement administrator ready: username=${input.username} employeeCode=${input.employeeCode}`,
      );
    }

    const allUsers = await prisma.user.findMany({
      select: { id: true, employeeCode: true, username: true, email: true },
    });

    let archived = 0;
    let preserved = 0;
    let deleted = 0;

    for (const user of allUsers) {
      const relationCounts = await countUserRelations(prisma, user.id);
      const plan = planLegacyUserMigration({
        userId: user.id,
        employeeCode: user.employeeCode,
        username: user.username,
        replacementAdminEmployeeCode: input.employeeCode,
        replacementAdminUsername: input.username,
        relationCounts,
        isConfirmedSample: isConfirmedSampleUser(user),
      });

      if (plan.isReplacementAdmin) {
        continue;
      }

      if (plan.mayHardDelete) {
        if (mode === "dry-run") {
          console.log(`DRY-RUN: would delete unreferenced sample user id=${user.id}`);
          deleted += 1;
        } else {
          await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
          await prisma.userRole.deleteMany({ where: { userId: user.id } });
          await prisma.user.delete({ where: { id: user.id } });
          deleted += 1;
        }
        continue;
      }

      preserved += 1;
      if (mode === "dry-run") {
        console.log(
          `DRY-RUN: would archive user id=${user.id} username=${plan.archivedUsername} status=INACTIVE`,
        );
      } else {
        await prisma.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.INACTIVE,
            email: null,
            username: plan.archivedUsername,
            passwordHash: undisclosedHash,
            mustChangePassword: true,
            deactivatedAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
      }
      archived += 1;
    }

    console.log(
      `Username migration ${mode}: archived=${archived} preserved=${preserved} sampleDeleted=${deleted} totalUsers=${allUsers.length}`,
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
