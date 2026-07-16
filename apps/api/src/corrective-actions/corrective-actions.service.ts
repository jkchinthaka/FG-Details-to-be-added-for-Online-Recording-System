import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CorrectiveActionDetail,
  CorrectiveActionListResponse,
  CorrectiveActionStatus,
  CorrectiveActionSummary,
} from "@nelna/shared";
import type {
  CorrectiveAction,
  CorrectiveActionStatus as PrismaCaStatus,
  Prisma,
} from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { assertSingleClaim } from "../common/assert-single-claim";

const ASSIGNABLE: CorrectiveActionStatus[] = ["OPEN", "REOPENED", "REJECTED", "ASSIGNED"];
const STARTABLE: CorrectiveActionStatus[] = ["OPEN", "ASSIGNED", "REOPENED"];
const COMPLETABLE: CorrectiveActionStatus[] = [
  "IN_PROGRESS",
  "ASSIGNED",
  "REOPENED",
  "OPEN",
];
const VERIFYABLE: CorrectiveActionStatus[] = ["PENDING_VERIFICATION", "COMPLETED"];
const REJECTABLE: CorrectiveActionStatus[] = [
  "PENDING_VERIFICATION",
  "COMPLETED",
  "IN_PROGRESS",
];
const REOPENABLE: CorrectiveActionStatus[] = ["REJECTED", "VERIFIED", "CLOSED"];
const CANCELABLE: CorrectiveActionStatus[] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "REOPENED",
  "REJECTED",
];

