import {
  formatRecordNumber,
  monthLabelFromDateOnly,
  utcDateToDateOnly,
  type ChecklistItemResponse,
  type ChecklistItemType as SharedChecklistItemType,
  type ChecklistResponseMap,
  type InspectionRecordHeader,
  type LoadingDecision,
  type NormalizedStatusValue,
  type RecordStatus as SharedRecordStatus,
  type TruckInspectionDetailPayload,
} from "@nelna/shared";
import type { ChecklistItemType, Prisma, ResultStatus } from "../../generated/prisma-client";
import { ResultStatus as ResultStatusEnum } from "../../generated/prisma-client";
import { toDriverSummary, toTransporterSummary, toVehicleSummary } from "../vehicles/vehicles.mappers";

export const TRUCK_DETAIL_INCLUDE = {
  vehicle: { include: { transporter: true } },
  driver: true,
  transporter: true,
  decidedBy: true,
} satisfies Prisma.TruckInspectionDetailInclude;

export type TruckDetailWithRelations = Prisma.TruckInspectionDetailGetPayload<{
  include: typeof TRUCK_DETAIL_INCLUDE;
}>;

export const RECORD_HEADER_INCLUDE = {
  createdBy: true,
  checkedBy: true,
  verifiedBy: true,
  shift: true,
  truckDetail: { include: TRUCK_DETAIL_INCLUDE },
  reinspectionOf: true,
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
  return utcDateToDateOnly(date);
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
    recordMonth: monthLabelFromDateOnly(recordDate),
    shiftLabel: record.shift?.name ?? null,
    areaLabel: record.areaLabel,
    recordedBy: {
      id: record.createdBy.id,
      fullName: record.createdBy.fullName,
      employeeCode: record.createdBy.employeeCode,
    },
    checkedBy: record.checkedBy
      ? {
          id: record.checkedBy.id,
          fullName: record.checkedBy.fullName,
          employeeCode: record.checkedBy.employeeCode,
        }
      : null,
    verifiedBy: record.verifiedBy
      ? {
          id: record.verifiedBy.id,
          fullName: record.verifiedBy.fullName,
          employeeCode: record.verifiedBy.employeeCode,
        }
      : null,
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

/** Maps a record's optional `truckDetail` relation onto the shared
 *  `TruckInspectionDetailPayload` — `null` for every non-truck document
 *  code (e.g. Daily Cleaning Verification never has a `truckDetail`). */
export function toTruckDetail(record: RecordWithHeaderRelations): TruckInspectionDetailPayload | null {
  const detail = record.truckDetail;
  if (!detail) return null;

  return {
    vehicle: detail.vehicle ? toVehicleSummary(detail.vehicle) : null,
    driver: detail.driver ? toDriverSummary(detail.driver) : null,
    transporter: detail.transporter ? toTransporterSummary(detail.transporter) : null,
    freezerTruckNumber: detail.freezerTruckNumber,
    vehicleNumber: detail.vehicleNumber,
    inspectionTime: detail.inspectionTime ?? null,
    loadingReference: detail.loadingReference,
    productCategory: detail.productCategory,
    temperature: {
      current: detail.temperatureCurrent,
      min: detail.temperatureMin,
      max: detail.temperatureMax,
      acceptable: detail.temperatureAcceptable,
    },
    recommendedDecision: (detail.recommendedDecision as LoadingDecision | null) ?? null,
    loadingDecision: detail.loadingDecision as LoadingDecision,
    decidedBy: detail.decidedBy
      ? { id: detail.decidedBy.id, fullName: detail.decidedBy.fullName, employeeCode: detail.decidedBy.employeeCode }
      : null,
    decidedAt: detail.decidedAt ? detail.decidedAt.toISOString() : null,
    remarks: detail.remarks,
    reinspectionOf: record.reinspectionOf
      ? {
          recordId: record.reinspectionOf.id,
          recordNumber: formatRecordNumber(
            record.reinspectionOf.documentCode,
            toDateOnlyString(record.reinspectionOf.recordDate),
            record.reinspectionOf.id,
          ),
        }
      : null,
  };
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
