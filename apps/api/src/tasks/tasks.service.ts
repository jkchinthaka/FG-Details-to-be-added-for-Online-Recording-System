import { Injectable, Logger } from "@nestjs/common";
import {
  RECORD_TYPE_META,
  actionForOwnTaskStatus,
  bucketForOwnTaskStatus,
  computeDashboardSummary,
  hrefForRecordType,
  recordTypeForDocumentCode,
  type AdminShortcut,
  type ComplianceIndicator,
  type TaskCard,
  type TaskStatus,
  type TodaysTasksResponse,
  type UserRole,
} from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";

const MAX_QUEUE_ITEMS = 10;
const MAX_EXCEPTION_ITEMS = 5;

function hasAnyRole(roles: UserRole[], allowed: UserRole[]): boolean {
  return allowed.some((role) => roles.includes(role));
}

/** Midnight UTC for the given date's calendar day — matches how `dueDate`
 *  (a Prisma `@db.Date` column) is written by the seed script, so "today"
 *  never drifts between what was seeded and what this service reads back. */
function atMidnightUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Accepts an optional `YYYY-MM-DD` override (used by tests/tooling); falls
 *  back to today whenever the override is missing or malformed. */
function parseReferenceDate(dateOverride: string | undefined): Date {
  if (dateOverride) {
    const parsed = new Date(`${dateOverride}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return atMidnightUtc(new Date());
}

/**
 * Assembles the role-aware "Today's Tasks" dashboard payload. Every query is
 * independently wrapped in `safeQuery` so a Postgres outage degrades to an
 * empty (but still valid) widget instead of a 500 — see docs/records.md.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTodaysTasks(
    user: RequestUser,
    dateOverride?: string,
  ): Promise<TodaysTasksResponse> {
    const referenceDate = parseReferenceDate(dateOverride);
    const cards: TaskCard[] = [];
    const complianceIndicators: ComplianceIndicator[] = [];
    const adminShortcuts: AdminShortcut[] = [];

    if (hasAnyRole(user.roles, ["FG_OPERATOR", "FG_SUPERVISOR"])) {
      cards.push(...(await this.buildOwnAssignmentCards(user.id, referenceDate)));
    }
    if (hasAnyRole(user.roles, ["FG_SUPERVISOR"])) {
      cards.push(...(await this.buildPendingCheckCards()));
    }
    if (hasAnyRole(user.roles, ["QA_EXECUTIVE", "FOOD_SAFETY_TEAM_LEADER"])) {
      cards.push(...(await this.buildPendingVerificationCards()));
      cards.push(...(await this.buildQualityExceptionCards()));
    }
    if (hasAnyRole(user.roles, ["FOOD_SAFETY_TEAM_LEADER"])) {
      complianceIndicators.push(...(await this.buildComplianceIndicators(referenceDate)));
    }
    if (hasAnyRole(user.roles, ["SYSTEM_ADMINISTRATOR"])) {
      adminShortcuts.push(...this.buildAdminShortcuts());
    }

    return {
      generatedAt: new Date().toISOString(),
      roles: user.roles,
      summary: computeDashboardSummary(cards),
      tasks: cards,
      complianceIndicators,
      adminShortcuts,
    };
  }

  // -------------------------------------------------------------------------
  // FG Operator / FG Supervisor — their own assigned checklists for today
  // -------------------------------------------------------------------------

  private async buildOwnAssignmentCards(
    userId: string,
    referenceDate: Date,
  ): Promise<TaskCard[]> {
    const assignments = await this.safeQuery(
      () =>
        this.prisma.taskAssignment.findMany({
          where: { assignedToId: userId, dueDate: referenceDate },
          include: { shift: true },
          orderBy: { createdAt: "asc" },
        }),
      [] as Array<{
        id: string;
        templateCode: string;
        areaLabel: string;
        status: string;
        recordId: string | null;
        shift: { name: string } | null;
      }>,
      "today's own task assignments",
    );

    return assignments.map((assignment) => {
      const recordType = recordTypeForDocumentCode(assignment.templateCode);
      const status = assignment.status as TaskStatus;
      const title = recordType
        ? RECORD_TYPE_META[recordType].title
        : assignment.templateCode;
      const shiftLabel = assignment.shift?.name ?? null;

      return {
        id: `assignment-${assignment.id}`,
        title,
        subtitle: [assignment.templateCode, shiftLabel].filter(Boolean).join(" · "),
        documentCode: assignment.templateCode,
        recordType,
        areaLabel: assignment.areaLabel,
        shiftLabel,
        status,
        bucket: bucketForOwnTaskStatus(status),
        action: actionForOwnTaskStatus(status),
        href: hrefForRecordType(recordType, {
          assignmentId: assignment.id,
          recordId: assignment.recordId,
        }),
      } satisfies TaskCard;
    });
  }

  // -------------------------------------------------------------------------
  // FG Supervisor — records submitted by operators, awaiting the supervisor's check
  // -------------------------------------------------------------------------

  private async buildPendingCheckCards(): Promise<TaskCard[]> {
    const records = await this.safeQuery(
      () =>
        this.prisma.inspectionRecord.findMany({
          where: { status: "SUBMITTED" },
          orderBy: { submittedAt: "asc" },
          take: MAX_QUEUE_ITEMS,
        }),
      [] as Array<{ id: string; documentCode: string; areaLabel: string | null }>,
      "pending checks",
    );

    return records.map((record) =>
      this.mapQueueRecord(record, "Pending your check", "REVIEW", "pending", "/records"),
    );
  }

  // -------------------------------------------------------------------------
  // QA Executive / Food Safety Team Leader — checked records awaiting
  // verification, plus rejected records ("quality exceptions") needing follow-up
  // -------------------------------------------------------------------------

  private async buildPendingVerificationCards(): Promise<TaskCard[]> {
    const records = await this.safeQuery(
      () =>
        this.prisma.inspectionRecord.findMany({
          where: { status: "CHECKED" },
          orderBy: { checkedAt: "asc" },
          take: MAX_QUEUE_ITEMS,
        }),
      [] as Array<{ id: string; documentCode: string; areaLabel: string | null }>,
      "pending verifications",
    );

    return records.map((record) =>
      this.mapQueueRecord(
        record,
        "Pending your verification",
        "REVIEW",
        "pending",
        "/records",
      ),
    );
  }

  private async buildQualityExceptionCards(): Promise<TaskCard[]> {
    const records = await this.safeQuery(
      () =>
        this.prisma.inspectionRecord.findMany({
          where: { status: "REJECTED" },
          orderBy: { updatedAt: "desc" },
          take: MAX_EXCEPTION_ITEMS,
        }),
      [] as Array<{ id: string; documentCode: string; areaLabel: string | null }>,
      "quality exceptions",
    );

    return records.map((record) =>
      this.mapQueueRecord(
        record,
        "Rejected — needs follow-up",
        "REVIEW",
        "attention",
        "/corrective-actions",
      ),
    );
  }

  private mapQueueRecord(
    record: { id: string; documentCode: string; areaLabel: string | null },
    subtitleSuffix: string,
    action: TaskCard["action"],
    bucket: TaskCard["bucket"],
    href: string,
  ): TaskCard {
    const recordType = recordTypeForDocumentCode(record.documentCode);
    const title = recordType ? RECORD_TYPE_META[recordType].title : record.documentCode;

    return {
      id: `record-${record.id}`,
      title,
      subtitle: `${record.documentCode} · ${subtitleSuffix}`,
      documentCode: record.documentCode,
      recordType,
      areaLabel: record.areaLabel ?? "—",
      shiftLabel: null,
      status: bucket === "attention" ? "REJECTED" : "SUBMITTED",
      bucket,
      action,
      href,
    };
  }

  // -------------------------------------------------------------------------
  // Food Safety Team Leader — compact compliance indicators (no charts)
  // -------------------------------------------------------------------------

  private async buildComplianceIndicators(
    referenceDate: Date,
  ): Promise<ComplianceIndicator[]> {
    const nextDay = new Date(referenceDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const [recordsToday, verifiedToday, openCorrectiveActions] = await Promise.all([
      this.safeQuery(
        () =>
          this.prisma.inspectionRecord.count({
            where: { recordDate: { gte: referenceDate, lt: nextDay } },
          }),
        0,
        "records today count",
      ),
      this.safeQuery(
        () =>
          this.prisma.inspectionRecord.count({
            where: {
              recordDate: { gte: referenceDate, lt: nextDay },
              status: "VERIFIED",
            },
          }),
        0,
        "verified today count",
      ),
      this.safeQuery(
        () =>
          this.prisma.correctiveAction.count({
            where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
          }),
        0,
        "open corrective actions count",
      ),
    ]);

    return [
      {
        id: "verified-today",
        label: "Verified today",
        value: `${verifiedToday}/${recordsToday}`,
        tone:
          recordsToday === 0 || verifiedToday === recordsToday
            ? "success"
            : "information",
      },
      {
        id: "open-corrective-actions",
        label: "Open corrective actions",
        value: String(openCorrectiveActions),
        tone: openCorrectiveActions > 0 ? "warning" : "success",
      },
    ];
  }

  // -------------------------------------------------------------------------
  // System Administrator — static shortcuts, no query needed
  // -------------------------------------------------------------------------

  private buildAdminShortcuts(): AdminShortcut[] {
    return [
      {
        id: "manage-templates",
        label: "Checklist templates",
        description: "Preview and manage NMS/PPU/CL checklist templates",
        href: "/admin/templates/preview",
      },
      {
        id: "system-status",
        label: "System status",
        description: "API and database health at a glance",
        href: "/system-status",
      },
      {
        id: "reports",
        label: "Reports",
        description: "Compliance and audit reporting",
        href: "/reports",
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** Never lets one widget's query failure (e.g. Postgres unreachable) crash
   *  the whole dashboard response — logs and falls back instead. */
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