@Injectable()
export class CorrectiveActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: {
    status?: CorrectiveActionStatus;
    assignedToId?: string;
    priority?: string;
    page: number;
    pageSize: number;
  }): Promise<CorrectiveActionListResponse> {
    const where = {
      ...(input.status ? { status: input.status as PrismaCaStatus } : {}),
      ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}),
      ...(input.priority
        ? { priority: input.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.correctiveAction.count({ where }),
      this.prisma.correctiveAction.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, fullName: true } },
        },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => this.toSummary(row)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async getById(id: string): Promise<CorrectiveActionDetail> {
    const row = await this.prisma.correctiveAction.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
        verifiedBy: { select: { id: true, fullName: true } },
        evidence: { select: { id: true } },
      },
    });
    if (!row) throw new NotFoundException("Corrective action not found");
    return this.toDetail(row);
  }

  async assign(
    id: string,
    assigneeId: string,
    dueDate: string | undefined,
    actorId: string,
  ): Promise<CorrectiveActionDetail> {
    const row = await this.require(id);
    this.assertTransition(row.status, ASSIGNABLE, "assign");
    const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || assignee.status !== "ACTIVE") {
      throw new BadRequestException("Assignee must be an active user");
    }
    await this.claimTransition(row, ASSIGNABLE, "ASSIGNED", {
      assignedToId: assigneeId,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : row.dueDate,
    });
    await this.audit(actorId, id, "CA_ASSIGNED", {
      assigneeId,
      dueDate: dueDate ?? null,
    });
    return this.getById(id);
  }

  async start(id: string, actorId: string): Promise<CorrectiveActionDetail> {
    const row = await this.require(id);
    this.assertTransition(row.status, STARTABLE, "start");
    await this.claimTransition(row, STARTABLE, "IN_PROGRESS", {});
    await this.audit(actorId, id, "CA_STARTED", {});
    return this.getById(id);
  }

  async complete(
    id: string,
    completionComment: string,
    actorId: string,
  ): Promise<CorrectiveActionDetail> {
    const row = await this.require(id);
    this.assertTransition(row.status, COMPLETABLE, "complete");
    if (!completionComment.trim()) {
      throw new BadRequestException("completionComment is required");
    }
    await this.claimTransition(row, COMPLETABLE, "PENDING_VERIFICATION", {
      completionComment: completionComment.trim(),
      completedAt: new Date(),
    });
    await this.audit(actorId, id, "CA_COMPLETED", {});
    return this.getById(id);
  }

  async verify(
    id: string,
    verificationComment: string,
    actorId: string,
  ): Promise<CorrectiveActionDetail> {
    const row = await this.require(id);
    this.assertTransition(row.status, VERIFYABLE, "verify");
    if (!verificationComment.trim()) {
      throw new BadRequestException("verificationComment is required");
    }
    if (row.assignedToId && row.assignedToId === actorId) {
      throw new BadRequestException("Assignee cannot verify their own corrective action");
    }
    const now = new Date();
    await this.claimTransition(row, VERIFYABLE, "CLOSED", {
      verificationComment: verificationComment.trim(),
      verifiedById: actorId,
      verifiedAt: now,
      closedById: actorId,
      closedAt: now,
    });
    await this.audit(actorId, id, "CA_VERIFIED_CLOSED", {});
    return this.getById(id);
  }

  async reject(
    id: string,
    rejectionReason: string,
    actorId: string,
  ): Promise<CorrectiveActionDetail> {
    const row = await this.require(id);
    this.assertTransition(row.status, REJECTABLE, "reject");
    if (!rejectionReason.trim()) {
      throw new BadRequestException("rejectionReason is required");
    }
    await this.claimTransition(row, REJECTABLE, "REJECTED", {
      rejectionReason: rejectionReason.trim(),
      verifiedById: actorId,
    });
    await this.audit(actorId, id, "CA_REJECTED", {});
    return this.getById(id);
  }

  async reopen(id: string, actorId: string): Promise<CorrectiveActionDetail> {
    const row = await this.require(id);
    this.assertTransition(row.status, REOPENABLE, "reopen");
    await this.claimTransition(row, REOPENABLE, "REOPENED", {
      reopenedAt: new Date(),
      closedAt: null,
      closedById: null,
    });
    await this.audit(actorId, id, "CA_REOPENED", {});
    return this.getById(id);
  }

  async cancel(
    id: string,
    cancelReason: string,
    actorId: string,
  ): Promise<CorrectiveActionDetail> {
    const row = await this.require(id);
    this.assertTransition(row.status, CANCELABLE, "cancel");
    if (!cancelReason.trim()) {
      throw new BadRequestException("cancelReason is required");
    }
    await this.claimTransition(row, CANCELABLE, "CANCELLED_WITH_REASON", {
      cancelReason: cancelReason.trim(),
      closedAt: new Date(),
      closedById: actorId,
    });
    await this.audit(actorId, id, "CA_CANCELLED", {});
    return this.getById(id);
  }

  private async claimTransition(
    row: CorrectiveAction,
    fromStatuses: CorrectiveActionStatus[],
    toStatus: CorrectiveActionStatus,
    data: Prisma.CorrectiveActionUncheckedUpdateManyInput,
  ): Promise<void> {
    const claimed = await this.prisma.correctiveAction.updateMany({
      where: {
        id: row.id,
        status: { in: fromStatuses as PrismaCaStatus[] },
        workflowVersion: row.workflowVersion ?? 0,
      },
      data: {
        ...data,
        status: toStatus as PrismaCaStatus,
        workflowVersion: { increment: 1 },
      },
    });
    assertSingleClaim(claimed);
  }

  private async require(id: string) {
    const row = await this.prisma.correctiveAction.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Corrective action not found");
    return row;
  }

  private assertTransition(
    current: string,
    allowed: CorrectiveActionStatus[],
    action: string,
  ) {
    if (!(allowed as string[]).includes(current)) {
      throw new BadRequestException(
        `Cannot ${action} a corrective action in status ${current}`,
      );
    }
  }

  private async audit(
    actorId: string,
    entityId: string,
    action: string,
    metadata: Record<string, string | number | boolean | null>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType: "CorrectiveAction",
        entityId,
        metadata,
      },
    });
  }

  private toSummary(
    row: CorrectiveAction & {
      assignedTo?: { id: string; fullName: string } | null;
    },
  ): CorrectiveActionSummary {
    return {
      id: row.id,
      actionNumber: row.actionNumber,
      title: row.title,
      description: row.description,
      status: row.status as CorrectiveActionStatus,
      priority: row.priority,
      recordId: row.recordId,
      resultId: row.resultId,
      assignedToId: row.assignedToId,
      assignedToName: row.assignedTo?.fullName ?? null,
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(
    row: CorrectiveAction & {
      assignedTo?: { id: string; fullName: string } | null;
      createdBy?: { id: string; fullName: string };
      verifiedBy?: { id: string; fullName: string } | null;
      evidence?: { id: string }[];
    },
  ): CorrectiveActionDetail {
    return {
      ...this.toSummary(row),
      rootCause: row.rootCause,
      immediateCorrection: row.immediateCorrection,
      completionComment: row.completionComment,
      verificationComment: row.verificationComment,
      rejectionReason: row.rejectionReason,
      cancelReason: row.cancelReason,
      createdById: row.createdById,
      createdByName: row.createdBy?.fullName ?? "",
      verifiedById: row.verifiedById,
      verifiedByName: row.verifiedBy?.fullName ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      reopenedAt: row.reopenedAt?.toISOString() ?? null,
      evidenceCount: row.evidence?.length ?? 0,
    };
  }
}
