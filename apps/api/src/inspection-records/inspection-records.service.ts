import { Injectable, Logger } from "@nestjs/common";
import {
  DOCUMENT_CODES,
  DEFAULT_WORKFLOW_POLICY,
  assertCheckSegregationOfDuty,
  assertVerifySegregationOfDuty,
  checklistItemResponseSchema,
  commentRequiredForAction,
  computeRecordCounts,
  computeRecommendedLoadingDecision,
  createCleaningDraftSchema,
  createTruckDraftSchema,
  colomboDateOnly,
  colomboHour,
  colomboTimeHm,
  dateOnlyToUtcMidnight,
  detectWorkShiftForHour,
  flattenItems,
  formatRecordNumber,
  isFailureResponse,
  isImmutableVerifiedStatus,
  isOverrideToApprovedAllowed,
  isRecordEditable,
  loadingDecisionInputSchema,
  nextResponsibleRoleForStatus,
  resolveDraftDuplicate,
  resolveWorkflowTransition,
  saveDraftResponsesSchema,
  submitInspectionRecordSchema,
  validateChecklistResponses,
  type ChecklistItemDefinition,
  type ChecklistItemResponse,
  type ChecklistResponseMap,
  type InspectionRecordDetail,
  type LoadingDecision,
  type PermissionKey,
  type RecordStatus as SharedRecordStatus,
  type SubmitRecordResult,
  type WorkShift,
  type WorkflowAction,
} from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";
import {
  LoadingDecisionStatus,
  RecordStatus,
  TemplateStatus,
} from "../../generated/prisma-client";
import {
  VERSION_WITH_CONTENT_INCLUDE,
  mapVersionToDefinition,
  type VersionWithContent,
} from "../checklist-templates/checklist-templates.mappers";
import { VEHICLE_WITH_TRANSPORTER_INCLUDE } from "../vehicles/vehicles.mappers";
import { GridFsEvidenceService } from "../evidence/gridfs-evidence.service";
import type { CreateCleaningDraftDto } from "./dto/create-cleaning-draft.dto";
import type { CreateTruckDraftDto } from "./dto/create-truck-draft.dto";
import type { LoadingDecisionDto } from "./dto/loading-decision.dto";
import type { SaveDraftDto } from "./dto/save-draft.dto";
import type { SubmitRecordDto } from "./dto/submit-record.dto";
import {
  CriticalFailureOverrideException,
  DuplicateRecordException,
  DuplicateWorkflowApprovalException,
  InvalidRecordPayloadException,
  InvalidWorkflowTransitionException,
  LoadingDecisionForbiddenException,
  ManualVehicleEntryForbiddenException,
  NotATruckInspectionException,
  PublishedTemplateNotFoundException,
  RecordLockedException,
  RecordNotFoundException,
  RecordValidationException,
  VehicleNotFoundException,
  WorkflowCommentRequiredException,
  WorkflowPermissionForbiddenException,
  WorkflowSegregationOfDutyException,
} from "./inspection-records.errors";
import type { WorkflowCommentDto } from "./dto/workflow-comment.dto";
import {
  RECORD_HEADER_INCLUDE,
  RESULT_WITH_ATTACHMENTS_INCLUDE,
  decodeDataUrlToBuffer,
  estimateDataUrlSizeBytes,
  isDataUrl,
  parseDataUrlMimeType,
  resultStatusFromNormalized,
  toHeader,
  toDateOnlyString,
  toResponseMap,
  toTruckDetail,
  type RecordWithHeaderRelations,
} from "./inspection-records.mappers";

const DEFAULT_CLEANING_AREA_LABEL = "Finished Goods + Changing Room";
const DEFAULT_TRUCK_AREA_LABEL = "Dispatch / Loading Bay";

/** Roles allowed to record the final freezer-truck loading decision — the
 *  "requires correct role (supervisor/QA)" business rule. Checked here in
 *  addition to the `@Roles()` guard so the rule holds even if a controller
 *  is ever wired up without it. */
const LOADING_DECISION_ROLES = [
  "FG_SUPERVISOR",
  "QA_EXECUTIVE",
  "FOOD_SAFETY_TEAM_LEADER",
  "SYSTEM_ADMINISTRATOR",
];

function hasOnlyRole(roles: string[], role: string): boolean {
  return roles.length > 0 && roles.every((r) => r === role);
}

function hasAnyRole(roles: string[], allowed: string[]): boolean {
  return allowed.some((role) => roles.includes(role));
}

function hasPermission(user: RequestUser, permission: PermissionKey): boolean {
  return user.permissions.includes(permission);
}

@Injectable()
export class InspectionRecordsService {
  private readonly logger = new Logger(InspectionRecordsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gridFsEvidence: GridFsEvidenceService,
  ) {}

  // -------------------------------------------------------------------------
  // Create / resume draft
  // -------------------------------------------------------------------------

