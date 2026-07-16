import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { UserRole } from "@nelna/shared";
import { normalizeUsername } from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, type UserStatus } from "../../generated/prisma-client";
import type { AssignDepartmentDto } from "./dto/assign-department.dto";
import type { AssignRolesDto } from "./dto/assign-roles.dto";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import {
  EmailConflictException,
  EmployeeCodeConflictException,
  LastActiveAdminProtectionException,
  UnknownRoleException,
  UsernameConflictException,
  UserNotFoundException,
} from "./users.errors";
import {
  USER_WITH_RELATIONS_INCLUDE,
  toAdminUserSummary,
  type UserWithRelations,
} from "./users.mappers";
import type {
  AdminPasswordResetResponse,
  AdminUserAccessHistoryResponse,
  AdminUserListResponse,
  AdminUserSummary,
} from "./users.types";

const BCRYPT_ROUNDS = 12;
const SYSTEM_ADMIN_ROLE: UserRole = "SYSTEM_ADMINISTRATOR";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type ListUsersQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  status?: string;
  role?: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Listing / retrieval
  // -------------------------------------------------------------------------

  async list(query: ListUsersQuery): Promise<AdminUserListResponse> {
    const page = query.page && query.page > 0 ? Math.trunc(query.page) : 1;
    const pageSize = clampPageSize(query.pageSize);

    const where: Prisma.UserWhereInput = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.status ? { status: query.status as UserStatus } : {}),
      ...(query.role ? { userRoles: { some: { role: { name: query.role } } } } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" } },
              { employeeCode: { contains: query.search, mode: "insensitive" } },
              { username: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: USER_WITH_RELATIONS_INCLUDE,
        orderBy: { fullName: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: items.map(toAdminUserSummary), total, page, pageSize };
  }

  async getById(id: string): Promise<AdminUserSummary> {
    const user = await this.findUserOrThrow(id);
    return toAdminUserSummary(user);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async create(dto: CreateUserDto, actorId: string): Promise<AdminUserSummary> {
    await this.assertEmployeeCodeAvailable(dto.employeeCode);
    const username = normalizeUsername(dto.username);
    await this.assertUsernameAvailable(username);
    if (dto.email) {
      await this.assertEmailAvailable(dto.email);
    }

    const roleIds = dto.roleNames ? await this.resolveRoleIds(dto.roleNames) : [];
    const passwordHash = await bcrypt.hash(dto.temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        employeeCode: dto.employeeCode,
        username,
        fullName: dto.fullName,
        email: dto.email ?? null,
        passwordHash,
        mustChangePassword: true,
        departmentId: dto.departmentId,
        sectionId: dto.sectionId,
        userRoles:
          roleIds.length > 0
            ? { create: roleIds.map((roleId) => ({ roleId })) }
            : undefined,
      },
      include: USER_WITH_RELATIONS_INCLUDE,
    });

    await this.recordAudit(actorId, "USER_CREATED", user.id, {
      roleNames: dto.roleNames ?? [],
    });
    return toAdminUserSummary(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<AdminUserSummary> {
    await this.findUserOrThrow(id);
    if (dto.employeeCode) {
      await this.assertEmployeeCodeAvailable(dto.employeeCode, id);
    }
    if (dto.email) {
      await this.assertEmailAvailable(dto.email, id);
    }
    if (dto.username) {
      await this.assertUsernameAvailable(normalizeUsername(dto.username), id);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        employeeCode: dto.employeeCode,
        fullName: dto.fullName,
        email: dto.email,
        username: dto.username ? normalizeUsername(dto.username) : undefined,
      },
      include: USER_WITH_RELATIONS_INCLUDE,
    });
    return toAdminUserSummary(user);
  }

  async activate(id: string, actorId: string): Promise<AdminUserSummary> {
    await this.findUserOrThrow(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: "ACTIVE",
        deactivatedAt: null,
        authVersion: { increment: 1 },
      },
      include: USER_WITH_RELATIONS_INCLUDE,
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.recordAudit(actorId, "USER_ACTIVATED", id, {});
    return toAdminUserSummary(user);
  }

  async deactivate(id: string, actorId: string): Promise<AdminUserSummary> {
    const existing = await this.findUserOrThrow(id);
    if (existing.status === "ACTIVE" && this.hasRole(existing, SYSTEM_ADMIN_ROLE)) {
      await this.assertNotLastActiveAdmin(id);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: "INACTIVE",
        deactivatedAt: new Date(),
        authVersion: { increment: 1 },
      },
      include: USER_WITH_RELATIONS_INCLUDE,
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.recordAudit(actorId, "USER_DEACTIVATED", id, {});
    return toAdminUserSummary(user);
  }

  // -------------------------------------------------------------------------
  // Department / section / roles
  // -------------------------------------------------------------------------

  async assignDepartment(
    id: string,
    dto: AssignDepartmentDto,
  ): Promise<AdminUserSummary> {
    await this.findUserOrThrow(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        departmentId: dto.departmentId === undefined ? undefined : dto.departmentId,
        sectionId: dto.sectionId === undefined ? undefined : dto.sectionId,
      },
      include: USER_WITH_RELATIONS_INCLUDE,
    });
    return toAdminUserSummary(user);
  }

  async assignRoles(
    id: string,
    dto: AssignRolesDto,
    actorId: string,
  ): Promise<AdminUserSummary> {
    const existing = await this.findUserOrThrow(id);
    const roleIds = await this.resolveRoleIds(dto.roleNames);

    const hadAdminRole = this.hasRole(existing, SYSTEM_ADMIN_ROLE);
    const willHaveAdminRole = dto.roleNames.includes(SYSTEM_ADMIN_ROLE);
    if (existing.status === "ACTIVE" && hadAdminRole && !willHaveAdminRole) {
      await this.assertNotLastActiveAdmin(id);
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
      }),
      this.prisma.user.update({
        where: { id },
        data: { authVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.recordAudit(actorId, "USER_ROLES_CHANGED", id, {
      from: existing.userRoles.map((userRole) => userRole.role.name),
      to: dto.roleNames,
    });

    return this.getById(id);
  }

  // -------------------------------------------------------------------------
  // Access history / password reset
  // -------------------------------------------------------------------------

  async accessHistory(id: string): Promise<AdminUserAccessHistoryResponse> {
    const user = await this.findUserOrThrow(id);
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId: id },
      orderBy: { issuedAt: "desc" },
      take: 50,
      select: {
        id: true,
        familyId: true,
        sessionId: true,
        issuedAt: true,
        expiresAt: true,
        consumedAt: true,
        revokedAt: true,
        userAgent: true,
        ipAddress: true,
      },
    });

    return {
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      sessions: sessions.map((session) => ({
        id: session.id,
        familyId: session.familyId,
        sessionId: session.sessionId,
        issuedAt: session.issuedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        consumedAt: session.consumedAt ? session.consumedAt.toISOString() : null,
        revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
      })),
    };
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    actorId: string,
  ): Promise<AdminPasswordResetResponse> {
    await this.findUserOrThrow(id);
    const temporaryPassword = dto.temporaryPassword ?? generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordChangedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        authVersion: { increment: 1 },
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.recordAudit(actorId, "USER_PASSWORD_RESET", id, {});
    return { temporaryPassword };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async findUserOrThrow(id: string): Promise<UserWithRelations> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: USER_WITH_RELATIONS_INCLUDE,
    });
    if (!user) throw new UserNotFoundException(id);
    return user;
  }

  private hasRole(user: UserWithRelations, role: UserRole): boolean {
    return user.userRoles.some((userRole) => userRole.role.name === role);
  }

  /** Throws unless at least one *other* active user currently holds
   *  SYSTEM_ADMINISTRATOR — see LastActiveAdminProtectionException. */
  private async assertNotLastActiveAdmin(excludeUserId: string): Promise<void> {
    const otherActiveAdmins = await this.prisma.user.count({
      where: {
        id: { not: excludeUserId },
        status: "ACTIVE",
        userRoles: { some: { role: { name: SYSTEM_ADMIN_ROLE } } },
      },
    });
    if (otherActiveAdmins === 0) {
      throw new LastActiveAdminProtectionException();
    }
  }

  private async assertEmployeeCodeAvailable(
    employeeCode: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { employeeCode } });
    if (existing && existing.id !== excludeUserId) {
      throw new EmployeeCodeConflictException(employeeCode);
    }
  }

  private async assertUsernameAvailable(
    username: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== excludeUserId) {
      throw new UsernameConflictException(username);
    }
  }

  private async assertEmailAvailable(
    email: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== excludeUserId) {
      throw new EmailConflictException(email);
    }
  }

  private async resolveRoleIds(roleNames: UserRole[]): Promise<string[]> {
    if (roleNames.length === 0) return [];
    const roles = await this.prisma.role.findMany({ where: { name: { in: roleNames } } });
    const foundNames = new Set(roles.map((role) => role.name));
    for (const roleName of roleNames) {
      if (!foundNames.has(roleName)) throw new UnknownRoleException(roleName);
    }
    return roles.map((role) => role.id);
  }

  private async recordAudit(
    actorId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType: "User",
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}

function clampPageSize(pageSize: number | undefined): number {
  if (!pageSize || Number.isNaN(pageSize) || pageSize < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(pageSize), MAX_PAGE_SIZE);
}

/** URL-safe random temporary password — always at least 12 characters. */
function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64").replace(/[+/=]/g, "x");
}
