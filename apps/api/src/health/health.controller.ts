import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { getSafeDatabaseConfigDiagnostic } from "../config/validate-production-env";
import { HealthService, type HealthResponse } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      "Aggregated health (liveness + dependency status). Omits secrets and host infrastructure detail.",
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

  @Public()
  @Get("release")
  @ApiOperation({
    summary:
      "Safe release manifest (Git commit SHA). Used to prove Cloudflare and Render share the same authorized build.",
  })
  getRelease() {
    return this.healthService.getReleaseManifest();
  }

  @Public()
  @Get("database-config")
  @ApiOperation({
    summary:
      "Safe database configuration diagnostic (provider/name only). Never returns host or credentials.",
  })
  getDatabaseConfig() {
    const configured = getSafeDatabaseConfigDiagnostic();
    return {
      provider: configured.provider,
      databaseConnected: configured.databaseConnectedHint === "configured",
      databaseName: configured.databaseName,
      clusterDetails: "hidden" as const,
      credentials: "hidden" as const,
    };
  }
}
