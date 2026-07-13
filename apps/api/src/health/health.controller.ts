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
  @ApiOperation({ summary: "API health check for Nelna FG Digital Recording System" })
  @ApiOkResponse({ description: "Service is healthy" })
  getHealth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }
}
