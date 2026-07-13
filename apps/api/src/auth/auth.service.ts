import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { CurrentUser, PermissionKey, UserRole } from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "../../generated/prisma-client";
import { getAuthConfig, type AuthConfig } from "./auth.config";
import {
  AccountInactiveException,
  AccountLockedException,
  InvalidCredentialsException,
  NotAuthenticatedException,
  SessionExpiredException,
} from "./auth.errors";
import type { LoginDto } from "./dto/login.dto";
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
 * unknown-email path so login() does roughly the same amount of work whether
 * or not the email exists, narrowing (not eliminating) the timing side
 * channel that would otherwise let an attacker enumerate valid emails.
 */
const TIMING_SAFE_DUMMY_HASH = bcrypt.hashSync("nelna-fg-timing-safety-placeholder", 10);

function msToSeconds(ms: number): number {
  return Math.max(1, Math.floor(ms / 1000));
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta = {}): Promise<AuthResult> {
    const config = getAuthConfig();
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
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

  async refresh(refreshTokenRaw: string | undefined, meta: RequestMeta = {}): Promise<AuthResult> {
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

    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.revokedAt !== null ||
      stored.expiresAt.getTime() < Date.now()
    ) {
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

    const roles = this.rolesOf(user);
    const permissions = this.permissionsOf(user);
    const tokens = await this.issueTokens(user, roles, permissions, config, meta);

    const newTokenHash = hashToken(tokens.refreshToken);
    const newRow = await this.prisma.refreshToken.findUnique({ where: { tokenHash: newTokenHash } });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenId: newRow?.id },
    });

    return { user: this.toCurrentUser(user, roles, permissions, user.lastLoginAt), tokens };
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

    return this.toCurrentUser(user, this.rolesOf(user), this.permissionsOf(user), user.lastLoginAt);
  }

  private async recordFailedAttempt(user: UserWithRoles, config: AuthConfig): Promise<void> {
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
  ): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      roles,
      permissions,
    };
    // expiresIn is passed as whole seconds (a plain number) rather than a
    // duration string — jsonwebtoken's TS types only accept the `ms`
    // package's strict `StringValue` literal type for string durations,
    // which our config's plain `string` TTL can't satisfy without an unsafe
    // cast. Seconds are unambiguous and avoid that entirely.
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: config.accessTokenSecret,
      expiresIn: msToSeconds(config.accessTokenTtlMs),
    });

    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti: randomUUID() };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: config.refreshTokenSecret,
      expiresIn: msToSeconds(config.refreshTokenTtlMs),
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
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
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      roles,
      permissions,
      lastLoginAt: lastLoginAt ? lastLoginAt.toISOString() : null,
    };
  }

  private minutesUntil(date: Date): number {
    return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000));
  }
}
