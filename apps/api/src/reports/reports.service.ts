import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  DOCUMENT_CODES,
  OFFICIAL_RECORD_APPROVAL_DISCLAIMER,
  REPORT_KIND_LABELS,
  REPORT_KINDS,
  REPORT_MAX_EXPORT_ROWS,
  REPORT_SYNC_EXPORT_MAX_ROWS,
  formatRecordNumber,
  reportFiltersSchema,
  reportKindsForRoles,
  toCsvDocument,
  toCsvRow,
  type PermissionKey,
  type ReportFilters,
  type ReportKind,
  type ReportResult,
  type ReportRow,
} from "@nelna/shared";
import { Prisma } from "../../generated/prisma-client";
import type { RequestUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { buildOfficialRecordPdf } from "./record-pdf.builder";

function hasPermission(user: RequestUser, key: PermissionKey): boolean {
  return user.permissions.includes(key);
}

function isOperatorOnly(user: RequestUser): boolean {
  return user.roles.length > 0 && user.roles.every((role) => role === "FG_OPERATOR");
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  listKinds(user: RequestUser): Array<{ kind: ReportKind; title: string }> {
    this.assertCanReadReports(user);
    return this.allowedKinds(user).map((kind) => ({
      kind,
      title: REPORT_KIND_LABELS[kind],
    }));
  }

  async runReport(
    user: RequestUser,
    kind: string,
    rawFilters: unknown,
  ): Promise<ReportResult> {
    this.assertCanReadReports(user);
    if (!(REPORT_KINDS as readonly string[]).includes(kind)) {
      throw new BadRequestException(`Unknown report kind: ${kind}`);
    }
    const reportKind = kind as ReportKind;
    if (!this.allowedKinds(user).includes(reportKind)) {
      throw new ForbiddenException(`You do not have permission to run report: ${kind}`);
    }
    const parsed = reportFiltersSchema.safeParse(rawFilters ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const filters = this.applyRoleScope(user, parsed.data);
    const { rows, totalRows, columns } = await this.computeReport(
      reportKind,
      filters,
      user,
    );

    return {
      kind: reportKind,
      title: REPORT_KIND_LABELS[reportKind],
      generatedAt: new Date().toISOString(),
      filters,
      page: filters.page,
      pageSize: filters.pageSize,
      totalRows,
      columns,
      rows,
    };
  }

  /**
   * Sync CSV for small result sets only (Worker ~30s proxy budget).
   * Larger exports must use ReportExportService jobs.
   */
  async exportCsv(
    user: RequestUser,
    kind: string,
    rawFilters: unknown,
  ): Promise<
    | { mode: "inline"; filename: string; body: string; generatedAt: string; rowCount: number }
    | {
        mode: "too_large";
        totalRows: number;
        syncMaxRows: number;
        message: string;
      }
  > {
    this.assertCanReadReports(user);
    if (!(REPORT_KINDS as readonly string[]).includes(kind)) {
      throw new BadRequestException(`Unknown report kind: ${kind}`);
    }
    const reportKind = kind as ReportKind;
    if (!this.allowedKinds(user).includes(reportKind)) {
      throw new ForbiddenException(`You do not have permission to run report: ${kind}`);
    }
    const parsed = reportFiltersSchema.safeParse({
      ...(typeof rawFilters === "object" && rawFilters ? rawFilters : {}),
      page: 1,
      pageSize: REPORT_SYNC_EXPORT_MAX_ROWS,
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const filters = this.applyRoleScope(user, parsed.data);
    const materialised = await this.materialiseReportRows(
      reportKind,
      filters,
      REPORT_SYNC_EXPORT_MAX_ROWS + 1,
    );
    if (materialised.totalRows > REPORT_SYNC_EXPORT_MAX_ROWS) {
      return {
        mode: "too_large",
        totalRows: materialised.totalRows,
        syncMaxRows: REPORT_SYNC_EXPORT_MAX_ROWS,
        message:
          "Report exceeds the synchronous export limit. Create a background export job instead.",
      };
    }
    const generatedAt = new Date().toISOString();
    const body = toCsvDocument(
      materialised.columns,
      materialised.rows.map((row) => materialised.columns.map((col) => row[col] ?? "")),
    );
    return {
      mode: "inline",
      filename: `${kind}-${filters.fromDate}_to_${filters.toDate}.csv`,
      body,
      generatedAt,
      rowCount: materialised.rows.length,
    };
  }

  /** Materialise up to `limit` rows for CSV/job use (bounded). */
  async materialiseReportRows(
    kind: ReportKind,
    filters: ReportFilters,
    limit: number,
    user?: RequestUser,
  ): Promise<{ columns: string[]; rows: ReportRow[]; totalRows: number }> {
    const capped = Math.min(Math.max(1, limit), REPORT_MAX_EXPORT_ROWS);
    const pageFilters: ReportFilters = {
      ...filters,
      page: 1,
      pageSize: capped,
    };
    return this.computeReport(
      kind,
      pageFilters,
      user ??
        ({
          id: "system",
          permissions: ["reports:read", "audit:read"],
          roles: ["SYSTEM_ADMINISTRATOR"],
        } as RequestUser),
      { exportMode: true, exportLimit: capped },
    );
  }

  assertCanReadReportsPublic(user: RequestUser): void {
    this.assertCanReadReports(user);
  }

  isKindAllowed(user: RequestUser, kind: ReportKind): boolean {
    return this.allowedKinds(user).includes(kind);
  }

  applyRoleScopePublic(user: RequestUser, filters: ReportFilters): ReportFilters {
    return this.applyRoleScope(user, filters);
  }

  /** Stream CSV rows to an Express response (bounded). */
  writeCsvStream(
    res: { write: (chunk: string) => boolean; end: () => void },
    columns: string[],
    rows: ReportRow[],
  ): void {
    res.write(`${toCsvRow(columns)}\r\n`);
    for (const row of rows) {
      res.write(`${toCsvRow(columns.map((col) => row[col] ?? ""))}\r\n`);
    }
    res.end();
  }

  async buildRecordPdf(
    user: RequestUser,
    recordId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const record = await this.prisma.inspectionRecord.findUnique({
      where: { id: recordId },
      include: {
        createdBy: { select: { id: true, fullName: true, employeeCode: true } },
        checkedBy: { select: { id: true, fullName: true, employeeCode: true } },
        verifiedBy: { select: { id: true, fullName: true, employeeCode: true } },
        shift: true,
        section: true,
        templateVersion: { include: { template: true } },
        results: {
          include: {
            item: true,
            attachments: true,
            correctiveActions: true,
          },
        },
        truckDetail: { include: { vehicle: true, transporter: true, decidedBy: true } },
        approvals: { orderBy: { createdAt: "asc" }, include: { decidedBy: true } },
      },
    });
    if (!record) throw new NotFoundException(`Record ${recordId} not found`);
    this.assertCanViewRecord(user, record.createdById);

    const recordNumber = formatRecordNumber(
      record.documentCode,
      record.recordDate.toISOString().slice(0, 10),
      record.id,
    );
    const buffer = await buildOfficialRecordPdf({
      brandProduct: "Nelna FG Digital Recording System",
      documentTitle: record.templateVersion.template.title,
      documentCode: record.documentCode,
      revisionNumber: record.templateVersion.versionNumber,
      recordNumber,
      recordDate: record.recordDate.toISOString().slice(0, 10),
      submittedAt: record.submittedAt?.toISOString() ?? null,
      sectionName: record.section?.name ?? record.areaLabel,
      shiftName: record.shift?.name ?? null,
      status: record.status,
      recordedBy: `${record.createdBy.fullName} (${record.createdBy.employeeCode})`,
      checkedBy: record.checkedBy
        ? `${record.checkedBy.fullName} (${record.checkedBy.employeeCode}) at ${record.checkedAt?.toISOString() ?? ""}`
        : null,
      verifiedBy: record.verifiedBy
        ? `${record.verifiedBy.fullName} (${record.verifiedBy.employeeCode}) at ${record.verifiedAt?.toISOString() ?? ""}`
        : null,
      truck: record.truckDetail
        ? {
            freezerTruckNumber: record.truckDetail.freezerTruckNumber,
            vehicleNumber: record.truckDetail.vehicleNumber,
            loadingDecision: record.truckDetail.loadingDecision,
            decidedBy: record.truckDetail.decidedBy?.fullName ?? null,
          }
        : null,
      results: record.results.map((r) => ({
        label: r.item.label,
        status: r.status,
        issueReason: r.issueReason,
        correction: r.correction,
        correctiveAction: r.correctiveAction,
        evidenceCount: r.attachments.length,
        caCount: r.correctiveActions.length,
      })),
      approvals: record.approvals.map((a) => ({
        type: a.approvalType,
        decision: a.decision,
        by: a.decidedBy?.fullName ?? null,
        at: a.decidedAt?.toISOString() ?? null,
        comments: a.comments,
      })),
      disclaimer: OFFICIAL_RECORD_APPROVAL_DISCLAIMER,
      generatedAt: new Date().toISOString(),
      auditReference: record.id,
    });

    return { filename: `${recordNumber.replace(/\//g, "-")}.pdf`, buffer };
  }

  private allowedKinds(user: RequestUser): ReportKind[] {
    let kinds = reportKindsForRoles(user.roles);
    if (
      kinds.length === 0 &&
      (hasPermission(user, "reports:read") || hasPermission(user, "records:check"))
    ) {
      kinds = [...REPORT_KINDS];
    }
    if (!hasPermission(user, "audit:read")) {
      kinds = kinds.filter((kind) => kind !== "audit_activity_summary");
    }
    return kinds;
  }

  private assertCanReadReports(user: RequestUser): void {
    if (hasPermission(user, "reports:read") || hasPermission(user, "audit:read")) {
      return;
    }
    // Supervisors may access operational queue-style reports via records:check
    if (hasPermission(user, "records:check") || hasPermission(user, "records:verify")) {
      return;
    }
    throw new ForbiddenException("You do not have permission to view reports");
  }

  private assertCanViewRecord(user: RequestUser, createdById: string): void {
    if (isOperatorOnly(user) && createdById !== user.id) {
      throw new ForbiddenException("Operators may only export their own record PDFs");
    }
    if (
      !hasPermission(user, "records:read") &&
      !hasPermission(user, "reports:read") &&
      !(isOperatorOnly(user) && createdById === user.id)
    ) {
      throw new ForbiddenException("You do not have permission to export this record");
    }
  }

  private applyRoleScope(user: RequestUser, filters: ReportFilters): ReportFilters {
    if (isOperatorOnly(user)) {
      return { ...filters, userId: user.id };
    }
    return filters;
  }

  private dateFilter(filters: ReportFilters): Prisma.InspectionRecordWhereInput {
    const where: Prisma.InspectionRecordWhereInput = {
      recordDate: {
        gte: new Date(`${filters.fromDate}T00:00:00.000Z`),
        lte: new Date(`${filters.toDate}T00:00:00.000Z`),
      },
    };
    if (filters.documentCode) where.documentCode = filters.documentCode;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.status) where.status = filters.status;
    if (filters.userId) where.createdById = filters.userId;
    if (filters.shiftCode) where.shift = { code: filters.shiftCode };
    if (filters.vehicleId) where.truckDetail = { vehicleId: filters.vehicleId };
    return where;
  }

  private async computeReport(
    kind: ReportKind,
    filters: ReportFilters,
    user: RequestUser,
    options?: { exportMode?: boolean; exportLimit?: number },
  ): Promise<{ rows: ReportRow[]; totalRows: number; columns: string[] }> {
    const where = this.dateFilter(filters);
    const page = filters.page;
    const pageSize = options?.exportMode
      ? Math.min(options.exportLimit ?? REPORT_MAX_EXPORT_ROWS, REPORT_MAX_EXPORT_ROWS)
      : filters.pageSize;
    const skip = options?.exportMode ? 0 : (page - 1) * pageSize;

    switch (kind) {
      case "daily_record_completion": {
        const grouped = await this.prisma.inspectionRecord.groupBy({
          by: ["recordDate", "status"],
          where,
          _count: { _all: true },
          orderBy: { recordDate: "asc" },
        });
        const columns = ["recordDate", "status", "count"];
        const allRows = grouped.map((g) => ({
          recordDate: g.recordDate.toISOString().slice(0, 10),
          status: g.status,
          count: g._count._all,
        }));
        const rows = options?.exportMode
          ? allRows.slice(0, pageSize)
          : allRows.slice(skip, skip + pageSize);
        return { columns, rows, totalRows: allRows.length };
      }
      case "daily_failed_items": {
        const resultWhere = {
          status: filters.failureType
            ? (filters.failureType as "FAIL" | "UNACCEPTABLE")
            : { in: ["FAIL", "UNACCEPTABLE"] as Array<"FAIL" | "UNACCEPTABLE"> },
          record: where,
        };
        const [totalRows, results] = await Promise.all([
          this.prisma.inspectionResult.count({ where: resultWhere }),
          this.prisma.inspectionResult.findMany({
            where: resultWhere,
            select: {
              status: true,
              issueReason: true,
              item: { select: { label: true, id: true } },
              record: { select: { recordDate: true, documentCode: true, id: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
          }),
        ]);
        const columns = [
          "recordDate",
          "documentCode",
          "itemId",
          "itemLabel",
          "status",
          "issueReason",
          "recordId",
        ];
        const rows = results.map((r) => ({
          recordDate: r.record.recordDate.toISOString().slice(0, 10),
          documentCode: r.record.documentCode,
          itemId: r.item.id,
          itemLabel: r.item.label,
          status: r.status,
          issueReason: r.issueReason,
          recordId: r.record.id,
        }));
        return { columns, rows, totalRows };
      }
      case "pending_checks": {
        return this.listStatusRows(
          {
            ...where,
            status: { in: ["PENDING_CHECK", "SUBMITTED", "RESUBMITTED"] },
          },
          skip,
          pageSize,
        );
      }
      case "pending_verifications": {
        return this.listStatusRows(
          {
            ...where,
            status: { in: ["PENDING_VERIFICATION", "CHECKED"] },
          },
          skip,
          pageSize,
        );
      }
      case "cleaning_compliance": {
        return this.complianceRows({
          ...where,
          documentCode: DOCUMENT_CODES.DAILY_CLEANING,
        });
      }
      case "finished_goods_section_compliance": {
        return this.complianceRows({
          ...where,
          documentCode: DOCUMENT_CODES.DAILY_CLEANING,
          OR: [
            { areaLabel: { contains: "Finished", mode: "insensitive" } },
            { areaLabel: { contains: "FG", mode: "insensitive" } },
          ],
        });
      }
      case "changing_room_compliance": {
        return this.complianceRows({
          ...where,
          documentCode: DOCUMENT_CODES.DAILY_CLEANING,
          areaLabel: { contains: "Changing", mode: "insensitive" },
        });
      }
      case "truck_inspections": {
        return this.listStatusRows(
          {
            ...where,
            documentCode: DOCUMENT_CODES.FREEZER_TRUCK,
          },
          skip,
          pageSize,
        );
      }
      case "truck_pass_fail_trend": {
        const trucks = await this.prisma.truckInspectionDetail.groupBy({
          by: ["loadingDecision"],
          where: { record: where },
          _count: { _all: true },
        });
        const columns = ["loadingDecision", "count"];
        const allRows = trucks.map((t) => ({
          loadingDecision: t.loadingDecision,
          count: t._count._all,
        }));
        return this.pageRows(columns, allRows, skip, pageSize);
      }
      case "blocked_trucks": {
        const blockedWhere = {
          loadingDecision: "LOADING_BLOCKED" as const,
          record: where,
        };
        const [totalRows, blocked] = await Promise.all([
          this.prisma.truckInspectionDetail.count({ where: blockedWhere }),
          this.prisma.truckInspectionDetail.findMany({
            where: blockedWhere,
            select: {
              freezerTruckNumber: true,
              vehicleNumber: true,
              loadingDecision: true,
              record: { select: { id: true, recordDate: true, status: true } },
            },
            orderBy: { record: { recordDate: "desc" } },
            skip,
            take: pageSize,
          }),
        ]);
        const columns = [
          "recordDate",
          "freezerTruckNumber",
          "vehicleNumber",
          "loadingDecision",
          "status",
          "recordId",
        ];
        const rows = blocked.map((b) => ({
          recordDate: b.record.recordDate.toISOString().slice(0, 10),
          freezerTruckNumber: b.freezerTruckNumber,
          vehicleNumber: b.vehicleNumber,
          loadingDecision: b.loadingDecision,
          status: b.record.status,
          recordId: b.record.id,
        }));
        return { columns, rows, totalRows };
      }
      case "common_failure_reasons": {
        const failed = await this.prisma.inspectionResult.groupBy({
          by: ["issueReason"],
          where: {
            status: { in: ["FAIL", "UNACCEPTABLE"] },
            issueReason: { not: null },
            record: where,
          },
          _count: { _all: true },
          orderBy: { _count: { issueReason: "desc" } },
          take: 100,
        });
        const columns = ["issueReason", "count"];
        const rows = failed.map((f) => ({
          issueReason: f.issueReason,
          count: f._count._all,
        }));
        return { columns, rows, totalRows: rows.length };
      }
      case "corrective_action_status": {
        const grouped = await this.prisma.correctiveAction.groupBy({
          by: ["status", "priority"],
          where: {
            ...(filters.priority ? { priority: filters.priority } : {}),
            ...(filters.correctiveActionOwnerId
              ? { assignedToId: filters.correctiveActionOwnerId }
              : {}),
            record: where,
          },
          _count: { _all: true },
        });
        const columns = ["status", "priority", "count"];
        const rows = grouped.map((g) => ({
          status: g.status,
          priority: g.priority,
          count: g._count._all,
        }));
        return { columns, rows, totalRows: rows.length };
      }
      case "overdue_corrective_actions": {
        const now = new Date();
        const overdue = await this.prisma.correctiveAction.findMany({
          where: {
            dueDate: { lt: now },
            status: { in: ["OPEN", "IN_PROGRESS"] },
            ...(filters.correctiveActionOwnerId
              ? { assignedToId: filters.correctiveActionOwnerId }
              : {}),
            ...(filters.priority ? { priority: filters.priority } : {}),
            record: where,
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            assignedTo: { select: { fullName: true } },
            record: { select: { id: true, documentCode: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 5000,
        });
        const columns = [
          "dueDate",
          "title",
          "status",
          "priority",
          "assignee",
          "documentCode",
          "recordId",
          "caId",
        ];
        const rows = overdue.map((o) => ({
          dueDate: o.dueDate?.toISOString().slice(0, 10) ?? null,
          title: o.title,
          status: o.status,
          priority: o.priority,
          assignee: o.assignedTo?.fullName ?? null,
          documentCode: o.record?.documentCode ?? null,
          recordId: o.record?.id ?? null,
          caId: o.id,
        }));
        return { columns, rows, totalRows: rows.length };
      }
      case "user_wise_record_completion": {
        const grouped = await this.prisma.inspectionRecord.groupBy({
          by: ["createdById", "status"],
          where,
          _count: { _all: true },
        });
        const userIds = [...new Set(grouped.map((g) => g.createdById))];
        const users = await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, employeeCode: true },
        });
        const byId = new Map(users.map((u) => [u.id, u]));
        const columns = ["employeeCode", "fullName", "status", "count"];
        const rows = grouped.map((g) => ({
          employeeCode: byId.get(g.createdById)?.employeeCode ?? g.createdById,
          fullName: byId.get(g.createdById)?.fullName ?? null,
          status: g.status,
          count: g._count._all,
        }));
        return { columns, rows, totalRows: rows.length };
      }
      case "section_wise_compliance": {
        const grouped = await this.prisma.inspectionRecord.groupBy({
          by: ["sectionId", "status"],
          where,
          _count: { _all: true },
        });
        const sectionIds = grouped
          .map((g) => g.sectionId)
          .filter((id): id is string => Boolean(id));
        const sections = await this.prisma.section.findMany({
          where: { id: { in: sectionIds } },
          select: { id: true, name: true, code: true },
        });
        const byId = new Map(sections.map((s) => [s.id, s]));
        const columns = ["sectionCode", "sectionName", "status", "count"];
        const rows = grouped.map((g) => ({
          sectionCode: g.sectionId ? (byId.get(g.sectionId)?.code ?? g.sectionId) : null,
          sectionName: g.sectionId
            ? (byId.get(g.sectionId)?.name ?? null)
            : "(unassigned)",
          status: g.status,
          count: g._count._all,
        }));
        return { columns, rows, totalRows: rows.length };
      }
      case "audit_activity_summary": {
        if (!hasPermission(user, "audit:read") && !hasPermission(user, "reports:read")) {
          throw new ForbiddenException(
            "Audit activity summary requires audit or reports access",
          );
        }
        const from = new Date(`${filters.fromDate}T00:00:00.000Z`);
        const to = new Date(`${filters.toDate}T23:59:59.999Z`);
        const grouped = await this.prisma.auditLog.groupBy({
          by: ["action"],
          where: { createdAt: { gte: from, lte: to } },
          _count: { _all: true },
          orderBy: { _count: { action: "desc" } },
          take: 200,
        });
        const columns = ["action", "count"];
        const rows = grouped.map((g) => ({ action: g.action, count: g._count._all }));
        return { columns, rows, totalRows: rows.length };
      }
      default:
        throw new BadRequestException(`Unhandled report kind: ${kind}`);
    }
  }

  private pageRows(
    columns: string[],
    allRows: ReportRow[],
    skip: number,
    pageSize: number,
  ): { rows: ReportRow[]; totalRows: number; columns: string[] } {
    return {
      columns,
      totalRows: allRows.length,
      rows: allRows.slice(skip, skip + pageSize),
    };
  }

  private async listStatusRows(
    where: Prisma.InspectionRecordWhereInput,
    skip: number,
    pageSize: number,
  ): Promise<{ rows: ReportRow[]; totalRows: number; columns: string[] }> {
    const [totalRows, records] = await Promise.all([
      this.prisma.inspectionRecord.count({ where }),
      this.prisma.inspectionRecord.findMany({
        where,
        select: {
          id: true,
          documentCode: true,
          status: true,
          recordDate: true,
          areaLabel: true,
          createdBy: { select: { fullName: true, employeeCode: true } },
        },
        orderBy: { recordDate: "desc" },
        skip,
        take: pageSize,
      }),
    ]);
    const columns = [
      "recordDate",
      "documentCode",
      "status",
      "areaLabel",
      "employeeCode",
      "fullName",
      "recordId",
    ];
    const rows = records.map((r) => ({
      recordDate: r.recordDate.toISOString().slice(0, 10),
      documentCode: r.documentCode,
      status: r.status,
      areaLabel: r.areaLabel,
      employeeCode: r.createdBy.employeeCode,
      fullName: r.createdBy.fullName,
      recordId: r.id,
    }));
    return { columns, rows, totalRows };
  }

  private async complianceRows(
    where: Prisma.InspectionRecordWhereInput,
  ): Promise<{ rows: ReportRow[]; totalRows: number; columns: string[] }> {
    const grouped = await this.prisma.inspectionRecord.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });
    const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
    const verified = grouped
      .filter((g) => g.status === "VERIFIED" || g.status === "COMPLETED")
      .reduce((sum, g) => sum + g._count._all, 0);
    const columns = [
      "status",
      "count",
      "total",
      "verifiedOrCompleted",
      "complianceRatePercent",
    ];
    const rows: ReportRow[] = grouped.map((g) => ({
      status: g.status,
      count: g._count._all,
      total,
      verifiedOrCompleted: verified,
      complianceRatePercent:
        total === 0 ? null : Math.round((verified / total) * 1000) / 10,
    }));
    if (rows.length === 0) {
      rows.push({
        status: null,
        count: 0,
        total: 0,
        verifiedOrCompleted: 0,
        complianceRatePercent: null,
      });
    }
    return { columns, rows, totalRows: rows.length };
  }
}
