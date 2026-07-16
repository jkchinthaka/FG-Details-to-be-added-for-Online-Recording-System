import { Injectable, Logger } from "@nestjs/common";
import { isRecordEditable, type RecordStatus } from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  RecordAccessForbiddenException,
  RecordLockedException,
  RecordNotFoundException,
} from "../inspection-records/inspection-records.errors";
import {
  GridFsEvidenceService,
  type GridFsUploadResult,
} from "./gridfs-evidence.service";

export type UploadableRecord = {
  id: string;
  createdById: string;
  status: string;
};

export type ReplaceableAttachment = {
  id: string;
  recordId: string;
  resultId: string | null;
  gridFsFileId: string | null;
  createdById: string;
  status: string;
};

/**
 * FG-FILE-001 — evidence lifecycle orchestration.
 *
 * Owns record-level authorization for uploads, attachment metadata persistence
 * with compensation, and the failure-safe replacement swap. Kept free of HTTP
 * and multipart concerns so it can be unit-tested with mocked Prisma/GridFS.
 */
@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gridFs: GridFsEvidenceService,
  ) {}

  /**
   * A record may only receive evidence while it is editable and only by its
   * creator. This blocks uploads to submitted/checked/verified (immutable)
   * records and to records owned by another user.
   */
  async assertRecordUploadable(
    recordId: string,
    userId: string,
  ): Promise<UploadableRecord> {
    const record = await this.prisma.inspectionRecord.findUnique({
      where: { id: recordId },
      select: { id: true, createdById: true, status: true },
    });
    if (!record) {
      throw new RecordNotFoundException(recordId);
    }
    if (record.createdById !== userId) {
      throw new RecordAccessForbiddenException();
    }
    if (!isRecordEditable(record.status as RecordStatus)) {
      throw new RecordLockedException();
    }
    return record;
  }

  /** Loads and authorizes an attachment for replacement BEFORE any binary is
   *  accepted, so an unauthorized/immutable request never spends I/O. */
  async assertAttachmentReplaceable(
    attachmentId: string,
    userId: string,
  ): Promise<ReplaceableAttachment> {
    const attachment = await this.prisma.inspectionAttachment.findUnique({
      where: { id: attachmentId },
      include: { record: { select: { createdById: true, status: true } } },
    });
    if (!attachment) {
      throw new RecordNotFoundException(attachmentId);
    }
    if (attachment.record.createdById !== userId) {
      throw new RecordAccessForbiddenException();
    }
    if (!isRecordEditable(attachment.record.status as RecordStatus)) {
      throw new RecordLockedException();
    }
    return {
      id: attachment.id,
      recordId: attachment.recordId,
      resultId: attachment.resultId,
      gridFsFileId: attachment.gridFsFileId,
      createdById: attachment.record.createdById,
      status: attachment.record.status,
    };
  }

  /**
   * Persists metadata for a freshly uploaded binary. If the metadata write
   * fails, the just-uploaded binary is compensated (deleted) and a
   * reconciliation event is recorded so nothing is left orphaned.
   */
  async persistUploadedAttachment(
    record: UploadableRecord,
    resultId: string | undefined,
    uploaded: GridFsUploadResult,
    userId: string,
  ) {
    try {
      const attachment = await this.prisma.inspectionAttachment.create({
        data: {
          recordId: record.id,
          resultId: resultId ?? null,
          kind: "EVIDENCE",
          fileUrl: `gridfs://${uploaded.gridFsFileId}`,
          fileName: uploaded.originalFileName,
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
      return await this.prisma.inspectionAttachment.update({
        where: { id: attachment.id },
        data: { fileUrl: `/evidence/${attachment.id}/download` },
      });
    } catch (err) {
      await this.gridFs.deleteFile(uploaded.gridFsFileId);
      await this.gridFs.recordReconciliationEvent({
        type: "METADATA_WRITE_FAILED_COMPENSATED",
        gridFsFileId: uploaded.gridFsFileId,
        reason: "attachment metadata write failed; orphaned binary deleted",
      });
      throw err;
    }
  }

  /**
   * Failure-safe replacement. The new binary is already stored in `uploaded`.
   * We atomically swap the attachment metadata to point at it and only then
   * remove the old binary.
   *
   *  - Metadata swap fails  -> retain old evidence, delete the new orphan,
   *    record a reconciliation event.
   *  - Old-file delete fails -> keep the correct (new) metadata, queue the old
   *    binary for orphan cleanup; never remove the valid new evidence.
   */
  async swapAttachmentBinary(
    existing: ReplaceableAttachment,
    uploaded: GridFsUploadResult,
  ) {
    const oldFileId = existing.gridFsFileId;

    let updated;
    try {
      updated = await this.prisma.inspectionAttachment.update({
        where: { id: existing.id },
        data: {
          fileUrl: `/evidence/${existing.id}/download`,
          fileName: uploaded.originalFileName,
          storedFileName: uploaded.storedFileName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          contentSha256: uploaded.contentSha256,
          gridFsFileId: uploaded.gridFsFileId,
          gridFsBucket: uploaded.bucketName,
          uploadCorrelationId: uploaded.correlationId,
        },
      });
    } catch (err) {
      // Metadata failed — old evidence is untouched and still valid.
      await this.gridFs.deleteFile(uploaded.gridFsFileId);
      await this.gridFs.recordReconciliationEvent({
        type: "REPLACE_METADATA_FAILED_COMPENSATED",
        gridFsFileId: uploaded.gridFsFileId,
        attachmentId: existing.id,
        reason: "replacement metadata swap failed; new orphan deleted, old retained",
      });
      throw err;
    }

    if (oldFileId && oldFileId !== uploaded.gridFsFileId) {
      const removed = await this.gridFs.deleteFile(oldFileId);
      if (!removed) {
        // New metadata is correct; the old binary could not be removed now.
        await this.gridFs.recordReconciliationEvent({
          type: "ORPHAN_PENDING_DELETE",
          gridFsFileId: oldFileId,
          attachmentId: existing.id,
          reason: "old evidence binary deletion failed after successful swap",
        });
      }
    }

    return updated;
  }

  /**
   * Rolls back a partially-successful batch upload: removes created attachment
   * rows and their binaries so a failed multi-file upload leaves no residue.
   */
  async rollbackCreated(
    created: Array<{ id: string; gridFsFileId: string | null }>,
  ): Promise<void> {
    for (const item of created) {
      try {
        await this.prisma.inspectionAttachment.delete({ where: { id: item.id } });
      } catch {
        this.logger.warn(`Rollback: attachment ${item.id} row already gone`);
      }
      if (item.gridFsFileId) {
        await this.gridFs.deleteFile(item.gridFsFileId);
      }
    }
  }
}
