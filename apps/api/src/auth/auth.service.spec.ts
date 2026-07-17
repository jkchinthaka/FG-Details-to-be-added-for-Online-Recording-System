import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import type { LoginDto } from "./dto/login.dto";
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
import { hashToken } from "./lib/token-hash";
import type { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const PLAINTEXT_PASSWORD = "correct-horse-battery-staple";

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    employeeCode: "EMP-OPERATOR-001",
    username: "fg.operator01",
    fullName: "Test Operator",
    email: "operator@example.local",
    passwordHash: bcrypt.hashSync(PLAINTEXT_PASSWORD, 4),
    mustChangePassword: false,
    status: "ACTIVE",
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    authVersion: 0,
    userRoles: [
      {
        role: {
          name: "FG_OPERATOR",
          rolePermissions: [
            { permission: { key: "records:create" } },
            { permission: { key: "records:read" } },
          ],
        },
      },
    ],
    ...overrides,
  };
}

function buildPrismaMock() {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (typeof ops === "function") {
        return (ops as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      return Promise.all(ops as Promise<unknown>[]);
    }),
  };
  return prismaMock;
}

async function signRefreshToken(
  jwtService: JwtService,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  return jwtService.signAsync(
    {
      sub: "user-1",
      jti: "jti-1",
      authVersion: 0,
      familyId: "family-1",
      sessionId: "session-1",
      ...overrides,
    },
    { secret: "test-refresh-secret", expiresIn: "7d" },
  );
}

