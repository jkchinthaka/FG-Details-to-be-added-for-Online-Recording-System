import type { UserRole } from "@nelna/shared";
import type { Prisma } from "../../generated/prisma-client";
import type { AdminUserSummary } from "./users.types";

export const USER_WITH_RELATIONS_INCLUDE = {
  department: true,
  section: true,
  userRoles: { include: { role: true } },
} satisfies Prisma.UserInclude;

export type UserWithRelations = Prisma.UserGetPayload<{
  include: typeof USER_WITH_RELATIONS_INCLUDE;
}>;

/** Never spreads the raw Prisma row — this is the one place a `passwordHash`
 *  could otherwise leak into a response, so every field is listed explicitly. */
export function toAdminUserSummary(user: UserWithRelations): AdminUserSummary {
  return {
    id: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    email: user.email,
    status: user.status,
    department: user.department
      ? { id: user.department.id, name: user.department.name, code: user.department.code }
      : null,
    section: user.section
      ? { id: user.section.id, name: user.section.name, code: user.section.code }
      : null,
    roles: user.userRoles.map((userRole) => userRole.role.name as UserRole),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
