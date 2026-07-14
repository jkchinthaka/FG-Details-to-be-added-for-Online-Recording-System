import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { HealthService, type HealthResponse } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: "Aggregated health (liveness + dependency status). Omits secrets and host infrastructure detail.",
  })
  @ApiOkResponse({ description: "healthy or degraded with check details" })
  getHealth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }

  @Public()
  @Get("live")
  @ApiOperation({ summary: "Liveness probe — process is running" })
  getLive() {
    return this.healthService.getLiveness();
  }

  @Public()
  @Get("ready")
  @ApiOperation({ summary: "Readiness probe — safe to receive traffic" })
  getReady() {
    return this.healthService.getReadiness();
  }
}
