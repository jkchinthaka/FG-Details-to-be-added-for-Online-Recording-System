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

  it("returns a structured healthy response for Nelna FG API", async () => {
    const result = await controller.getHealth();
    expect(result.status).toBe("healthy");
    expect(result.service).toBe("nelna-fg-api");
    expect(result.product).toContain("Nelna FG");
    expect(result.checks.api).toBe("up");
    expect(result.timestamp).toBeTruthy();
  });

  it("reports db as not_configured when DATABASE_URL is unset", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const result = await controller.getHealth();
    expect(result.checks.db).toBe("not_configured");
    if (previous) process.env.DATABASE_URL = previous;
  });
});
