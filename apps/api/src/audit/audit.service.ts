import { Injectable, Logger } from "@nestjs/common";
import { redactAuditDiff, redactForLog } from "@nelna/shared";
import { Prisma } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";

export type AuditWriteInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Central append-only audit writer (FG-AUD-001).
 * Exposes create only — no update/delete helpers.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async append(input: AuditWriteInput): Promise<void> {
    const metadata = redactForLog({
      ...(input.metadata ?? {}),
      reason: input.reason ?? undefined,
      requestId: input.requestId ?? undefined,
      ip: input.ip ?? undefined,
      userAgent: input.userAgent ? String(input.userAgent).slice(0, 300) : undefined,
      before: redactAuditDiff(input.before ?? null) ?? undefined,
      after: redactAuditDiff(input.after ?? null) ?? undefined,
    }) as Record<string, unknown>;

    // Strip accidental secrets if callers passed them at top level.
    for (const key of Object.keys(metadata)) {
      if (/password|token|secret|authorization|cookie|database_url/i.test(key)) {
        metadata[key] = "[REDACTED]";
      }
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? undefined,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? undefined,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify(
          redactForLog({
            event: "audit_append_failed",
            action: input.action,
            entityType: input.entityType,
            message: error instanceof Error ? error.message : String(error),
          }),
        ),
      );
    }
  }
}
