/**
 * Verify the username-based SYSTEM_ADMINISTRATOR exists and can manage users.
 *
 * Required env:
 *   BOOTSTRAP_ADMIN_USERNAME (or VERIFY_ADMIN_USERNAME)
 *   DATABASE_URL → fg_online
 *
 * Output never includes secrets.
 */
import { PrismaClient } from "../generated/prisma-client";
import { normalizeUsername } from "@nelna/shared";
import {
  assertBootstrapDatabaseUrl,
  BOOTSTRAP_ADMIN_ROLE,
  redactBootstrapErrorMessage,
} from "../src/database/bootstrap-admin-rules";

async function main(): Promise<void> {
  assertBootstrapDatabaseUrl(process.env.DATABASE_URL);

  const rawUsername = (
    process.env.VERIFY_ADMIN_USERNAME ??
    process.env.BOOTSTRAP_ADMIN_USERNAME ??
    ""
  ).trim();
  if (!rawUsername) {
    throw new Error("BOOTSTRAP_ADMIN_USERNAME or VERIFY_ADMIN_USERNAME is required");
  }
  const username = normalizeUsername(rawUsername);

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error(`Administrator username=${username} not found`);
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const usersManage = user.userRoles.some((ur) =>
      ur.role.rolePermissions.some((rp) => rp.permission.key === "users:manage"),
    );
    const activeSessions = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    console.log(`username=${user.username}`);
    console.log(`employeeCode=${user.employeeCode}`);
    console.log(`status=${user.status}`);
    console.log(`roles=${roles.join(",") || "none"}`);
    console.log(`usersManage=${usersManage}`);
    console.log(`mustChangePassword=${user.mustChangePassword}`);
    console.log(`activeSessionCount=${activeSessions}`);
    console.log(
      `systemAdministrator=${roles.includes(BOOTSTRAP_ADMIN_ROLE) && user.status === "ACTIVE"}`,
    );

    if (
      user.status !== "ACTIVE" ||
      !roles.includes(BOOTSTRAP_ADMIN_ROLE) ||
      !usersManage
    ) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redactBootstrapErrorMessage(message));
  process.exit(1);
});
