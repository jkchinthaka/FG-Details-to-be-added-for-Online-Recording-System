import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "../../generated/prisma-client";
import { AuthService } from "./auth.service";
import { SessionExpiredException, TokenReuseDetectedException } from "./auth.errors";
import { hashToken } from "./lib/token-hash";
import type { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

function databaseNameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/([^/?]+)(?:\?|$)/);
  return match?.[1] ?? null;
}

const dbName = databaseNameFromUrl(process.env.DATABASE_URL);
const shouldRun =
  process.env.RUN_DB_INTEGRATION === "1" &&
  dbName === "fg_online_test" &&
  Boolean(process.env.DATABASE_URL?.includes("fg_online_test"));

const describeIntegration = shouldRun ? describe : describe.skip;

describeIntegration("FG-AUTH-001 refresh rotation (integration)", () => {
  const prisma = new PrismaClient();
  const jwtService = new JwtService();
  let service: AuthService;
  let userId: string;
  let username: string;
  const password = "integration-test-password-12";

  jest.setTimeout(60_000);

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test-access-secret";
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret";
    process.env.ACCESS_TOKEN_TTL = "15m";
    process.env.REFRESH_TOKEN_TTL = "7d";
    process.env.NODE_ENV = "test";

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      new AuditService(prisma as unknown as PrismaService),
    );

    username = `auth001.${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 4);
    const user = await prisma.user.create({
      data: {
        employeeCode: `AUTH001-${Date.now()}`,
        username,
        fullName: "AUTH001 Test User",
        passwordHash,
        mustChangePassword: false,
        status: "ACTIVE",
        authVersion: 0,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.auditLog
        .deleteMany({ where: { actorId: userId } })
        .catch(() => undefined);
      await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("allows exactly one concurrent refresh to succeed", async () => {
    const login = await service.login({ username, password });
    const token = login.tokens.refreshToken;

    const results = await Promise.allSettled([
      service.refresh(token),
      service.refresh(token),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      SessionExpiredException,
    );
  });

  it("revokes the family and bumps authVersion when a consumed token is reused", async () => {
    const userBefore = await prisma.user.findUnique({ where: { id: userId } });
    const login = await service.login({ username, password });
    const firstToken = login.tokens.refreshToken;
    await service.refresh(firstToken);

    await expect(service.refresh(firstToken)).rejects.toBeInstanceOf(
      TokenReuseDetectedException,
    );

    const userAfter = await prisma.user.findUnique({ where: { id: userId } });
    expect(userAfter?.authVersion ?? 0).toBeGreaterThan(userBefore?.authVersion ?? 0);

    const firstRow = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(firstToken) },
    });
    const familyRows = await prisma.refreshToken.findMany({
      where: { familyId: firstRow!.familyId },
    });
    expect(
      familyRows.every((row) => row.revokedAt !== null || row.reuseDetectedAt !== null),
    ).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { actorId: userId, action: "REFRESH_TOKEN_REUSE_DETECTED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit?.metadata ?? {})).not.toContain(firstToken);
  });

  it("leaves a separate login family active when another family is revoked", async () => {
    const loginA = await service.login({ username, password });
    const loginB = await service.login({ username, password });

    const rowA = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(loginA.tokens.refreshToken) },
    });
    const rowB = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(loginB.tokens.refreshToken) },
    });
    expect(rowA?.familyId).not.toBe(rowB?.familyId);

    await service.logout(loginA.tokens.refreshToken);

    const stillActiveB = await prisma.refreshToken.findFirst({
      where: { familyId: rowB!.familyId, revokedAt: null },
    });
    expect(stillActiveB).toBeTruthy();

    const refreshedB = await service.refresh(loginB.tokens.refreshToken);
    expect(refreshedB.tokens.refreshToken).toBeTruthy();
  });
});
