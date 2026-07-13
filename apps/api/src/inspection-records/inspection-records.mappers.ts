import {
  formatRecordNumber,
  type ChecklistItemResponse,
  type ChecklistItemType as SharedChecklistItemType,
  type ChecklistResponseMap,
  type InspectionRecordHeader,
  type NormalizedStatusValue,
  type RecordStatus as SharedRecordStatus,
} from "@nelna/shared";
import type { ChecklistItemType, Prisma, ResultStatus } from "../../generated/prisma-client";
import { ResultStatus as ResultStatusEnum } from "../../generated/prisma-client";

export const RECORD_HEADER_INCLUDE = {
  createdBy: true,
  shift: true,
} satisfies Prisma.InspectionRecordInclude;

export type RecordWithHeaderRelations = Prisma.InspectionRecordGetPayload<{
  include: typeof RECORD_HEADER_INCLUDE;
}>;

export const RESULT_WITH_ATTACHMENTS_INCLUDE = {
  attachments: true,
} satisfies Prisma.InspectionResultInclude;

export type ResultWithAttachments = Prisma.InspectionResultGetPayload<{
  include: typeof RESULT_WITH_ATTACHMENTS_INCLUDE;
}>;

export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toHeader(
  record: RecordWithHeaderRelations,
  templateTitle: string,
  templateVersionNumber: number,
): InspectionRecordHeader {
  const recordDate = toDateOnlyString(record.recordDate);
  return {
    id: record.id,
    documentCode: record.documentCode,
    recordNumber: formatRecordNumber(record.documentCode, recordDate, record.id),
    templateTitle,
    templateVersionNumber,
    status: record.status as SharedRecordStatus,
    recordDate,
    shiftLabel: record.shift?.name ?? null,
    areaLabel: record.areaLabel,
    recordedBy: {
      id: record.createdBy.id,
      fullName: record.createdBy.fullName,
      employeeCode: record.createdBy.employeeCode,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    submittedAt: record.submittedAt ? record.submittedAt.toISOString() : null,
    checkedAt: record.checkedAt ? record.checkedAt.toISOString() : null,
    verifiedAt: record.verifiedAt ? record.verifiedAt.toISOString() : null,
  };
}

/** Normalizes either half of the shared `ResultStatus` vocabulary
 *  (Acceptable/Unacceptable vs. Pass/Fail — see schema.prisma) onto the
 *  engine's generic PASS/FAIL/NOT_APPLICABLE value. */
export function normalizedStatusFromResultStatus(status: ResultStatus): NormalizedStatusValue {
  switch (status) {
    case ResultStatusEnum.ACCEPTABLE:
    case ResultStatusEnum.PASS:
      return "PASS";
    case ResultStatusEnum.UNACCEPTABLE:
    case ResultStatusEnum.FAIL:
      return "FAIL";
    case ResultStatusEnum.NOT_APPLICABLE:
    default:
      return "NOT_APPLICABLE";
  }
}

/** Picks the DB-stored vocabulary half matching `itemType`'s UI labels —
 *  ACCEPTABLE_UNACCEPTABLE_NA/YES_NO_NA store Acceptable/Unacceptable,
 *  PASS_FAIL_NA stores Pass/Fail. */
export function resultStatusFromNormalized(
  itemType: ChecklistItemType | SharedChecklistItemType,
  normalized: NormalizedStatusValue,
): ResultStatus {
  if (normalized === "NOT_APPLICABLE") return ResultStatusEnum.NOT_APPLICABLE;
  if (itemType === "PASS_FAIL_NA") {
    return normalized === "PASS" ? ResultStatusEnum.PASS : ResultStatusEnum.FAIL;
  }
  return normalized === "PASS" ? ResultStatusEnum.ACCEPTABLE : ResultStatusEnum.UNACCEPTABLE;
}

export function toResponseMap(results: ResultWithAttachments[]): ChecklistResponseMap {
  const map: ChecklistResponseMap = {};
  for (const result of results) {
    const response: ChecklistItemResponse = {
      itemId: result.itemId,
      value: { kind: "status", value: normalizedStatusFromResultStatus(result.status) },
      remark: result.notes ?? undefined,
      issueReason: result.issueReason ?? undefined,
      correction: result.correction ?? undefined,
      correctiveAction: result.correctiveAction ?? undefined,
      evidence: result.attachments.map((attachment) => ({
        id: attachment.id,
        url: attachment.fileUrl,
        fileName: attachment.fileName,
        capturedAt: attachment.uploadedAt.toISOString(),
      })),
    };
    map[result.itemId] = response;
  }
  return map;
}

/** Photo evidence is currently stored as opaque data URLs (mirrors
 *  `EvidenceUploader`'s "UI ready for a real upload API" client behaviour) —
 *  these two helpers derive the attachment metadata Prisma requires without
 *  a real object storage integration. */
export function parseDataUrlMimeType(url: string): string {
  const match = /^data:([^;]+);base64,/.exec(url);
  return match?.[1] ?? "application/octet-stream";
}

export function estimateDataUrlSizeBytes(url: string): number {
  const base64 = url.split(",")[1] ?? "";
  return Math.max(0, Math.floor((base64.length * 3) / 4));
}
