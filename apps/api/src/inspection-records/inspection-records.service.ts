import { Injectable, Logger } from "@nestjs/common";
import {
  DOCUMENT_CODES,
  checklistItemResponseSchema,
  computeRecordCounts,
  createCleaningDraftSchema,
  detectWorkShiftForHour,
  flattenItems,
  formatRecordNumber,
  isFailureResponse,
  isRecordEditable,
  nextResponsibleRoleForStatus,
  resolveDraftDuplicate,
  saveDraftResponsesSchema,
  submitInspectionRecordSchema,
  validateChecklistResponses,
  type ChecklistItemDefinition,
  type ChecklistItemResponse,
  type ChecklistResponseMap,
  type InspectionRecordDetail,
  type RecordStatus as SharedRecordStatus,
  type SubmitRecordResult,
  type WorkShift,
} from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";
import { RecordStatus, TemplateStatus } from "../../generated/prisma-client";
import {
  VERSION_WITH_CONTENT_INCLUDE,
  mapVersionToDefinition,
  type VersionWithContent,
} from "../checklist-templates/checklist-templates.mappers";
import type { CreateCleaningDraftDto } from "./dto/create-cleaning-draft.dto";
import type { SaveDraftDto } from "./dto/save-draft.dto";
import type { SubmitRecordDto } from "./dto/submit-record.dto";
import {
  DuplicateRecordException,
  InvalidRecordPayloadException,
  PublishedTemplateNotFoundException,
  RecordLockedException,
  RecordNotFoundException,
  RecordValidationException,
} from "./inspection-records.errors";
import {
  RECORD_HEADER_INCLUDE,
  RESULT_WITH_ATTACHMENTS_INCLUDE,
  estimateDataUrlSizeBytes,
  parseDataUrlMimeType,
  resultStatusFromNormalized,
  toHeader,
  toResponseMap,
  type RecordWithHeaderRelations,
} from "./inspection-records.mappers";

const DEFAULT_CLEANING_AREA_LABEL = "Finished Goods + Changing Room";

function hasOnlyRole(roles: string[], role: string): boolean {
  return roles.length > 0 && roles.every((r) => r === role);
}

