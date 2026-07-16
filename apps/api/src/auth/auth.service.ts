import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { CurrentUser, PermissionKey, UserRole } from "@nelna/shared";
import { normalizeUsername } from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AUDIT_ACTIONS } from "../audit/audit.actions";
import { Prisma } from "../../generated/prisma-client";
import { getAuthConfig, type AuthConfig } from "./auth.config";
import {
  AccountInactiveException,
  AccountLockedException,
  InvalidCredentialsException,
  InvalidCurrentPasswordException,
  NotAuthenticatedException,
  PasswordReuseException,
  SessionExpiredException,
  TokenReuseDetectedException,
} from "./auth.errors";
import type { LoginDto } from "./dto/login.dto";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { AccessTokenPayload, RefreshTokenPayload } from "./auth.types";
import { hashToken } from "./lib/token-hash";
import {
  boundRequestMeta,
  claimRefreshTokenForRotation,
  revokeFamilyForReuse,
  revokeRefreshTokenFamily,
} from "./refresh-token-family";

const userWithRolesInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userWithRolesInclude }>;

export type RequestMeta = {
  ip?: string;
  userAgent?: string;
  requestId?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = {
  user: CurrentUser;
  tokens: AuthTokens;
};

export type SessionSummary = {
  familyId: string;
  sessionId: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
};

/**
 * `bcrypt.compare` against a fixed, never-matching hash — used on the
 * unknown-username path so login() does roughly the same amount of work whether
 * or not the username exists, narrowing (not eliminating) the timing side
 * channel that would otherwise let an attacker enumerate valid usernames.
 */
const TIMING_SAFE_DUMMY_HASH = bcrypt.hashSync("nelna-fg-timing-safety-placeholder", 10);

function msToSeconds(ms: number): number {
  return Math.max(1, Math.floor(ms / 1000));
}

const BCRYPT_ROUNDS = 12;

type TokenFamilyContext = {
  familyId?: string;
  sessionId?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta = {}): Promise<AuthResult> {
    const config = getAuthConfig();
    const username = normalizeUsername(dto.username);

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: userWithRolesInclude,
    });

    if (!user) {
      await bcrypt.compare(dto.password, TIMING_SAFE_DUMMY_HASH);
      await this.audit.append({
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        entityType: "User",
        reason: "invalid_credentials",
        requestId: meta.requestId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { usernamePresent: Boolean(username) },
      });
      throw new InvalidCredentialsException();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.audit.append({
        actorId: user.id,
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        entityType: "User",
        entityId: user.id,
        reason: "account_locked",
        requestId: meta.requestId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new AccountLockedException(this.minutesUntil(user.lockedUntil));
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordFailedAttempt(user, config);
      await this.audit.append({
        actorId: user.id,
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        entityType: "User",
        entityId: user.id,
        reason: "invalid_credentials",
        requestId: meta.requestId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new InvalidCredentialsException();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    if (user.status !== "ACTIVE") {
      await this.audit.append({
        actorId: user.id,
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        entityType: "User",
        entityId: user.id,
        reason: "account_inactive",
        requestId: meta.requestId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new AccountInactiveException();
    }

    const roles = this.rolesOf(user);
    const permissions = this.permissionsOf(user);
    const tokens = await this.issueTokens(user, roles, permissions, config, meta);

    const lastLoginAt = new Date();
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt } });

    await this.audit.append({
      actorId: user.id,
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      entityType: "User",
      entityId: user.id,
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      user: this.toCurrentUser(user, roles, permissions, lastLoginAt),
      tokens,
    };
  }

  /**
   * FG-AUTH-001 — single-use refresh with atomic consumption and family-scoped
   * compromise containment. Presenting a consumed (rotated) token again revokes
   * the entire family and bumps authVersion.
   */
  async refresh(
    refreshTokenRaw: string | undefined,
    meta: RequestMeta = {},
  ): Promise<AuthResult> {
    const config = getAuthConfig();
    if (!refreshTokenRaw) {
      throw new SessionExpiredException();
    }

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshTokenRaw, {
        secret: config.refreshTokenSecret,
      });
    } catch {
      throw new SessionExpiredException();
    }

    if (!payload.familyId || !payload.sessionId) {
      throw new SessionExpiredException();
    }

    const tokenHash = hashToken(refreshTokenRaw);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.userId !== payload.sub) {
      throw new SessionExpiredException();
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new SessionExpiredException();
    }

    if (stored.familyId !== payload.familyId || stored.sessionId !== payload.sessionId) {
      throw new SessionExpiredException();
    }

    // A consumed token presented again is a compromise signal — revoke family.
    if (stored.consumedAt !== null) {
      await revokeFamilyForReuse(this.prisma, stored);
      throw new TokenReuseDetectedException();
    }

    if (stored.revokedAt !== null) {
      throw new SessionExpiredException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: userWithRolesInclude,
    });

    if (!user) {
      throw new SessionExpiredException();
    }

    if (user.status !== "ACTIVE") {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      throw new AccountInactiveException();
    }

    const dbAuthVersion = user.authVersion ?? 0;
    const tokenAuthVersion = payload.authVersion ?? 0;
    if (tokenAuthVersion !== dbAuthVersion) {
      await revokeRefreshTokenFamily(this.prisma, stored.familyId, stored.userId);
      throw new SessionExpiredException();
    }

    const { claimed } = await claimRefreshTokenForRotation(this.prisma, stored.id);
    if (!claimed) {
      // Concurrent refresh race — another request consumed this token first.
      throw new SessionExpiredException();
    }

    const roles = this.rolesOf(user);
    const permissions = this.permissionsOf(user);
    const tokens = await this.issueTokens(user, roles, permissions, config, meta, {
      familyId: stored.familyId,
      sessionId: stored.sessionId,
    });

    const newTokenHash = hashToken(tokens.refreshToken);
    const newRow = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
    });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenId: newRow?.id },
    });

    return {
      user: this.toCurrentUser(user, roles, permissions, user.lastLoginAt),
      tokens,
    };
  }

  /** Best-effort: revokes the presented refresh-token family. Never throws. */
  async logout(
    refreshTokenRaw: string | undefined,
    meta: RequestMeta = {},
  ): Promise<void> {
    if (!refreshTokenRaw) return;
    const tokenHash = hashToken(refreshTokenRaw);
    const stored = await this.prisma.refreshToken
      .findUnique({ where: { tokenHash } })
      .catch(() => null);
    if (!stored) return;
    await revokeRefreshTokenFamily(this.prisma, stored.familyId, stored.userId).catch(
      () => undefined,
    );
    await this.audit.append({
      actorId: stored.userId,
      action: AUDIT_ACTIONS.LOGOUT,
      entityType: "User",
      entityId: stored.userId,
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { familyId: stored.familyId },
    });
  }

  /** Revokes all refresh-token families for the user. */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Lists one row per active or historical login family (no token material). */
  async listSessions(
    userId: string,
    refreshTokenRaw?: string,
  ): Promise<SessionSummary[]> {
    let currentSessionId: string | undefined;
    if (refreshTokenRaw) {
      try {
        const decoded = this.jwtService.decode(
          refreshTokenRaw,
        ) as RefreshTokenPayload | null;
        currentSessionId = decoded?.sessionId;
      } catch {
        currentSessionId = undefined;
      }
    }

    const rows = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      select: {
        familyId: true,
        sessionId: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
        userAgent: true,
        ipAddress: true,
      },
    });

    const latestByFamily = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestByFamily.has(row.familyId)) {
        latestByFamily.set(row.familyId, row);
      }
    }

    const now = Date.now();
    return Array.from(latestByFamily.values()).map((row) => {
      const familyActive = rows.some(
        (candidate) =>
          candidate.familyId === row.familyId &&
          candidate.revokedAt === null &&
          candidate.expiresAt.getTime() > now,
      );
      return {
        familyId: row.familyId,
        sessionId: row.sessionId,
        issuedAt: row.issuedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        revokedAt: familyActive ? null : (row.revokedAt?.toISOString() ?? null),
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        isCurrent: row.sessionId === currentSessionId,
      };
    });
  }

  /** Revokes a single login family (session) for the authenticated user. */
  async revokeSession(
    userId: string,
    familyId: string,
    refreshTokenRaw?: string,
  ): Promise<{ clearedCurrent: boolean }> {
    const count = await revokeRefreshTokenFamily(this.prisma, familyId, userId);
    if (count === 0) {
      throw new NotAuthenticatedException();
    }
    let clearedCurrent = false;
    if (refreshTokenRaw) {
      try {
        const decoded = this.jwtService.decode(
          refreshTokenRaw,
        ) as RefreshTokenPayload | null;
        clearedCurrent = decoded?.familyId === familyId;
      } catch {
        clearedCurrent = false;
      }
    }
    return { clearedCurrent };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: RequestMeta = {},
  ): Promise<AuthResult> {
    const config = getAuthConfig();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesInclude,
    });

    if (!user) {
      throw new NotAuthenticatedException();
    }
    if (user.status !== "ACTIVE") {
      throw new AccountInactiveException();
    }

    const currentMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentMatches) {
      throw new InvalidCurrentPasswordException();
    }

    const sameAsOld = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (sameAsOld) {
      throw new PasswordReuseException();
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    const passwordChangedAt = new Date();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt,
        failedLoginAttempts: 0,
        lockedUntil: null,
        authVersion: { increment: 1 },
      },
    });

    await this.revokeAllSessions(userId);

    await this.audit.append({
      actorId: userId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      entityType: "User",
      entityId: userId,
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const reloaded = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesInclude,
    });
    if (!reloaded) {
      throw new NotAuthenticatedException();
    }

    const roles = this.rolesOf(reloaded);
    const permissions = this.permissionsOf(reloaded);
    const tokens = await this.issueTokens(reloaded, roles, permissions, config, meta);

    return {
      user: this.toCurrentUser(reloaded, roles, permissions, reloaded.lastLoginAt),
      tokens,
    };
  }

  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolesInclude,
    });

    if (!user) {
      throw new NotAuthenticatedException();
    }
    if (user.status !== "ACTIVE") {
      throw new AccountInactiveException();
    }

    return this.toCurrentUser(
      user,
      this.rolesOf(user),
      this.permissionsOf(user),
      user.lastLoginAt,
    );
  }

  private async recordFailedAttempt(
    user: UserWithRoles,
    config: AuthConfig,
  ): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= config.loginMaxAttempts;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + config.loginLockoutMinutes * 60_000)
          : user.lockedUntil,
      },
    });
  }

  private async issueTokens(
    user: UserWithRoles,
    roles: UserRole[],
    permissions: PermissionKey[],
    config: AuthConfig,
    meta: RequestMeta,
    familyContext: TokenFamilyContext = {},
  ): Promise<AuthTokens> {
    const familyId = familyContext.familyId ?? randomUUID();
    const sessionId = familyContext.sessionId ?? randomUUID();
    const boundedMeta = boundRequestMeta(meta);

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      roles,
      permissions,
      authVersion: user.authVersion ?? 0,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: config.accessTokenSecret,
      expiresIn: msToSeconds(config.accessTokenTtlMs),
    });

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti: randomUUID(),
      authVersion: user.authVersion ?? 0,
      familyId,
      sessionId,
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: config.refreshTokenSecret,
      expiresIn: msToSeconds(config.refreshTokenTtlMs),
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        sessionId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + config.refreshTokenTtlMs),
        ...boundedMeta,
      },
    });

    return { accessToken, refreshToken };
  }

  private rolesOf(user: UserWithRoles): UserRole[] {
    return user.userRoles.map((userRole) => userRole.role.name as UserRole);
  }

  private permissionsOf(user: UserWithRoles): PermissionKey[] {
    const keys = new Set<PermissionKey>();
    for (const userRole of user.userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        keys.add(rolePermission.permission.key as PermissionKey);
      }
    }
    return Array.from(keys);
  }

  private toCurrentUser(
    user: UserWithRoles,
    roles: UserRole[],
    permissions: PermissionKey[],
    lastLoginAt: Date | null,
  ): CurrentUser {
    return {
      id: user.id,
      employeeCode: user.employeeCode,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      roles,
      permissions,
      lastLoginAt: lastLoginAt ? lastLoginAt.toISOString() : null,
    };
  }

  private minutesUntil(date: Date): number {
    return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000));
  }
}
