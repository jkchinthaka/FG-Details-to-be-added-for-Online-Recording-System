import { Global, Module } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

/** Shared instance so middleware and Nest providers observe the same counters. */
export const metricsServiceSingleton = new MetricsService();

@Global()
@Module({
  providers: [{ provide: MetricsService, useValue: metricsServiceSingleton }],
  exports: [MetricsService],
})
export class MetricsModule {}