@Injectable()
export class InspectionRecordsService {
  private readonly logger = new Logger(InspectionRecordsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Create / resume draft
  // -------------------------------------------------------------------------

  async createCleaningDraft(user: RequestUser, dto: CreateCleaningDraftDto): Promise<InspectionRecordDetail> {
    const parsed = createCleaningDraftSchema.safeParse(dto);
    if (!parsed.success) {
      throw new InvalidRecordPayloadException(formatZodIssues(parsed.error.issues));
    }

    const recordDate = parsed.data.recordDate ?? todayDateString();
    const recordDateAtMidnight = dateOnlyToUtcMidnight(recordDate);
    const shiftCode: WorkShift = parsed.data.shiftCode ?? detectWorkShiftForHour(new Date().getUTCHours());
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
      existing ? { id: existing.id, status: existing.status as SharedRecordStatus, createdById: existing.createdById } : null,
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
      const templateVersion = await this.findPublishedTemplateVersion(DOCUMENT_CODES.DAILY_CLEANING);
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

  async saveDraft(user: RequestUser, id: string, dto: SaveDraftDto): Promise<InspectionRecordDetail> {
    const parsed = saveDraftResponsesSchema.safeParse(dto);
    if (!parsed.success) {
      throw new InvalidRecordPayloadException(formatZodIssues(parsed.error.issues));
    }

    const record = await this.findRecordOrThrow(id);
    this.assertOwnerCanEdit(record, user);

    const templateVersion = await this.loadTemplateVersionContent(record.templateVersionId);
    await this.persistResponses(record.id, templateVersion, parsed.data.responses, user.id);

    if (parsed.data.areaLabel && parsed.data.areaLabel !== record.areaLabel) {
      await this.prisma.inspectionRecord.update({ where: { id }, data: { areaLabel: parsed.data.areaLabel } });
    }

    return this.getById(user, id);
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  async submit(user: RequestUser, id: string, dto: SubmitRecordDto): Promise<SubmitRecordResult> {
    const parsed = submitInspectionRecordSchema.safeParse(dto ?? {});
    if (!parsed.success) {
      throw new InvalidRecordPayloadException(formatZodIssues(parsed.error.issues));
    }

    const record = await this.findRecordOrThrow(id);
    this.assertOwnerCanEdit(record, user);

    const templateVersion = await this.loadTemplateVersionContent(record.templateVersionId);

    if (parsed.data.responses) {
      await this.persistResponses(record.id, templateVersion, parsed.data.responses, user.id);
    }

    const versionDefinition = mapVersionToDefinition(templateVersion);
    const items = flattenItems(versionDefinition.sections);

    const results = await this.prisma.inspectionResult.findMany({
      where: { recordId: record.id },
      include: RESULT_WITH_ATTACHMENTS_INCLUDE,
    });
    const responseMap = toResponseMap(results);

    const validation = validateChecklistResponses(versionDefinition.sections, responseMap);
    if (!validation.isValid) {
      throw new RecordValidationException(validation.errors);
    }

    const submittedAt = new Date();
    await this.prisma.inspectionRecord.update({
      where: { id: record.id },
      data: { status: RecordStatus.SUBMITTED, submittedAt },
    });

    const correctiveActionsCreated = await this.createCorrectiveActionsForFailures(
      record.id,
      items,
      responseMap,
      results,
      user.id,
    );

    await this.prisma.taskAssignment.updateMany({
      where: { recordId: record.id },
      data: { status: "SUBMITTED" },
    });

    const counts = computeRecordCounts(items, responseMap);
    const status: SharedRecordStatus = "SUBMITTED";

    return {
      recordId: record.id,
      documentCode: record.documentCode,
      recordNumber: formatRecordNumber(record.documentCode, toDateOnlyStringLocal(record.recordDate), record.id),
      status,
      submittedAt: submittedAt.toISOString(),
      counts,
      hasCriticalFailure: validation.hasCriticalFailure,
      correctiveActionsCreated,
      nextResponsibleRole: nextResponsibleRoleForStatus(status),
    } satisfies SubmitRecordResult;
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

  private async loadTemplateVersionContent(templateVersionId: string): Promise<VersionWithContent> {
    return this.prisma.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: templateVersionId },
      include: VERSION_WITH_CONTENT_INCLUDE,
    });
  }

  private async findRecordOrThrow(id: string): Promise<RecordWithHeaderRelations> {
    const record = await this.prisma.inspectionRecord.findUnique({ where: { id }, include: RECORD_HEADER_INCLUDE });
    if (!record) throw new RecordNotFoundException(id);
    return record;
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

  private async linkTaskAssignment(taskAssignmentId: string, recordId: string, userId: string): Promise<void> {
    const assignment = await this.prisma.taskAssignment.findUnique({ where: { id: taskAssignmentId } });
    if (!assignment || assignment.assignedToId !== userId) {
      // Never let a malformed/foreign assignment id block draft creation —
      // the record itself is still valid without the dashboard link-back.
      this.logger.warn(`Ignoring taskAssignmentId "${taskAssignmentId}": not found or not owned by user "${userId}"`);
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

  private async buildDetail(record: RecordWithHeaderRelations, user: RequestUser): Promise<InspectionRecordDetail> {
    const templateVersion = await this.loadTemplateVersionContent(record.templateVersionId);
    const versionDefinition = mapVersionToDefinition(templateVersion);

    const results = await this.prisma.inspectionResult.findMany({
      where: { recordId: record.id },
      include: RESULT_WITH_ATTACHMENTS_INCLUDE,
    });

    return {
      header: toHeader(record, versionDefinition.title, versionDefinition.versionNumber),
      version: versionDefinition,
      responses: toResponseMap(results),
      editable: isRecordEditable(record.status as SharedRecordStatus) && record.createdById === user.id,
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
    const itemsById = new Map(flattenItems(versionDefinition.sections).map((item) => [item.id, item]));

    for (const [itemId, rawResponse] of Object.entries(responses)) {
      const item = itemsById.get(itemId);
      if (!item) continue;

      const parsedResponse = checklistItemResponseSchema.safeParse(rawResponse);
      if (!parsedResponse.success) {
        throw new InvalidRecordPayloadException(formatZodIssues(parsedResponse.error.issues));
      }
      await this.persistOneResponse(recordId, item, parsedResponse.data as ChecklistItemResponse, userId);
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
      await this.prisma.inspectionAttachment.deleteMany({ where: { resultId: result.id } });
      if (response.evidence.length > 0) {
        await this.prisma.inspectionAttachment.createMany({
          data: response.evidence.map((photo) => ({
            recordId,
            resultId: result.id,
            kind: "EVIDENCE",
            fileUrl: photo.url,
            fileName: photo.fileName,
            mimeType: parseDataUrlMimeType(photo.url),
            sizeBytes: estimateDataUrlSizeBytes(photo.url),
            uploadedById: userId,
          })),
        });
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
  ): Promise<number> {
    const resultByItemId = new Map(results.map((result) => [result.itemId, result]));
    let created = 0;

    for (const item of items) {
      if (!item.correctiveActionRequiredOnFail) continue;
      const response = responseMap[item.id];
      if (!isFailureResponse(item, response)) continue;

      const result = resultByItemId.get(item.id);
      if (!result) continue;

      const alreadyExists = await this.prisma.correctiveAction.findFirst({ where: { resultId: result.id } });
      if (alreadyExists) continue;

      const description =
        [response?.issueReason, response?.remark, response?.correction].filter(Boolean).join(" — ") ||
        `Failure recorded for "${item.label}"`;

      await this.prisma.correctiveAction.create({
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

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyToUtcMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function toDateOnlyStringLocal(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatZodIssues(issues: Array<{ message: string }>): string {
  return issues.map((issue) => issue.message).join("; ") || "Invalid request payload";
}
