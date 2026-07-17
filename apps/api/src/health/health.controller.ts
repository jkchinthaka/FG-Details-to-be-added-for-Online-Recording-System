import { Controller, Get, Req, ForbiddenException } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { getSafeDatabaseConfigDiagnostic } from "../config/validate-production-env";
import { HealthService, type HealthResponse } from "./health.service";
import { MetricsService } from "../metrics/metrics.service";

@ApiTags("health")
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metrics: MetricsService,
  ) {}

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

  /**
   * FG-MON-001 — process-local RED metrics. Authenticated in production.
   */
  @Get("metrics")
  @ApiOperation({
    summary:
      "Safe process-local RED metrics (no PII). Production requires admin/audit permission.",
  })
  getMetrics(@CurrentUser() user: RequestUser) {
    if (process.env.NODE_ENV === "production") {
      const perms = new Set(user.permissions ?? []);
      if (!perms.has("users:manage") && !perms.has("audit:read")) {
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "Metrics require an administrator permission.",
        });
      }
    }
    return this.healthService.getMetricsSnapshot(this.metrics);
  }

  /**
   * FG-SEC-002 — database-config is authenticated in production.
   * Public only outside production for local diagnostics.
   */
  @Get("database-config")
  @ApiOperation({
    summary:
      "Safe database configuration diagnostic (provider/name only). Never returns host or credentials.",
  })
  getDatabaseConfig(@CurrentUser() user: RequestUser) {
    if (process.env.NODE_ENV === "production") {
      const perms = new Set(user.permissions ?? []);
      if (!perms.has("users:manage") && !perms.has("audit:read")) {
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "Diagnostics require an administrator permission.",
        });
      }
    }

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