  async createCleaningDraft(
    user: RequestUser,
    dto: CreateCleaningDraftDto,
  ): Promise<InspectionRecordDetail> {
    const parsed = createCleaningDraftSchema.safeParse(dto);
    if (!parsed.success) {
      throw new InvalidRecordPayloadException(formatZodIssues(parsed.error.issues));
    }

    const recordDate = parsed.data.recordDate ?? colomboDateOnly();
    const recordDateAtMidnight = dateOnlyToUtcMidnight(recordDate);
    const shiftCode: WorkShift =
      parsed.data.shiftCode ?? detectWorkShiftForHour(colomboHour());
    const areaLabel = parsed.data.areaLabel ?? DEFAULT_CLEANING_AREA_LABEL;

    const shift = await this.prisma.shift.findUnique({ where: { code: shiftCode } });

    const existing = await this.prisma.inspectionRecord.findFirst({
      where: {
        documentCode: DOCUMENT_CODES.DAILY_CLEANING,
        recordDate: recordDateAtMidnight,
        shiftId: shift?.id ?? null,
        areaLabel,
      },
      orderBy: { createdAt: "desc" },
    });

    const resolution = resolveDraftDuplicate(
      existing
        ? {
            id: existing.id,
            status: existing.status as SharedRecordStatus,
            createdById: existing.createdById,
          }
        : null,
      user.id,
    );

    let record: RecordWithHeaderRelations;
    if (resolution.outcome === "conflict") {
      throw new DuplicateRecordException(resolution.reason);
    } else if (resolution.outcome === "resume") {
      record = await this.prisma.inspectionRecord.findUniqueOrThrow({
        where: { id: resolution.recordId },
        include: RECORD_HEADER_INCLUDE,
      });
    } else {
      const templateVersion = await this.findPublishedTemplateVersion(
        DOCUMENT_CODES.DAILY_CLEANING,
      );
      record = await this.prisma.inspectionRecord.create({
        data: {
          templateVersionId: templateVersion.id,
          documentCode: DOCUMENT_CODES.DAILY_CLEANING,
          status: RecordStatus.DRAFT,
          recordDate: recordDateAtMidnight,
          shiftId: shift?.id,
          areaLabel,
          createdById: user.id,
        },
        include: RECORD_HEADER_INCLUDE,
      });
    }

    if (parsed.data.taskAssignmentId) {
      await this.linkTaskAssignment(parsed.data.taskAssignmentId, record.id, user.id);
    }

    return this.buildDetail(record, user);
  }

