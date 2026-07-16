import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { GlobalExceptionFilter } from "./global-exception.filter";
import { MutationProtectionGuard } from "./mutation-protection.guard";
import { AttachUserIdInterceptor } from "./attach-user-id.interceptor";

/**
 * Cross-cutting HTTP protections (FG-ERR-001 / FG-SEC-001).
 * In-memory throttling is appropriate for a single Render API instance;
 * move to Redis/storage when horizontally scaled.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "global",
        ttl: 60_000,
        limit: 120,
      },
      {
        name: "auth",
        ttl: 60_000,
        limit: 20,
      },
      {
        name: "upload",
        ttl: 60_000,
        limit: 30,
      },
      {
        name: "export",
        ttl: 60_000,
        limit: 20,
      },
    ]),
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: MutationProtectionGuard },
    { provide: APP_INTERCEPTOR, useClass: AttachUserIdInterceptor },
  ],
  exports: [ThrottlerModule],
})
export class SecurityModule {}