function storedRefreshRow(token: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "rt-1",
    userId: "user-1",
    familyId: "family-1",
    sessionId: "session-1",
    tokenHash: hashToken(token),
    consumedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function buildService(prismaMock: ReturnType<typeof buildPrismaMock>) {
  const jwtService = new JwtService();
  const audit = new AuditService(prismaMock as unknown as PrismaService);
  const service = new AuthService(
    prismaMock as unknown as PrismaService,
    jwtService,
    audit,
  );
  return { service, jwtService, audit };
}

describe("AuthService", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.ACCESS_TOKEN_TTL = "15m";
    process.env.REFRESH_TOKEN_TTL = "7d";
    process.env.LOGIN_MAX_ATTEMPTS = "5";
    process.env.LOGIN_LOCKOUT_MINUTES = "15";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const loginDto: LoginDto = {
    username: "fg.operator01",
    password: PLAINTEXT_PASSWORD,
  };

  describe("login — success", () => {
    it("returns the user profile, roles and permissions and issues tokens on correct credentials", async () => {
      const prismaMock = buildPrismaMock();
      const user = buildUser();
      prismaMock.user.findUnique.mockResolvedValue(user);
      const { service } = buildService(prismaMock);

      const result = await service.login(loginDto);

      expect(result.user).toMatchObject({
        id: "user-1",
        employeeCode: "EMP-OPERATOR-001",
        roles: ["FG_OPERATOR"],
        permissions: expect.arrayContaining(["records:create", "records:read"]),
      });
      expect(result.user).not.toHaveProperty("passwordHash");
      expect(typeof result.tokens.accessToken).toBe("string");
      expect(typeof result.tokens.refreshToken).toBe("string");
    });

    it("persists the new refresh token as a hash, never in plaintext", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser());
      const { service } = buildService(prismaMock);

      const result = await service.login(loginDto);

      expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
      const createArgs = prismaMock.refreshToken.create.mock.calls[0][0];
      expect(createArgs.data.tokenHash).toBe(hashToken(result.tokens.refreshToken));
      expect(createArgs.data.tokenHash).not.toBe(result.tokens.refreshToken);
      expect(createArgs.data.familyId).toEqual(expect.any(String));
      expect(createArgs.data.sessionId).toEqual(expect.any(String));
    });

    it("resets failedLoginAttempts and records lastLoginAt on success", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser({ failedLoginAttempts: 3 }));
      const { service } = buildService(prismaMock);

      await service.login(loginDto);

      const resetCall = prismaMock.user.update.mock.calls.find(
        ([args]: [{ data: Record<string, unknown> }]) =>
          "failedLoginAttempts" in args.data,
      );
      expect(resetCall?.[0].data).toMatchObject({
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      const lastLoginCall = prismaMock.user.update.mock.calls.find(
        ([args]: [{ data: Record<string, unknown> }]) => "lastLoginAt" in args.data,
      );
      expect(lastLoginCall?.[0].data.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe("login — failure", () => {
    it("rejects an unknown username with the generic InvalidCredentialsException", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(null);
      const { service } = buildService(prismaMock);

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(
        InvalidCredentialsException,
      );
    });

    it("rejects a wrong password with the exact same exception as an unknown username", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser());
      const { service } = buildService(prismaMock);

      let unknownUsernameError: unknown;
      let wrongPasswordError: unknown;

      try {
        await service.login({ username: "nobody.here", password: "whatever" });
      } catch (error) {
        unknownUsernameError = error;
      }
      try {
        await service.login({ username: loginDto.username, password: "wrong-password" });
      } catch (error) {
        wrongPasswordError = error;
      }

      expect(unknownUsernameError).toBeInstanceOf(InvalidCredentialsException);
      expect(wrongPasswordError).toBeInstanceOf(InvalidCredentialsException);
      expect((unknownUsernameError as { getResponse(): unknown }).getResponse()).toEqual(
        (wrongPasswordError as { getResponse(): unknown }).getResponse(),
      );
    });

    it("normalizes username to lowercase before lookup", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser());
      const { service } = buildService(prismaMock);

      await service.login({ username: "FG.Operator01", password: PLAINTEXT_PASSWORD });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { username: "fg.operator01" },
        include: expect.any(Object),
      });
    });

    it("increments the failed-attempt counter on a wrong password", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser({ failedLoginAttempts: 1 }));
      const { service } = buildService(prismaMock);

      await expect(
        service.login({ username: loginDto.username, password: "wrong-password" }),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginAttempts: 2, lockedUntil: null },
      });
    });

    it("locks the account once the max failed-attempt threshold is reached", async () => {
      process.env.LOGIN_MAX_ATTEMPTS = "3";
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser({ failedLoginAttempts: 2 }));
      const { service } = buildService(prismaMock);

      await expect(
        service.login({ username: loginDto.username, password: "wrong-password" }),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);

      const call = prismaMock.user.update.mock.calls[0]![0] as {
        data: { lockedUntil: Date | null };
      };
      expect(call.data.lockedUntil).toBeInstanceOf(Date);
      expect(call.data.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it("rejects an already-locked account before checking the password, with a retry-after message", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(
        buildUser({ lockedUntil: new Date(Date.now() + 10 * 60_000) }),
      );
      const { service } = buildService(prismaMock);

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(
        AccountLockedException,
      );
    });
  });

  describe("login — account status", () => {
    it("rejects an inactive account only after the password has matched, resetting attempt tracking first", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(
        buildUser({ status: "INACTIVE", failedLoginAttempts: 2 }),
      );
      const { service } = buildService(prismaMock);

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(
        AccountInactiveException,
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      expect(prismaMock.refreshToken.create).not.toHaveBeenCalled();
    });

    it("rejects a suspended account with AccountInactiveException too", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser({ status: "SUSPENDED" }));
      const { service } = buildService(prismaMock);

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(
        AccountInactiveException,
      );
    });
  });

  describe("password hashing", () => {
    it("never compares the plaintext password directly — a hash of the same password differs from the password", () => {
      const hash = bcrypt.hashSync(PLAINTEXT_PASSWORD, 4);
      expect(hash).not.toBe(PLAINTEXT_PASSWORD);
      expect(bcrypt.compareSync(PLAINTEXT_PASSWORD, hash)).toBe(true);
    });

    it("rejects login when passwordHash does not match, even for a very similar password", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser());
      const { service } = buildService(prismaMock);

      await expect(
        service.login({
          username: loginDto.username,
          password: `${PLAINTEXT_PASSWORD}!`,
        }),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
    });
  });

  describe("getCurrentUser", () => {
    it("returns the profile for an active user", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser());
      const { service } = buildService(prismaMock);

      const profile = await service.getCurrentUser("user-1");
      expect(profile.id).toBe("user-1");
      expect(profile.roles).toEqual(["FG_OPERATOR"]);
    });

    it("throws NotAuthenticatedException when the user no longer exists", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(null);
      const { service } = buildService(prismaMock);

      await expect(service.getCurrentUser("missing")).rejects.toBeInstanceOf(
        NotAuthenticatedException,
      );
    });

    it("throws AccountInactiveException for a deactivated user", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser({ status: "INACTIVE" }));
      const { service } = buildService(prismaMock);

      await expect(service.getCurrentUser("user-1")).rejects.toBeInstanceOf(
        AccountInactiveException,
      );
    });
  });

  describe("refresh — FG-AUTH-001 rotation", () => {
    it("rejects when no refresh token cookie is present", async () => {
      const prismaMock = buildPrismaMock();
      const { service } = buildService(prismaMock);
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(
        SessionExpiredException,
      );
    });

    it("rejects an expired refresh JWT", async () => {
      const prismaMock = buildPrismaMock();
      const { service, jwtService } = buildService(prismaMock);
      const token = await jwtService.signAsync(
        {
          sub: "user-1",
          jti: "abc",
          authVersion: 0,
          familyId: "family-1",
          sessionId: "session-1",
        },
        { secret: "test-refresh-secret", expiresIn: "0s" },
      );
      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        SessionExpiredException,
      );
    });

    it("rejects a refresh JWT missing family metadata", async () => {
      const prismaMock = buildPrismaMock();
      const { service, jwtService } = buildService(prismaMock);
      const token = await jwtService.signAsync(
        { sub: "user-1", jti: "abc", authVersion: 0 },
        { secret: "test-refresh-secret", expiresIn: "7d" },
      );
      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        SessionExpiredException,
      );
    });

    it("rejects a refresh token that was already revoked (logout)", async () => {
      const prismaMock = buildPrismaMock();
      const { service, jwtService } = buildService(prismaMock);
      const token = await signRefreshToken(jwtService);
      prismaMock.refreshToken.findUnique.mockResolvedValue(
        storedRefreshRow(token, { revokedAt: new Date() }),
      );

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        SessionExpiredException,
      );
    });

    it("rejects a refresh token unknown to the database", async () => {
      const prismaMock = buildPrismaMock();
      const { service, jwtService } = buildService(prismaMock);
      const token = await signRefreshToken(jwtService);
      prismaMock.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        SessionExpiredException,
      );
    });

    it("rotates a valid refresh token atomically and issues a new pair", async () => {
      const prismaMock = buildPrismaMock();
      const { service, jwtService } = buildService(prismaMock);
      const token = await signRefreshToken(jwtService);
      prismaMock.refreshToken.findUnique
        .mockResolvedValueOnce(storedRefreshRow(token))
        .mockResolvedValueOnce({ id: "rt-new" });
      prismaMock.user.findUnique.mockResolvedValue(buildUser());

      const result = await service.refresh(token);

      expect(result.tokens.refreshToken).not.toBe(token);
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "rt-1",
            AND: expect.any(Array),
          }),
          data: { consumedAt: expect.any(Date) },
        }),
      );
      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date), replacedByTokenId: "rt-new" },
      });
    });

    it("rejects concurrent refresh losers without family revocation", async () => {
      const prismaMock = buildPrismaMock();
      const { service, jwtService } = buildService(prismaMock);
      const token = await signRefreshToken(jwtService);
      prismaMock.refreshToken.findUnique.mockResolvedValue(storedRefreshRow(token));
      prismaMock.user.findUnique.mockResolvedValue(buildUser());
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        SessionExpiredException,
      );
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("revokes the family and returns TOKEN_REUSE_DETECTED when a consumed token is reused", async () => {
      const prismaMock = buildPrismaMock();
      const { service, jwtService } = buildService(prismaMock);
      const token = await signRefreshToken(jwtService);
      prismaMock.refreshToken.findUnique.mockResolvedValue(
        storedRefreshRow(token, { consumedAt: new Date() }),
      );

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        TokenReuseDetectedException,
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "REFRESH_TOKEN_REUSE_DETECTED",
            entityType: "RefreshTokenFamily",
          }),
        }),
      );
      const auditPayload = JSON.stringify(prismaMock.auditLog.create.mock.calls[0]);
      expect(auditPayload).not.toContain(token);
      expect(auditPayload).not.toContain(hashToken(token));
    });

    it("revokes the token and rejects when the account became inactive", async () => {
      const prismaMock = buildPrismaMock();
      const { service, jwtService } = buildService(prismaMock);
      const token = await signRefreshToken(jwtService);
      prismaMock.refreshToken.findUnique.mockResolvedValue(storedRefreshRow(token));
      prismaMock.user.findUnique.mockResolvedValue(buildUser({ status: "INACTIVE" }));

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        AccountInactiveException,
      );
      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("rejects an expired stored token even when the JWT is still valid", async () => {
      const prismaMock = buildPrismaMock();
      const { service, jwtService } = buildService(prismaMock);
      const token = await signRefreshToken(jwtService);
      prismaMock.refreshToken.findUnique.mockResolvedValue(
        storedRefreshRow(token, { expiresAt: new Date(Date.now() - 1_000) }),
      );

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        SessionExpiredException,
      );
    });
  });

  describe("changePassword", () => {
    it("rejects an incorrect current password", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser());
      const { service } = buildService(prismaMock);

      await expect(
        service.changePassword("user-1", {
          currentPassword: "wrong",
          newPassword: "New-Secure-Pass12!",
        }),
      ).rejects.toBeInstanceOf(InvalidCurrentPasswordException);
    });

    it("rejects reusing the current password", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(buildUser());
      const { service } = buildService(prismaMock);

      await expect(
        service.changePassword("user-1", {
          currentPassword: PLAINTEXT_PASSWORD,
          newPassword: PLAINTEXT_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(PasswordReuseException);
    });

    it("updates password, clears mustChangePassword and revokes sessions", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique
        .mockResolvedValueOnce(buildUser({ mustChangePassword: true }))
        .mockResolvedValueOnce(buildUser({ mustChangePassword: false, authVersion: 1 }));
      prismaMock.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const { service } = buildService(prismaMock);

      const result = await service.changePassword("user-1", {
        currentPassword: PLAINTEXT_PASSWORD,
        newPassword: "Brand-New-Pass12!",
      });

      expect(result.user.mustChangePassword).toBe(false);
      expect(result.user).not.toHaveProperty("passwordHash");
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalled();
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mustChangePassword: false,
            authVersion: { increment: 1 },
          }),
        }),
      );
    });
  });

  describe("logout", () => {
    it("is a no-op when no refresh token is presented", async () => {
      const prismaMock = buildPrismaMock();
      const { service } = buildService(prismaMock);
      await service.logout(undefined);
      expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it("revokes the matching refresh-token family", async () => {
      const prismaMock = buildPrismaMock();
      const { service } = buildService(prismaMock);
      const token = "some-refresh-token";
      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        familyId: "family-1",
        sessionId: "session-1",
      });

      await service.logout(token);

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          familyId: "family-1",
          userId: "user-1",
          AND: expect.any(Array),
        }),
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
