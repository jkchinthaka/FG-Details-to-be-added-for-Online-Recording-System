import { Controller, Get, Header, Param, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("kinds")
  @RequirePermissions("reports:read", "audit:read", "records:check", "records:verify")
  @ApiOperation({ summary: "List available operational report kinds" })
  listKinds(@CurrentUser() user: RequestUser) {
    return this.reportsService.listKinds(user);
  }

  @Get("record-pdf/:id")
  @RequirePermissions("records:read", "reports:read")
  @ApiOperation({ summary: "Official record PDF (electronic approval disclaimer; not a cryptographic signature)" })
  async recordPdf(@Param("id") id: string, @CurrentUser() user: RequestUser, @Res() res: Response) {
    const { filename, buffer } = await this.reportsService.buildRecordPdf(user, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get("run/:kind/csv")
  @RequirePermissions("reports:read", "audit:read", "records:check", "records:verify")
  @ApiOperation({ summary: "Export report rows as CSV (formula-injection safe)" })
  @Header("Content-Type", "text/csv; charset=utf-8")
  async exportCsv(
    @Param("kind") kind: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const { filename, body } = await this.reportsService.exportCsv(user, kind, query);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(body);
  }

  @Get("run/:kind")
  @RequirePermissions("reports:read", "audit:read", "records:check", "records:verify")
  @ApiOperation({ summary: "Run a paginated operational report" })
  runReport(@Param("kind") kind: string, @Query() query: Record<string, string>, @CurrentUser() user: RequestUser) {
    return this.reportsService.runReport(user, kind, query);
  }
}
