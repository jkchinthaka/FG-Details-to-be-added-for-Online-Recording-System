import { Injectable, Logger } from "@nestjs/common";
import {
  RECORD_TYPE_META,
  recordTypeForDocumentCode,
  type RecentRecordSummary,
  type RecentRecordsResponse,
  type RecordStatus,
} from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

type RecentRecordRow = {
  id: string;
  documentCode: string;
  status: string;
  areaLabel: string | null;
  submittedAt: Date | null;
  updatedAt: Date;
};

/**
 * Backs the compact "Recent records" list on the mobile dashboard — a short,
 * scoped history rather than a full paginated table (see docs/records.md).
 */
@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRecentRecords(
    user: RequestUser,
    limitInput?: number,
  ): Promise<RecentRecordsResponse> {
    const take = clampLimit(limitInput);
    // A pure FG Operator only ever sees their own recent submissions; every
    // other role (supervisor/QA/food safety/auditor/admin) gets factory-wide
    // recent activity, matching their broader oversight scope.
    const isOperatorOnly =
      user.roles.length > 0 && user.roles.every((role) => role === "FG_OPERATOR");

    const records = await this.safeQuery(
      () =>
        this.prisma.inspectionRecord.findMany({
          where: isOperatorOnly ? { createdById: user.id } : undefined,
          orderBy: { updatedAt: "desc" },
          take,
        }),
      [] as RecentRecordRow[],
      "recent records",
    );

    return { records: records.map(toRecentRecordSummary) };
  }

  private async safeQuery<T>(
    run: () => Promise<T>,
    fallback: T,
    label: string,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      this.logger.warn(
        `Failed to load ${label}; degrading gracefully. ${error instanceof Error ? error.message : String(error)}`,
      );
      return fallback;
    }
  }
}

function clampLimit(limitInput: number | undefined): number {
  if (!limitInput || Number.isNaN(limitInput) || limitInput < 1) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(limitInput), MAX_LIMIT);
}

function toRecentRecordSummary(record: RecentRecordRow): RecentRecordSummary {
  const recordType = recordTypeForDocumentCode(record.documentCode);
  return {
    id: record.id,
    documentCode: record.documentCode,
    title: recordType ? RECORD_TYPE_META[recordType].title : record.documentCode,
    status: record.status as RecordStatus,
    areaLabel: record.areaLabel,
    submittedAt: record.submittedAt ? record.submittedAt.toISOString() : null,
    updatedAt: record.updatedAt.toISOString(),
  };
}
