import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { CurrentUser, PermissionKey, UserRole } from "@nelna/shared";
import { normalizeUsername } from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
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
} from "./auth.errors";
import type { LoginDto } from "./dto/login.dto";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { AccessTokenPayload, RefreshTokenPayload } from "./auth.types";
import { hashToken } from "./lib/token-hash";

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
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = {
  user: CurrentUser;
  tokens: AuthTokens;
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
      throw new InvalidCredentialsException();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AccountLockedException(this.minutesUntil(user.lockedUntil));
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordFailedAttempt(user, config);
      throw new InvalidCredentialsException();
    }

    // Correct password confirmed — clear failed-attempt tracking regardless
    // of account status below (a locked-then-correctly-solved account should
    // not stay artificially locked once the owner proves they hold it).
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    if (user.status !== "ACTIVE") {
      throw new AccountInactiveException();
    }

    const roles = this.rolesOf(user);
    const permissions = this.permissionsOf(user);
    const tokens = await this.issueTokens(user, roles, permissions, config, meta);

    const lastLoginAt = new Date();
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt } });

    return {
      user: this.toCurrentUser(user, roles, permissions, lastLoginAt),
      tokens,
    };
  }

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

    const tokenHash = hashToken(refreshTokenRaw);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.userId !== payload.sub) {
      throw new SessionExpiredException();
    }

    // Reuse detection: token already consumed/revoked but presented again.
    if (stored.consumedAt !== null || stored.revokedAt !== null) {
      await this.revokeFamilyOnReuse(stored.familyId, stored.userId, "REFRESH_TOKEN_REUSE");
      throw new SessionExpiredException();
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new SessionExpiredException();
    }

    // Atomic single-use claim — only one concurrent refresh wins.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: {
        id: stored.id,
        consumedAt: null,
        revokedAt: null,
      },
      data: { consumedAt: new Date(), revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await this.revokeFamilyOnReuse(stored.familyId, stored.userId, "REFRESH_TOKEN_RACE");
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
      await this.revokeFamily(stored.familyId);
      throw new AccountInactiveException();
    }

    const dbAuthVersion = user.authVersion ?? 0;
    const tokenAuthVersion = payload.authVersion ?? 0;
    if (tokenAuthVersion !== dbAuthVersion) {
      await this.revokeFamily(stored.familyId);
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
      data: { replacedByTokenId: newRow?.id },
    });

    return {
      user: this.toCurrentUser(user, roles, permissions, user.lastLoginAt),
      tokens,
    };
  }

  /** Revokes an entire refresh-token family and bumps authVersion on compromise. */
  private async revokeFamilyOnReuse(
    familyId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    await this.revokeFamily(familyId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { authVersion: { increment: 1 } },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "REFRESH_TOKEN_FAMILY_REVOKED",
        entityType: "RefreshTokenFamily",
        entityId: familyId,
        metadata: { reason },
      },
    });
    this.logger.warn(
      JSON.stringify({
        event: "refresh_token_family_revoked",
        familyId,
        userId,
        reason,
      }),
    );
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Best-effort: revokes the presented refresh token. Never throws — logout always succeeds client-side. */
  async logout(refreshTokenRaw: string | undefined): Promise<void> {
    if (!refreshTokenRaw) return;
    const tokenHash = hashToken(refreshTokenRaw);
    await this.prisma.refreshToken
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  /** Revokes all refresh tokens for the user — used on password change/reset. */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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
    lineage?: { familyId: string; sessionId: string },
  ): Promise<AuthTokens> {
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

    const familyId = lineage?.familyId ?? randomUUID();
    const sessionId = lineage?.sessionId ?? randomUUID();
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
        tokenHash: hashToken(refreshToken),
        familyId,
        sessionId,
        expiresAt: new Date(Date.now() + config.refreshTokenTtlMs),
        userAgent: meta.userAgent,
        ipAddress: meta.ip,
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
