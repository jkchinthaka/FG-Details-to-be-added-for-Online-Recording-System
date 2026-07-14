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
          useValue: { $queryRaw: jest.fn().mockRejectedValue(new Error("no db in unit test")) },
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
    await expect(controller.getReady()).rejects.toBeInstanceOf(ServiceUnavailableException);
    process.env.NODE_ENV = previousNode;
    if (previousDb) process.env.DATABASE_URL = previousDb;
    else delete process.env.DATABASE_URL;
  });
});
