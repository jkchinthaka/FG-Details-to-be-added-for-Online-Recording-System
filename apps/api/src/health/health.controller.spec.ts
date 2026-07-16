import { ServiceUnavailableException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { PrismaService } from "../prisma/prisma.service";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $runCommandRaw: jest.fn().mockRejectedValue(new Error("no db in unit test")),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("returns a structured health response for Nelna FG API", async () => {
    const result = await controller.getHealth();
    expect(["healthy", "degraded"]).toContain(result.status);
    expect(result.service).toBe("nelna-fg-api");
    expect(result.product).toContain("Nelna FG");
    expect(result.checks.api).toBe("up");
    expect(result.checks.storage).toBeDefined();
    expect(result.version).toBeTruthy();
    expect(result.timestamp).toBeTruthy();
    expect(result).toHaveProperty("buildId");
    expect(result).toHaveProperty("commitSha");
  });

  it("exposes a safe release manifest when GIT_COMMIT_SHA is set", () => {
    const previous = process.env.GIT_COMMIT_SHA;
    process.env.GIT_COMMIT_SHA = "abcdef0123456789abcdef0123456789abcdef01";
    const result = controller.getRelease();
    expect(result.commitSha).toBe("abcdef0123456789abcdef0123456789abcdef01");
    expect(result.shortSha).toBe("abcdef012345");
    expect(result.buildId).toBe(result.shortSha);
    expect(result.service).toBe("nelna-fg-api");
    expect(JSON.stringify(result)).not.toMatch(/mongodb|password|secret|DATABASE/i);
    if (previous) process.env.GIT_COMMIT_SHA = previous;
    else delete process.env.GIT_COMMIT_SHA;
  });

  it("rejects release when commit SHA is missing", () => {
    const previous = process.env.GIT_COMMIT_SHA;
    const previousBuild = process.env.APP_BUILD_ID;
    const previousRender = process.env.RENDER_GIT_COMMIT;
    const previousGithub = process.env.GITHUB_SHA;
    delete process.env.GIT_COMMIT_SHA;
    delete process.env.APP_BUILD_ID;
    delete process.env.RENDER_GIT_COMMIT;
    delete process.env.GITHUB_SHA;
    expect(() => controller.getRelease()).toThrow();
    if (previous) process.env.GIT_COMMIT_SHA = previous;
    if (previousBuild) process.env.APP_BUILD_ID = previousBuild;
    if (previousRender) process.env.RENDER_GIT_COMMIT = previousRender;
    if (previousGithub) process.env.GITHUB_SHA = previousGithub;
  });

  it("reports db as not_configured when DATABASE_URL is unset", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const result = await controller.getHealth();
    expect(result.checks.db).toBe("not_configured");
    if (previous) process.env.DATABASE_URL = previous;
  });

  it("exposes liveness without database dependency", () => {
    expect(controller.getLive()).toEqual({ status: "ok", service: "nelna-fg-api" });
  });

  it("safe database-config diagnostic hides credentials and host", () => {
    const previous = process.env.DATABASE_URL;
    const previousNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL =
      "mongodb+srv://user:secret@cluster0.example.mongodb.net/fg_online?retryWrites=true";
    const result = controller.getDatabaseConfig({
      id: "admin-1",
      permissions: ["users:manage"],
    } as never);
    expect(result).toEqual({
      provider: "MongoDB",
      databaseConnected: true,
      databaseName: "fg_online",
      clusterDetails: "hidden",
      credentials: "hidden",
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|cluster0\.example/);
    if (previous) process.env.DATABASE_URL = previous;
    else delete process.env.DATABASE_URL;
    if (previousNode) process.env.NODE_ENV = previousNode;
    else delete process.env.NODE_ENV;
  });

  it("blocks database-config in production without admin permission", () => {
    const previousNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(() =>
      controller.getDatabaseConfig({
        id: "op-1",
        permissions: ["records:read"],
      } as never),
    ).toThrow();
    if (previousNode) process.env.NODE_ENV = previousNode;
    else delete process.env.NODE_ENV;
  });

  it("readiness is available in non-production when db is not_configured", async () => {
    const previous = process.env.DATABASE_URL;
    const previousNode = process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = "development";
    await expect(controller.getReady()).resolves.toMatchObject({ status: "ready" });
    if (previous) process.env.DATABASE_URL = previous;
    else delete process.env.DATABASE_URL;
    process.env.NODE_ENV = previousNode;
  });

  it("readiness throws when production database is down", async () => {
    const previousNode = process.env.NODE_ENV;
    const previousDb = process.env.DATABASE_URL;
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://example";
    // Prisma mock rejects → db check "down"
    await expect(controller.getReady()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    process.env.NODE_ENV = previousNode;
    if (previousDb) process.env.DATABASE_URL = previousDb;
    else delete process.env.DATABASE_URL;
  });
});
