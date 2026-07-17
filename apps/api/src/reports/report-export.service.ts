import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  REPORT_EXPORT_JOB_TTL_HOURS,
  REPORT_MAX_EXPORT_ROWS,
  reportExportJobCreateSchema,
  reportFiltersSchema,
  toCsvDocument,
  type ReportExportJobStatus,
  type ReportExportJobSummary,
  type ReportFilters,
  type ReportKind,
} from "@nelna/shared";
import type { RequestUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "./reports.service";
import { MetricsService } from "../metrics/metrics.service";

type JobRecord = {
  id: string;
  kind: string;
  status: string;
  progressPercent: number;
  rowCount: number | null;
  filename: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  downloadToken: string | null;
  resultCsv: string | null;
  requesterId: string;
};

@Injectable()
export class ReportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly metrics: MetricsService,
  ) {}

  async createJob(
    user: RequestUser,
    body: unknown,
  ): Promise<ReportExportJobSummary> {
    this.reports.assertCanReadReportsPublic(user);
    const parsed = reportExportJobCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    }
    const { kind, idempotencyKey } = parsed.data;
    if (!this.reports.isKindAllowed(user, kind)) {
      throw new ForbiddenException(`You do not have permission to run report: ${kind}`);
    }
    const filters = this.reports.applyRoleScopePublic(
      user,
      reportFiltersSchema.parse({ ...parsed.data.filters, page: 1, pageSize: 100 }),
    );

    const existing = await this.prisma.reportExportJob.findUnique({
      where: {
        requesterId_idempotencyKey: {
          requesterId: user.id,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      return this.toSummary(existing as JobRecord);
    }

    const expiresAt = new Date(
      Date.now() + REPORT_EXPORT_JOB_TTL_HOURS * 60 * 60 * 1000,
    );
    const job = await this.prisma.reportExportJob.create({
      data: {
        idempotencyKey,
        requesterId: user.id,
        kind,
        filtersJson: filters,
        status: "QUEUED",
        progressPercent: 0,
        expiresAt,
      },
    });

    // Process in-process (single-instance safe). Multi-instance would use a worker queue.
    void this.processJob(job.id).catch(() => undefined);

    return this.toSummary(job as JobRecord);
  }

  async getJob(user: RequestUser, id: string): Promise<ReportExportJobSummary> {
    const job = await this.prisma.reportExportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Export job not found");
    if (job.requesterId !== user.id && !user.permissions.includes("users:manage")) {
      throw new ForbiddenException("You may only view your own export jobs");
    }
    return this.toSummary(await this.maybeExpire(job as JobRecord));
  }

  async cancelJob(user: RequestUser, id: string): Promise<ReportExportJobSummary> {
    const job = await this.prisma.reportExportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Export job not found");
    if (job.requesterId !== user.id) {
      throw new ForbiddenException("You may only cancel your own export jobs");
    }
    if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
      return this.toSummary(job as JobRecord);
    }
    const updated = await this.prisma.reportExportJob.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        progressPercent: job.progressPercent,
      },
    });
    return this.toSummary(updated as JobRecord);
  }

  async downloadByToken(
    token: string,
  ): Promise<{ filename: string; body: string; generatedAt: string }> {
    const job = await this.prisma.reportExportJob.findUnique({
      where: { downloadToken: token },
    });
    if (!job || !job.resultCsv || !job.filename) {
      throw new NotFoundException("Download not found or expired");
    }
    if (job.status !== "COMPLETED" || job.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException("Download not found or expired");
    }
    return {
      filename: job.filename,
      body: job.resultCsv,
      generatedAt: (job.completedAt ?? job.updatedAt).toISOString(),
    };
  }

  private async processJob(jobId: string): Promise<void> {
    const started = await this.prisma.reportExportJob.updateMany({
      where: { id: jobId, status: "QUEUED" },
      data: { status: "RUNNING", startedAt: new Date(), progressPercent: 5 },
    });
    if (started.count === 0) return;

    try {
      const job = await this.prisma.reportExportJob.findUnique({ where: { id: jobId } });
      if (!job || job.status === "CANCELLED") return;

      const kind = job.kind as ReportKind;
      const filters = job.filtersJson as ReportFilters;
      const materialised = await this.reports.materialiseReportRows(
        kind,
        filters,
        REPORT_MAX_EXPORT_ROWS,
      );

      const latest = await this.prisma.reportExportJob.findUnique({ where: { id: jobId } });
      if (!latest || latest.status === "CANCELLED") return;

      const body = toCsvDocument(
        materialised.columns,
        materialised.rows.map((row) =>
          materialised.columns.map((col) => row[col] ?? ""),
        ),
      );
      const downloadToken = randomBytes(24).toString("hex");
      const filename = `${kind}-${filters.fromDate}_to_${filters.toDate}.csv`;

      await this.prisma.reportExportJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          progressPercent: 100,
          rowCount: materialised.rows.length,
          resultCsv: body,
          filename,
          downloadToken,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.metrics.increment("report_job_failures");
      await this.prisma.reportExportJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          progressPercent: 100,
          errorCode: "REPORT_EXPORT_FAILED",
          errorMessage:
            error instanceof Error ? "Export failed." : "Export failed.",
          completedAt: new Date(),
        },
      });
    }
  }

  private async maybeExpire(job: JobRecord): Promise<JobRecord> {
    if (
      (job.status === "COMPLETED" || job.status === "QUEUED" || job.status === "RUNNING") &&
      job.expiresAt.getTime() < Date.now()
    ) {
      const updated = await this.prisma.reportExportJob.update({
        where: { id: job.id },
        data: {
          status: "EXPIRED",
          resultCsv: null,
          downloadToken: null,
        },
      });
      return updated as JobRecord;
    }
    return job;
  }

  private toSummary(job: JobRecord): ReportExportJobSummary {
    const expired = job.expiresAt.getTime() < Date.now();
    const status = (expired && job.status === "COMPLETED"
      ? "EXPIRED"
      : job.status) as ReportExportJobStatus;
    return {
      id: job.id,
      kind: job.kind as ReportKind,
      status,
      progressPercent: job.progressPercent,
      rowCount: job.rowCount,
      filename: job.filename,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      expiresAt: job.expiresAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      downloadToken:
        status === "COMPLETED" && job.downloadToken && !expired
          ? job.downloadToken
          : null,
      generatedAt: (job.completedAt ?? job.updatedAt).toISOString(),
    };
  }
}
