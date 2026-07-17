import { UsersService } from "./users.service";
import {
  EmployeeCodeConflictException,
  LastActiveAdminProtectionException,
  UserNotFoundException,
} from "./users.errors";
import type { PrismaService } from "../prisma/prisma.service";

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    employeeCode: "EMP-1001",
    username: "nimal.perera",
    fullName: "Nimal Perera",
    email: "nimal@example.local",
    mustChangePassword: true,
    passwordHash: "hashed",
    status: "ACTIVE",
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    departmentId: null,
    department: null,
    sectionId: null,
    section: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    userRoles: [{ role: { name: "FG_OPERATOR" } }],
    ...overrides,
  };
}

function makeAdminUser(overrides: Record<string, unknown> = {}) {
  return makeUser({
    id: "admin-1",
    employeeCode: "EMP-ADMIN",
    fullName: "System Admin",
    userRoles: [{ role: { name: "SYSTEM_ADMINISTRATOR" } }],
    ...overrides,
  });
}

function buildPrismaMock() {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userRole: {
      deleteMany: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    },
    role: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    refreshToken: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return undefined;
    }),
  };
}

function buildService(prismaMock: ReturnType<typeof buildPrismaMock>) {
  return new UsersService(prismaMock as unknown as PrismaService);
}

describe("UsersService", () => {
  describe("list", () => {
    it("maps users to summaries without leaking passwordHash", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findMany.mockResolvedValue([makeUser()]);
      prismaMock.user.count.mockResolvedValue(1);
      const service = buildService(prismaMock);

      const result = await service.list({});

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).not.toHaveProperty("passwordHash");
      expect(result.items[0]?.roles).toEqual(["FG_OPERATOR"]);
    });
  });

  describe("getById", () => {
    it("throws UserNotFoundException for an unknown id", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(null);
      const service = buildService(prismaMock);

      await expect(service.getById("nope")).rejects.toBeInstanceOf(UserNotFoundException);
    });
  });

  describe("create", () => {
    it("rejects a duplicate employee code with 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(makeUser());
      const service = buildService(prismaMock);

      await expect(
        service.create(
          {
            employeeCode: "EMP-1001",
            username: "dup.user",
            fullName: "Dup",
            temporaryPassword: "temporary-password-12",
          },
          "actor-1",
        ),
      ).rejects.toBeInstanceOf(EmployeeCodeConflictException);
    });

    it("hashes the password and never returns it in the response", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(makeUser({ id: "new-user" }));
      const service = buildService(prismaMock);

      const result = await service.create(
        {
          employeeCode: "EMP-2002",
          username: "new.user",
          fullName: "New User",
          temporaryPassword: "temporary-password-12",
        },
        "actor-1",
      );

      expect(result).not.toHaveProperty("passwordHash");
      const createCall = prismaMock.user.create.mock.calls[0]![0];
      expect(createCall.data.passwordHash).not.toBe("temporary-password-12");
      expect(createCall.data.mustChangePassword).toBe(true);
      expect(createCall.data.username).toBe("new.user");
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "USER_CREATED" }),
        }),
      );
    });
  });

  describe("deactivate — last active admin protection", () => {
    it("blocks deactivating the sole active System Administrator", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(makeAdminUser());
      prismaMock.user.count.mockResolvedValue(0);
      const service = buildService(prismaMock);

      await expect(service.deactivate("admin-1", "actor-1")).rejects.toBeInstanceOf(
        LastActiveAdminProtectionException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("allows deactivating an admin when another active admin exists", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(makeAdminUser());
      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.user.update.mockResolvedValue(makeAdminUser({ status: "INACTIVE" }));
      const service = buildService(prismaMock);

      const result = await service.deactivate("admin-1", "actor-1");
      expect(result.status).toBe("INACTIVE");
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "USER_DEACTIVATED" }),
        }),
      );
    });

    it("allows deactivating a non-admin user regardless of admin count", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(makeUser());
      prismaMock.user.update.mockResolvedValue(makeUser({ status: "INACTIVE" }));
      const service = buildService(prismaMock);

      const result = await service.deactivate("user-1", "actor-1");
      expect(result.status).toBe("INACTIVE");
      expect(prismaMock.user.count).not.toHaveBeenCalled();
    });
  });

  describe("assignRoles — last active admin protection", () => {
    it("blocks stripping SYSTEM_ADMINISTRATOR from the last active admin", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(makeAdminUser());
      prismaMock.user.count.mockResolvedValue(0);
      prismaMock.role.findMany.mockResolvedValue([
        { id: "role-op", name: "FG_OPERATOR" },
      ]);
      const service = buildService(prismaMock);

      await expect(
        service.assignRoles("admin-1", { roleNames: ["FG_OPERATOR"] }, "actor-1"),
      ).rejects.toBeInstanceOf(LastActiveAdminProtectionException);
      expect(prismaMock.userRole.deleteMany).not.toHaveBeenCalled();
    });

    it("allows changing roles when another active admin remains", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeAdminUser())
        .mockResolvedValueOnce(
          makeAdminUser({ userRoles: [{ role: { name: "FG_SUPERVISOR" } }] }),
        );
      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.role.findMany.mockResolvedValue([
        { id: "role-sup", name: "FG_SUPERVISOR" },
      ]);
      const service = buildService(prismaMock);

      const result = await service.assignRoles(
        "admin-1",
        { roleNames: ["FG_SUPERVISOR"] },
        "actor-1",
      );

      expect(result.roles).toEqual(["FG_SUPERVISOR"]);
      expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: "admin-1" },
      });
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "USER_ROLES_CHANGED" }),
        }),
      );
    });
  });

  describe("resetPassword", () => {
    it("returns a one-time temporary password and never a hash", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(makeUser());
      const service = buildService(prismaMock);

      const result = await service.resetPassword("user-1", {}, "actor-1");

      expect(result.temporaryPassword).toBeTruthy();
      expect(result).not.toHaveProperty("passwordHash");
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
            mustChangePassword: true,
          }),
        }),
      );
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "USER_PASSWORD_RESET" }),
        }),
      );
    });
  });

  describe("accessHistory", () => {
    it("returns sessions without token hashes", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.user.findUnique.mockResolvedValue(
        makeUser({ lastLoginAt: new Date("2026-01-02T00:00:00.000Z") }),
      );
      prismaMock.refreshToken.findMany.mockResolvedValue([
        {
          id: "rt-1",
          familyId: "family-1",
          sessionId: "session-1",
          issuedAt: new Date("2026-01-02T00:00:00.000Z"),
          expiresAt: new Date("2026-01-03T00:00:00.000Z"),
          consumedAt: null,
          revokedAt: null,
          userAgent: "test-agent",
          ipAddress: "127.0.0.1",
        },
      ]);
      const service = buildService(prismaMock);

      const result = await service.accessHistory("user-1");

      expect(result.lastLoginAt).toBe("2026-01-02T00:00:00.000Z");
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]).not.toHaveProperty("tokenHash");
      expect(prismaMock.refreshToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.not.objectContaining({ tokenHash: true }),
        }),
      );
    });
  });
});
