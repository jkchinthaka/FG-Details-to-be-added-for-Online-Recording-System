import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { PayloadTooLargeException } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { Public } from "../auth/decorators/public.decorator";
import type { RequestUser } from "../auth/auth.types";
import { ReportsService } from "./reports.service";
import { ReportExportService } from "./report-export.service";

@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportExportService: ReportExportService,
  ) {}

  @Get("kinds")
  @RequirePermissions("reports:read", "audit:read", "records:check", "records:verify")
  @ApiOperation({ summary: "List available operational report kinds" })
  listKinds(@CurrentUser() user: RequestUser) {
    return this.reportsService.listKinds(user);
  }

  @Throttle({ export: { limit: 15, ttl: 60_000 }, global: { limit: 15, ttl: 60_000 } })
  @Get("record-pdf/:id")
  @RequirePermissions("records:read", "reports:read")
  @ApiOperation({
    summary:
      "Official record PDF (electronic approval disclaimer; not a cryptographic signature)",
  })
  async recordPdf(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.reportsService.buildRecordPdf(user, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Report-Generated-At", new Date().toISOString());
    // Bound response size exposure for proxies.
    if (buffer.length > 8 * 1024 * 1024) {
      throw new PayloadTooLargeException({
        code: "PDF_TOO_LARGE",
        message: "Record PDF exceeds the export size limit.",
      });
    }
    res.send(buffer);
  }

  @Throttle({ export: { limit: 15, ttl: 60_000 }, global: { limit: 15, ttl: 60_000 } })
  @Get("run/:kind/csv")
  @RequirePermissions("reports:read", "audit:read", "records:check", "records:verify")
  @ApiOperation({
    summary:
      "Export report rows as CSV (sync, bounded). Large exports must use POST /reports/exports.",
  })
  async exportCsv(
    @Param("kind") kind: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.exportCsv(user, kind, query);
    if (result.mode === "too_large") {
      throw new PayloadTooLargeException({
        code: "REPORT_TOO_LARGE_FOR_SYNC",
        message: result.message,
        syncMaxRows: result.syncMaxRows,
        totalRows: result.totalRows,
        retryable: false,
      });
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.setHeader("X-Report-Generated-At", result.generatedAt);
    res.setHeader("X-Report-Row-Count", String(result.rowCount));
    res.send(result.body);
  }

  @Throttle({ export: { limit: 20, ttl: 60_000 }, global: { limit: 20, ttl: 60_000 } })
  @Post("exports")
  @HttpCode(202)
  @RequirePermissions("reports:read", "audit:read", "records:check", "records:verify")
  @ApiOperation({
    summary:
      "Create an idempotent background CSV export job (for results above the sync limit)",
  })
  createExport(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.reportExportService.createJob(user, body);
  }

  @Public()
  @Throttle({ export: { limit: 30, ttl: 60_000 }, global: { limit: 30, ttl: 60_000 } })
  @Get("exports/download/:token")
  @ApiOperation({
    summary: "Download a completed export by expiring opaque token (no session cookie required)",
  })
  @Header("Content-Type", "text/csv; charset=utf-8")
  async downloadExport(@Param("token") token: string, @Res() res: Response) {
    const file = await this.reportExportService.downloadByToken(token);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("X-Report-Generated-At", file.generatedAt);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.body);
  }

  @Get("exports/:id")
  @RequirePermissions("reports:read", "audit:read", "records:check", "records:verify")
  @ApiOperation({ summary: "Get background export job status/progress" })
  getExport(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.reportExportService.getJob(user, id);
  }

  @Post("exports/:id/cancel")
  @RequirePermissions("reports:read", "audit:read", "records:check", "records:verify")
  @ApiOperation({ summary: "Cancel a queued/running export job" })
  cancelExport(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.reportExportService.cancelJob(user, id);
  }

  @Get("run/:kind")
  @RequirePermissions("reports:read", "audit:read", "records:check", "records:verify")
  @ApiOperation({ summary: "Run a paginated operational report (DB-bounded page)" })
  runReport(
    @Param("kind") kind: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reportsService.runReport(user, kind, query);
  }
}