  /** Starts (or resumes) a Freezer Truck Inspection Before Loading draft
   *  (NMS/PPU/CL/30). Duplicate-prevention is scoped to the *same vehicle*
   *  for the date/shift, rather than the whole area — several different
   *  trucks are routinely inspected in the same shift/loading bay. */
  async createTruckDraft(
    user: RequestUser,
    dto: CreateTruckDraftDto,
  ): Promise<InspectionRecordDetail> {
    const parsed = createTruckDraftSchema.safeParse(dto);
    if (!parsed.success) {
      throw new InvalidRecordPayloadException(formatZodIssues(parsed.error.issues));
    }

    const recordDate = parsed.data.recordDate ?? colomboDateOnly();
    const recordDateAtMidnight = dateOnlyToUtcMidnight(recordDate);
    const shiftCode: WorkShift =
      parsed.data.shiftCode ?? detectWorkShiftForHour(colomboHour());
    const areaLabel = parsed.data.areaLabel ?? DEFAULT_TRUCK_AREA_LABEL;
    const shift = await this.prisma.shift.findUnique({ where: { code: shiftCode } });

    const resolvedVehicle = await this.resolveVehicleForTruckDraft(user, parsed.data);

    const existing = await this.prisma.inspectionRecord.findFirst({
      where: {
        documentCode: DOCUMENT_CODES.FREEZER_TRUCK,
        recordDate: recordDateAtMidnight,
        shiftId: shift?.id ?? null,
        truckDetail: { vehicleNumber: resolvedVehicle.vehicleNumber },
      },
      orderBy: { createdAt: "desc" },
    });

    const resolution = resolveDraftDuplicate(
      existing
        ? {
            id: existing.id,
            status: existing.status as SharedRecordStatus,
            createdById: existing.createdById,
          }
        : null,
      user.id,
    );

    let record: RecordWithHeaderRelations;
    if (resolution.outcome === "conflict") {
      throw new DuplicateRecordException(resolution.reason);
    } else if (resolution.outcome === "resume") {
      record = await this.prisma.inspectionRecord.findUniqueOrThrow({
        where: { id: resolution.recordId },
        include: RECORD_HEADER_INCLUDE,
      });
    } else {
      const templateVersion = await this.findPublishedTemplateVersion(
        DOCUMENT_CODES.FREEZER_TRUCK,
      );
      const reinspectionOfId = await this.resolveReinspectionTarget(
        parsed.data.reinspectionOfRecordId,
      );

      record = await this.prisma.inspectionRecord.create({
        data: {
          templateVersionId: templateVersion.id,
          documentCode: DOCUMENT_CODES.FREEZER_TRUCK,
          status: RecordStatus.DRAFT,
          recordDate: recordDateAtMidnight,
          shiftId: shift?.id,
          areaLabel,
          createdById: user.id,
          reinspectionOfId,
          truckDetail: {
            create: {
              vehicleId: resolvedVehicle.vehicleId,
              driverId: parsed.data.driverId,
              transporterId: parsed.data.transporterId ?? resolvedVehicle.transporterId,
              freezerTruckNumber: resolvedVehicle.freezerTruckNumber,
              vehicleNumber: resolvedVehicle.vehicleNumber,
              inspectionTime: colomboTimeHm(),
              loadingReference: parsed.data.loadingReference,
              productCategory: parsed.data.productCategory,
            },
          },
        },
        include: RECORD_HEADER_INCLUDE,
      });
    }

    if (parsed.data.taskAssignmentId) {
      await this.linkTaskAssignment(parsed.data.taskAssignmentId, record.id, user.id);
    }

    return this.buildDetail(record, user);
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async getById(user: RequestUser, id: string): Promise<InspectionRecordDetail> {
    const record = await this.findRecordOrThrow(id);
    this.assertCanView(record, user);
    return this.buildDetail(record, user);
  }

  // -------------------------------------------------------------------------
  // Save draft (autosave / explicit save)
  // -------------------------------------------------------------------------

  async saveDraft(
    user: RequestUser,
    id: string,
    dto: SaveDraftDto,
  ): Promise<InspectionRecordDetail> {
    const parsed = saveDraftResponsesSchema.safeParse(dto);
    if (!parsed.success) {
      throw new InvalidRecordPayloadException(formatZodIssues(parsed.error.issues));
    }

    const record = await this.findRecordOrThrow(id);
    this.assertOwnerCanEdit(record, user);

    const templateVersion = await this.loadTemplateVersionContent(
      record.templateVersionId,
    );
    await this.persistResponses(
      record.id,
      templateVersion,
      parsed.data.responses,
      user.id,
    );

    if (parsed.data.areaLabel && parsed.data.areaLabel !== record.areaLabel) {
      await this.prisma.inspectionRecord.update({
        where: { id },
        data: { areaLabel: parsed.data.areaLabel },
      });
    }

    return this.getById(user, id);
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  async submit(
    user: RequestUser,
    id: string,
    dto: SubmitRecordDto,
  ): Promise<SubmitRecordResult> {
    const parsed = submitInspectionRecordSchema.safeParse(dto ?? {});
    if (!parsed.success) {
      throw new InvalidRecordPayloadException(formatZodIssues(parsed.error.issues));
    }

    const record = await this.findRecordOrThrow(id);
    this.assertOwnerCanEdit(record, user);

    const templateVersion = await this.loadTemplateVersionContent(
      record.templateVersionId,
    );

    if (parsed.data.responses) {
      await this.persistResponses(
        record.id,
        templateVersion,
        parsed.data.responses,
        user.id,
      );
    }

    const versionDefinition = mapVersionToDefinition(templateVersion);
    const items = flattenItems(versionDefinition.sections);

    const results = await this.prisma.inspectionResult.findMany({
      where: { recordId: record.id },
      include: RESULT_WITH_ATTACHMENTS_INCLUDE,
    });
    const responseMap = toResponseMap(results);

    const validation = validateChecklistResponses(
      versionDefinition.sections,
      responseMap,
    );
    if (!validation.isValid) {
      throw new RecordValidationException(validation.errors);
    }

    const submittedAt = new Date();
    const { correctiveActionsCreated, loadingDecision } = await this.prisma.$transaction(
      async (tx) => {
        // The conditional update is the concurrency gate. Two double-taps (or
        // retries after a lost response) may both read a DRAFT, but only one may
        // transition it to SUBMITTED and create its downstream workflow rows.
        const claimed = await tx.inspectionRecord.updateMany({
          where: {
            id: record.id,
            status: {
              in: [
                RecordStatus.DRAFT,
                RecordStatus.REJECTED,
                RecordStatus.RETURNED_FOR_CORRECTION,
              ],
            },
          },
          data: { status: RecordStatus.PENDING_CHECK, submittedAt },
        });
        if (claimed.count !== 1) {
          throw new RecordLockedException();
        }

        const correctiveActionsCreated = await this.createCorrectiveActionsForFailures(
          record.id,
          items,
          responseMap,
          results,
          user.id,
          tx,
        );

        await tx.taskAssignment.updateMany({
          where: { recordId: record.id },
          data: { status: "SUBMITTED" },
        });

        const loadingDecision =
          record.documentCode === DOCUMENT_CODES.FREEZER_TRUCK
            ? await this.recordLoadingDecisionRecommendation(
                record,
                items,
                responseMap,
                user.id,
                tx,
              )
            : null;

        return { correctiveActionsCreated, loadingDecision };
      },
    );

    const counts = computeRecordCounts(items, responseMap);
    const status: SharedRecordStatus = "PENDING_CHECK";

    return {
      recordId: record.id,
      documentCode: record.documentCode,
      recordNumber: formatRecordNumber(
        record.documentCode,
        toDateOnlyString(record.recordDate),
        record.id,
      ),
      status,
      submittedAt: submittedAt.toISOString(),
      counts,
      hasCriticalFailure: validation.hasCriticalFailure,
      correctiveActionsCreated,
      nextResponsibleRole: nextResponsibleRoleForStatus(status),
      loadingDecision,
    } satisfies SubmitRecordResult;
  }

  // -------------------------------------------------------------------------
  // Check / verify / return / reject / void workflow (Prompt 28)
  // -------------------------------------------------------------------------

  async listPendingCheck(user: RequestUser): Promise<InspectionRecordDetail[]> {
    this.requirePermission(user, "records:check", "check");
    return this.listByStatuses(user, ["PENDING_CHECK", "SUBMITTED", "RESUBMITTED"]);
  }

  async listPendingVerification(user: RequestUser): Promise<InspectionRecordDetail[]> {
    this.requirePermission(user, "records:verify", "verify");
    return this.listByStatuses(user, ["PENDING_VERIFICATION", "CHECKED"]);
  }

  async checkRecord(
    user: RequestUser,
    id: string,
    dto: WorkflowCommentDto,
  ): Promise<InspectionRecordDetail> {
    this.requirePermission(user, "records:check", "check");
    return this.applyWorkflow(
      user,
      id,
      "CHECK",
      dto?.comment,
      async (tx, record, toStatus) => {
        const sod = assertCheckSegregationOfDuty(
          DEFAULT_WORKFLOW_POLICY,
          user.id,
          record.createdById,
        );
        if (!sod.ok) throw new WorkflowSegregationOfDutyException(sod.reason);

        const prior = await tx.approvalRecord.findFirst({
          where: { recordId: record.id, approvalType: "CHECK", decision: "APPROVED" },
        });
        if (prior) throw new DuplicateWorkflowApprovalException("CHECK");

        const decidedAt = new Date();
        await tx.inspectionRecord.update({
          where: { id: record.id },
          data: {
            status: toStatus as RecordStatus,
            checkedById: user.id,
            checkedAt: decidedAt,
          },
        });
        await tx.approvalRecord.create({
          data: {
            recordId: record.id,
            approvalType: "CHECK",
            decision: "APPROVED",
            decidedById: user.id,
            decidedAt,
            comments: dto?.comment?.trim() || null,
          },
        });
        await this.writeWorkflowAudit(tx, user, record.id, "RECORD_CHECKED", {
          toStatus,
          roles: user.roles,
        });
        await this.notifyUser(
          tx,
          record.createdById,
          "RECORD_CHECKED",
          "Record checked",
          `Record ${record.documentCode} was checked.`,
          record.id,
        );
        await this.notifyUser(
          tx,
          record.createdById,
          "RECORD_PENDING_VERIFICATION",
          "Awaiting verification",
          `Record ${record.documentCode} is pending QA verification.`,
          record.id,
        );
      },
    );
  }

  async verifyRecord(
    user: RequestUser,
    id: string,
    dto: WorkflowCommentDto,
  ): Promise<InspectionRecordDetail> {
    this.requirePermission(user, "records:verify", "verify");
    return this.applyWorkflow(
      user,
      id,
      "VERIFY",
      dto?.comment,
      async (tx, record, toStatus) => {
        const sod = assertVerifySegregationOfDuty(
          DEFAULT_WORKFLOW_POLICY,
          user.id,
          record.createdById,
          record.checkedById,
        );
        if (!sod.ok) throw new WorkflowSegregationOfDutyException(sod.reason);

        const prior = await tx.approvalRecord.findFirst({
          where: { recordId: record.id, approvalType: "VERIFY", decision: "APPROVED" },
        });
        if (prior) throw new DuplicateWorkflowApprovalException("VERIFY");

        const decidedAt = new Date();
        await tx.inspectionRecord.update({
          where: { id: record.id },
          data: {
            status: toStatus as RecordStatus,
            verifiedById: user.id,
            verifiedAt: decidedAt,
          },
        });
        await tx.approvalRecord.create({
          data: {
            recordId: record.id,
            approvalType: "VERIFY",
            decision: "APPROVED",
            decidedById: user.id,
            decidedAt,
            comments: dto?.comment?.trim() || null,
          },
        });
        await tx.taskAssignment.updateMany({
          where: { recordId: record.id },
          data: { status: "VERIFIED" },
        });
        await this.writeWorkflowAudit(tx, user, record.id, "RECORD_VERIFIED", {
          toStatus,
          roles: user.roles,
        });
        await this.notifyUser(
          tx,
          record.createdById,
          "RECORD_VERIFIED",
          "Record verified",
          `Record ${record.documentCode} was verified.`,
          record.id,
        );
      },
    );
  }

  async returnRecord(
    user: RequestUser,
    id: string,
    dto: WorkflowCommentDto,
  ): Promise<InspectionRecordDetail> {
    this.requirePermission(user, "records:return", "return");
    const comment = dto?.comment?.trim();
    if (!comment) throw new WorkflowCommentRequiredException("RETURN");
    return this.applyWorkflow(
      user,
      id,
      "RETURN",
      comment,
      async (tx, record, toStatus) => {
        const decidedAt = new Date();
        await tx.inspectionRecord.update({
          where: { id: record.id },
          data: { status: toStatus as RecordStatus },
        });
        await tx.approvalRecord.create({
          data: {
            recordId: record.id,
            approvalType: "RETURN",
            decision: "REJECTED",
            decidedById: user.id,
            decidedAt,
            comments: comment,
          },
        });
        await tx.taskAssignment.updateMany({
          where: { recordId: record.id },
          data: { status: "REJECTED" },
        });
        await this.writeWorkflowAudit(tx, user, record.id, "RECORD_RETURNED", {
          toStatus,
          roles: user.roles,
          comment,
        });
        await this.notifyUser(
          tx,
          record.createdById,
          "RECORD_RETURNED",
          "Record returned for correction",
          comment,
          record.id,
        );
      },
    );
  }

  async rejectRecord(
    user: RequestUser,
    id: string,
    dto: WorkflowCommentDto,
  ): Promise<InspectionRecordDetail> {
    this.requirePermission(user, "records:reject", "reject");
    const comment = dto?.comment?.trim();
    if (!comment) throw new WorkflowCommentRequiredException("REJECT");
    return this.applyWorkflow(
      user,
      id,
      "REJECT",
      comment,
      async (tx, record, toStatus) => {
        const decidedAt = new Date();
        await tx.inspectionRecord.update({
          where: { id: record.id },
          data: { status: toStatus as RecordStatus },
        });
        await tx.approvalRecord.create({
          data: {
            recordId: record.id,
            approvalType: "REJECT",
            decision: "REJECTED",
            decidedById: user.id,
            decidedAt,
            comments: comment,
          },
        });
        await tx.taskAssignment.updateMany({
          where: { recordId: record.id },
          data: { status: "REJECTED" },
        });
        await this.writeWorkflowAudit(tx, user, record.id, "RECORD_REJECTED", {
          toStatus,
          roles: user.roles,
          comment,
        });
        await this.notifyUser(
          tx,
          record.createdById,
          "RECORD_REJECTED",
          "Record rejected",
          comment,
          record.id,
        );
      },
    );
  }

  async voidRecord(
    user: RequestUser,
    id: string,
    dto: WorkflowCommentDto,
  ): Promise<InspectionRecordDetail> {
    this.requirePermission(user, "records:void", "void");
    const comment = dto?.comment?.trim();
    if (!comment) throw new WorkflowCommentRequiredException("VOID");
    return this.applyWorkflow(user, id, "VOID", comment, async (tx, record, toStatus) => {
      if (
        !isImmutableVerifiedStatus(record.status as SharedRecordStatus) &&
        record.status !== "VERIFIED" &&
        record.status !== "COMPLETED"
      ) {
        // applyWorkflow already validates transition; VOID only from VERIFIED/COMPLETED
      }
      const decidedAt = new Date();
      await tx.inspectionRecord.update({
        where: { id: record.id },
        data: {
          status: toStatus as RecordStatus,
          archivedAt: decidedAt,
        },
      });
      await tx.approvalRecord.create({
        data: {
          recordId: record.id,
          approvalType: "VOID",
          decision: "REJECTED",
          decidedById: user.id,
          decidedAt,
          comments: comment,
        },
      });
      await this.writeWorkflowAudit(tx, user, record.id, "RECORD_VOIDED", {
        toStatus,
        roles: user.roles,
        comment,
      });
    });
  }

  async listApprovalHistory(user: RequestUser, id: string) {
    const record = await this.findRecordOrThrow(id);
    this.assertCanView(record, user);
    return this.prisma.approvalRecord.findMany({
      where: { recordId: id },
      orderBy: { createdAt: "asc" },
      include: {
        decidedBy: { select: { id: true, fullName: true, employeeCode: true } },
      },
    });
  }

  private requirePermission(
    user: RequestUser,
    permission: PermissionKey,
    action: string,
  ): void {
    if (!hasPermission(user, permission)) {
      throw new WorkflowPermissionForbiddenException(action);
    }
  }

  private async listByStatuses(
    user: RequestUser,
    statuses: SharedRecordStatus[],
  ): Promise<InspectionRecordDetail[]> {
    const rows = await this.prisma.inspectionRecord.findMany({
      where: { status: { in: statuses as RecordStatus[] } },
      include: RECORD_HEADER_INCLUDE,
      orderBy: { submittedAt: "desc" },
      take: 50,
    });
    const details: InspectionRecordDetail[] = [];
    for (const row of rows) {
      try {
        this.assertCanView(row, user);
        details.push(await this.buildDetail(row, user));
      } catch {
        // skip inaccessible
      }
    }
    return details;
  }

  private async applyWorkflow(
    user: RequestUser,
    id: string,
    action: WorkflowAction,
    comment: string | undefined,
    mutate: (
      tx: PrismaService,
      record: RecordWithHeaderRelations,
      toStatus: SharedRecordStatus,
    ) => Promise<void>,
  ): Promise<InspectionRecordDetail> {
    if (commentRequiredForAction(action) && !comment?.trim()) {
      throw new WorkflowCommentRequiredException(action);
    }
    const record = await this.findRecordOrThrow(id);
    this.assertCanView(record, user);
    const from = record.status as SharedRecordStatus;
    if (isImmutableVerifiedStatus(from) && action !== "VOID" && action !== "COMPLETE") {
      throw new RecordLockedException();
    }
    const toStatus = resolveWorkflowTransition(from, action);
    if (!toStatus) {
      throw new InvalidWorkflowTransitionException(from, action);
    }
    await this.prisma.$transaction(async (tx) => {
      await mutate(tx as unknown as PrismaService, record, toStatus);
    });
    return this.getById(user, id);
  }

  private async writeWorkflowAudit(
    prisma: Pick<PrismaService, "auditLog">,
    user: RequestUser,
    recordId: string,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action,
        entityType: "InspectionRecord",
        entityId: recordId,
        metadata: metadata as object,
      },
    });
  }

  private async notifyUser(
    prisma: Pick<PrismaService, "notification">,
    userId: string,
    type:
      | "RECORD_REJECTED"
      | "RECORD_VERIFIED"
      | "RECORD_RETURNED"
      | "RECORD_CHECKED"
      | "RECORD_PENDING_VERIFICATION"
      | "SYSTEM",
    title: string,
    body: string,
    relatedEntityId: string,
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        relatedEntityType: "InspectionRecord",
        relatedEntityId,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Freezer truck loading decision
  // -------------------------------------------------------------------------

  /** Computes and persists the operator-submit-time recommended loading
   *  decision (`computeRecommendedLoadingDecision`) — this becomes both
   *  `recommendedDecision` (frozen forever) and the initial `loadingDecision`
   *  (which a supervisor/QA may later change via `approveLoadingDecision`). */
  private async recordLoadingDecisionRecommendation(
    record: RecordWithHeaderRelations,
    items: ChecklistItemDefinition[],
    responseMap: ChecklistResponseMap,
    userId: string,
    prisma: Pick<PrismaService, "truckInspectionDetail" | "auditLog"> = this.prisma,
  ): Promise<LoadingDecision> {
    const { decision } = computeRecommendedLoadingDecision(items, responseMap);

    await prisma.truckInspectionDetail.update({
      where: { recordId: record.id },
      data: {
        recommendedDecision: decision as LoadingDecisionStatus,
        loadingDecision: decision as LoadingDecisionStatus,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "LOADING_DECISION_RECOMMENDED",
        entityType: "TruckInspectionDetail",
        entityId: record.truckDetail?.id ?? null,
        metadata: { recordId: record.id, decision },
      },
    });

    return decision;
  }

  /** Role-gated final loading decision (`POST /inspection-records/:id/loading-decision`).
   *  A critical-failure recommendation can never be overridden to an
   *  "approved" outcome — see `isOverrideToApprovedAllowed`. Every change is
   *  preserved in `AuditLog` and mirrored into an `ApprovalRecord`. */
  async approveLoadingDecision(
    user: RequestUser,
    id: string,
    dto: LoadingDecisionDto,
  ): Promise<InspectionRecordDetail> {
    if (!hasAnyRole(user.roles, LOADING_DECISION_ROLES)) {
      throw new LoadingDecisionForbiddenException();
    }

    const parsed = loadingDecisionInputSchema.safeParse(dto);
    if (!parsed.success) {
      throw new InvalidRecordPayloadException(formatZodIssues(parsed.error.issues));
    }

    const record = await this.findRecordOrThrow(id);
    if (!record.truckDetail) {
      throw new NotATruckInspectionException(id);
    }

    const recommended = record.truckDetail.recommendedDecision as LoadingDecision | null;
    const isApprovedOutcome =
      parsed.data.decision === "APPROVED_FOR_LOADING" ||
      parsed.data.decision === "CONDITIONALLY_APPROVED";
    if (isApprovedOutcome && !isOverrideToApprovedAllowed(recommended)) {
      throw new CriticalFailureOverrideException();
    }

    const previousDecision = record.truckDetail.loadingDecision as LoadingDecision;
    const decidedAt = new Date();

    await this.prisma.truckInspectionDetail.update({
      where: { recordId: record.id },
      data: {
        loadingDecision: parsed.data.decision as LoadingDecisionStatus,
        decidedById: user.id,
        decidedAt,
        remarks: parsed.data.remarks ?? record.truckDetail.remarks,
      },
    });

    await this.prisma.approvalRecord.create({
      data: {
        recordId: record.id,
        approvalType: "LOADING_DECISION",
        decision: isApprovedOutcome ? "APPROVED" : "REJECTED",
        decidedById: user.id,
        decidedAt,
        comments: parsed.data.remarks,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "LOADING_DECISION_CHANGED",
        entityType: "TruckInspectionDetail",
        entityId: record.truckDetail.id,
        metadata: {
          recordId: record.id,
          from: previousDecision,
          to: parsed.data.decision,
          remarks: parsed.data.remarks ?? null,
        },
      },
    });

    return this.getById(user, id);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async findPublishedTemplateVersion(code: string): Promise<VersionWithContent> {
    const template = await this.prisma.checklistTemplate.findUnique({ where: { code } });
    if (!template?.currentVersionId) {
      throw new PublishedTemplateNotFoundException(code);
    }
    const version = await this.prisma.checklistTemplateVersion.findUnique({
      where: { id: template.currentVersionId },
      include: VERSION_WITH_CONTENT_INCLUDE,
    });
    if (!version || version.status !== TemplateStatus.PUBLISHED) {
      throw new PublishedTemplateNotFoundException(code);
    }
    return version;
  }

  private async loadTemplateVersionContent(
    templateVersionId: string,
  ): Promise<VersionWithContent> {
    return this.prisma.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: templateVersionId },
      include: VERSION_WITH_CONTENT_INCLUDE,
    });
  }

  private async findRecordOrThrow(id: string): Promise<RecordWithHeaderRelations> {
    const record = await this.prisma.inspectionRecord.findUnique({
      where: { id },
      include: RECORD_HEADER_INCLUDE,
    });
    if (!record) throw new RecordNotFoundException(id);
    return record;
  }

  /** Resolves a truck draft's vehicle identity — either the selected
   *  `vehicleId` (denormalizing its truck/vehicle numbers + transporter onto
   *  the new `TruckInspectionDetail`) or the manual fallback, which is only
   *  permitted for users holding `vehicles:manual_entry`. */
  private async resolveVehicleForTruckDraft(
    user: RequestUser,
    data: { vehicleId?: string; freezerTruckNumber?: string; vehicleNumber?: string },
  ): Promise<{
    vehicleId: string | null;
    freezerTruckNumber: string;
    vehicleNumber: string;
    transporterId: string | null;
  }> {
    if (data.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: data.vehicleId },
        include: VEHICLE_WITH_TRANSPORTER_INCLUDE,
      });
      if (!vehicle) {
        throw new VehicleNotFoundException(data.vehicleId);
      }
      if (!vehicle.freezerTruckNumber) {
        throw new InvalidRecordPayloadException(
          "Selected vehicle has no freezer truck number on file",
        );
      }
      return {
        vehicleId: vehicle.id,
        freezerTruckNumber: vehicle.freezerTruckNumber,
        vehicleNumber: vehicle.vehicleNumber,
        transporterId: vehicle.transporterId,
      };
    }

    if (!hasPermission(user, "vehicles:manual_entry")) {
      throw new ManualVehicleEntryForbiddenException();
    }

    return {
      vehicleId: null,
      freezerTruckNumber: data.freezerTruckNumber!,
      vehicleNumber: data.vehicleNumber!,
      transporterId: null,
    };
  }

  /** Validates a `reinspectionOfRecordId` (when supplied) resolves to a real
   *  record before linking — a malformed id must never silently break draft
   *  creation, but it also must never silently create a fake link. */
  private async resolveReinspectionTarget(
    reinspectionOfRecordId: string | undefined,
  ): Promise<string | undefined> {
    if (!reinspectionOfRecordId) return undefined;
    const prior = await this.prisma.inspectionRecord.findUnique({
      where: { id: reinspectionOfRecordId },
    });
    if (!prior) {
      throw new RecordNotFoundException(reinspectionOfRecordId);
    }
    return prior.id;
  }

  /** Pure operators may only ever see their own records; every other role
   *  (supervisor/QA/food safety/auditor/admin) has factory-wide visibility —
   *  mirrors `RecordsService.getRecentRecords`'s scoping rule. */
  private assertCanView(record: RecordWithHeaderRelations, user: RequestUser): void {
    if (hasOnlyRole(user.roles, "FG_OPERATOR") && record.createdById !== user.id) {
      throw new RecordNotFoundException(record.id);
    }
  }

  private assertOwnerCanEdit(record: RecordWithHeaderRelations, user: RequestUser): void {
    if (record.createdById !== user.id) {
      throw new RecordNotFoundException(record.id);
    }
    if (!isRecordEditable(record.status as SharedRecordStatus)) {
      throw new RecordLockedException();
    }
  }

  private async linkTaskAssignment(
    taskAssignmentId: string,
    recordId: string,
    userId: string,
  ): Promise<void> {
    const assignment = await this.prisma.taskAssignment.findUnique({
      where: { id: taskAssignmentId },
    });
    if (!assignment || assignment.assignedToId !== userId) {
      // Never let a malformed/foreign assignment id block draft creation —
      // the record itself is still valid without the dashboard link-back.
      this.logger.warn(
        `Ignoring taskAssignmentId "${taskAssignmentId}": not found or not owned by user "${userId}"`,
      );
      return;
    }
    await this.prisma.taskAssignment.update({
      where: { id: taskAssignmentId },
      data: {
        recordId,
        status: assignment.status === "ASSIGNED" ? "IN_PROGRESS" : assignment.status,
      },
    });
  }

  private async buildDetail(
    record: RecordWithHeaderRelations,
    user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    const templateVersion = await this.loadTemplateVersionContent(
      record.templateVersionId,
    );
    const versionDefinition = mapVersionToDefinition(templateVersion);

    const results = await this.prisma.inspectionResult.findMany({
      where: { recordId: record.id },
      include: RESULT_WITH_ATTACHMENTS_INCLUDE,
    });

    return {
      header: toHeader(record, versionDefinition.title, versionDefinition.versionNumber),
      version: versionDefinition,
      responses: toResponseMap(results),
      editable:
        isRecordEditable(record.status as SharedRecordStatus) &&
        record.createdById === user.id,
      truck: toTruckDetail(record),
    };
  }

  /** Validates + upserts every response in `responses` against the template
   *  version's items. Unknown item ids (not part of this template) are
   *  ignored defensively rather than erroring, since the client always
   *  drives `responses` off the same template it fetched. */
  private async persistResponses(
    recordId: string,
    templateVersion: VersionWithContent,
    responses: Record<string, unknown>,
    userId: string,
  ): Promise<void> {
    const versionDefinition = mapVersionToDefinition(templateVersion);
    const itemsById = new Map(
      flattenItems(versionDefinition.sections).map((item) => [item.id, item]),
    );

    for (const [itemId, rawResponse] of Object.entries(responses)) {
      const item = itemsById.get(itemId);
      if (!item) continue;

      const parsedResponse = checklistItemResponseSchema.safeParse(rawResponse);
      if (!parsedResponse.success) {
        throw new InvalidRecordPayloadException(
          formatZodIssues(parsedResponse.error.issues),
        );
      }
      await this.persistOneResponse(
        recordId,
        item,
        parsedResponse.data as ChecklistItemResponse,
        userId,
      );
    }
  }

  private async persistOneResponse(
    recordId: string,
    item: ChecklistItemDefinition,
    response: ChecklistItemResponse,
    userId: string,
  ): Promise<void> {
    if (!response.value || response.value.kind !== "status") {
      // Only status-type responses (Acceptable/Unacceptable/N/A, Pass/Fail/N/A,
      // Yes/No/N/A) are persisted for now — the current templates (CL/24,
      // CL/30) only use status-type items; see docs/CHECKLIST_ENGINE.md.
      return;
    }

    const status = resultStatusFromNormalized(item.itemType, response.value.value);

    const result = await this.prisma.inspectionResult.upsert({
      where: { recordId_itemId: { recordId, itemId: item.id } },
      create: {
        recordId,
        itemId: item.id,
        status,
        issueReason: response.issueReason ?? null,
        correction: response.correction ?? null,
        correctiveAction: response.correctiveAction ?? null,
        notes: response.remark ?? null,
      },
      update: {
        status,
        issueReason: response.issueReason ?? null,
        correction: response.correction ?? null,
        correctiveAction: response.correctiveAction ?? null,
        notes: response.remark ?? null,
      },
    });

    if (response.evidence) {
      await this.prisma.inspectionAttachment.deleteMany({
        where: { resultId: result.id },
      });
      for (const photo of response.evidence) {
        if (isDataUrl(photo.url)) {
          const buffer = decodeDataUrlToBuffer(photo.url);
          const uploaded = await this.gridFsEvidence.upload({
            buffer,
            originalFileName: photo.fileName,
            mimeType: parseDataUrlMimeType(photo.url),
            uploadedById: userId,
            recordId,
            resultId: result.id,
            evidenceType: "EVIDENCE",
          });
          const attachment = await this.prisma.inspectionAttachment.create({
            data: {
              recordId,
              resultId: result.id,
              kind: "EVIDENCE",
              fileUrl: `gridfs://${uploaded.gridFsFileId}`,
              fileName: photo.fileName,
              storedFileName: uploaded.storedFileName,
              mimeType: uploaded.mimeType,
              sizeBytes: uploaded.sizeBytes,
              contentSha256: uploaded.contentSha256,
              gridFsFileId: uploaded.gridFsFileId,
              gridFsBucket: uploaded.bucketName,
              uploadCorrelationId: uploaded.correlationId,
              uploadedById: userId,
            },
          });
          await this.prisma.inspectionAttachment.update({
            where: { id: attachment.id },
            data: { fileUrl: `/evidence/${attachment.id}/download` },
          });
        } else {
          await this.prisma.inspectionAttachment.create({
            data: {
              recordId,
              resultId: result.id,
              kind: "EVIDENCE",
              fileUrl: photo.url,
              fileName: photo.fileName,
              mimeType: parseDataUrlMimeType(photo.url),
              sizeBytes: estimateDataUrlSizeBytes(photo.url),
              uploadedById: userId,
            },
          });
        }
      }
    }
  }

  /** Creates one `CorrectiveAction` per failing item that is configured to
   *  require one (`correctiveActionRequiredOnFail`) — the "generate
   *  corrective action when configured on failure" business rule.
   *  Idempotent: never creates a second corrective action for a result that
   *  already has one. */
  private async createCorrectiveActionsForFailures(
    recordId: string,
    items: ChecklistItemDefinition[],
    responseMap: ChecklistResponseMap,
    results: Array<{ id: string; itemId: string }>,
    userId: string,
    prisma: Pick<PrismaService, "correctiveAction"> = this.prisma,
  ): Promise<number> {
    const resultByItemId = new Map(results.map((result) => [result.itemId, result]));
    let created = 0;

    for (const item of items) {
      if (!item.correctiveActionRequiredOnFail) continue;
      const response = responseMap[item.id];
      if (!isFailureResponse(item, response)) continue;

      const result = resultByItemId.get(item.id);
      if (!result) continue;

      const alreadyExists = await prisma.correctiveAction.findFirst({
        where: { resultId: result.id },
      });
      if (alreadyExists) continue;

      const description =
        [response?.issueReason, response?.remark, response?.correction]
          .filter(Boolean)
          .join(" — ") || `Failure recorded for "${item.label}"`;

      await prisma.correctiveAction.create({
        data: {
          recordId,
          resultId: result.id,
          title: `${item.label} — corrective action required`,
          description,
          status: "OPEN",
          priority: item.isCriticalFailure ? "CRITICAL" : "HIGH",
          createdById: userId,
        },
      });
      created += 1;
    }

    return created;
  }
}

function formatZodIssues(issues: Array<{ message: string }>): string {
  return issues.map((issue) => issue.message).join("; ") || "Invalid request payload";
}
