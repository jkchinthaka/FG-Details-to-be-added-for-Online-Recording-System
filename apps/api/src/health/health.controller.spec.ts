import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("returns ok status for Nelna FG API", () => {
    const result = controller.getHealth();
    expect(result.status).toBe("ok");
    expect(result.service).toBe("nelna-fg-api");
    expect(result.product).toContain("Nelna FG");
  });
});
