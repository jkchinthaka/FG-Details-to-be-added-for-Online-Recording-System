import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthService, type HealthResponse } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "API health check for Nelna FG Digital Recording System" })
  @ApiOkResponse({ description: "Service is healthy" })
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
