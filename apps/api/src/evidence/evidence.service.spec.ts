import { EvidenceService } from "./evidence.service";
import type { GridFsUploadResult } from "./gridfs-evidence.service";
import {
  RecordAccessForbiddenException,
  RecordLockedException,
  RecordNotFoundException,
} from "../inspection-records/inspection-records.errors";

function uploaded(overrides: Partial<GridFsUploadResult> = {}): GridFsUploadResult {
  return {
    gridFsFileId: "file-new",
    bucketName: "fgEvidence",
    originalFileName: "photo.jpg",
    storedFileName: "123-abc.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    contentSha256: "hash",
    uploadedAt: new Date(),
    correlationId: "corr-1",
    ...overrides,
  };
}

function build() {
  const prisma = {
    inspectionRecord: { findUnique: jest.fn() },
    inspectionAttachment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const gridFs = {
    deleteFile: jest.fn().mockResolvedValue(true),
    recordReconciliationEvent: jest.fn().mockResolvedValue(undefined),
  };
  const service = new EvidenceService(prisma as never, gridFs as never);
  return { service, prisma, gridFs };
}

describe("EvidenceService.assertRecordUploadable", () => {
  it("throws when the record does not exist", async () => {
    const { service, prisma } = build();
    prisma.inspectionRecord.findUnique.mockResolvedValue(null);
    await expect(service.assertRecordUploadable("r1", "u1")).rejects.toBeInstanceOf(
      RecordNotFoundException,
    );
  });

  it("forbids uploads by a non-owner", async () => {
    const { service, prisma } = build();
    prisma.inspectionRecord.findUnique.mockResolvedValue({
      id: "r1",
      createdById: "other",
      status: "DRAFT",
    });
    await expect(service.assertRecordUploadable("r1", "u1")).rejects.toBeInstanceOf(
      RecordAccessForbiddenException,
    );
  });

  it("rejects uploads to an immutable record", async () => {
    const { service, prisma } = build();
    prisma.inspectionRecord.findUnique.mockResolvedValue({
      id: "r1",
      createdById: "u1",
      status: "CHECKED",
    });
    await expect(service.assertRecordUploadable("r1", "u1")).rejects.toBeInstanceOf(
      RecordLockedException,
    );
  });

  it("allows the owner while editable", async () => {
    const { service, prisma } = build();
    prisma.inspectionRecord.findUnique.mockResolvedValue({
      id: "r1",
      createdById: "u1",
      status: "DRAFT",
    });
    await expect(service.assertRecordUploadable("r1", "u1")).resolves.toMatchObject({
      id: "r1",
    });
  });
});

describe("EvidenceService.persistUploadedAttachment", () => {
  const record = { id: "r1", createdById: "u1", status: "DRAFT" };

  it("creates then links the attachment on success", async () => {
    const { service, prisma } = build();
    prisma.inspectionAttachment.create.mockResolvedValue({ id: "att-1" });
    prisma.inspectionAttachment.update.mockResolvedValue({
      id: "att-1",
      fileUrl: "/evidence/att-1/download",
    });
    const result = await service.persistUploadedAttachment(
      record,
      undefined,
      uploaded(),
      "u1",
    );
    expect(result.fileUrl).toBe("/evidence/att-1/download");
  });

  it("compensates by deleting the binary when metadata write fails", async () => {
    const { service, prisma, gridFs } = build();
    prisma.inspectionAttachment.create.mockRejectedValue(new Error("db down"));
    await expect(
      service.persistUploadedAttachment(record, undefined, uploaded(), "u1"),
    ).rejects.toThrow("db down");
    expect(gridFs.deleteFile).toHaveBeenCalledWith("file-new");
    expect(gridFs.recordReconciliationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "METADATA_WRITE_FAILED_COMPENSATED" }),
    );
  });
});

describe("EvidenceService.swapAttachmentBinary", () => {
  const existing = {
    id: "att-1",
    recordId: "r1",
    resultId: null,
    gridFsFileId: "file-old",
    createdById: "u1",
    status: "DRAFT",
  };

  it("swaps metadata then removes the old binary", async () => {
    const { service, prisma, gridFs } = build();
    prisma.inspectionAttachment.update.mockResolvedValue({
      id: "att-1",
      fileUrl: "/evidence/att-1/download",
    });
    await service.swapAttachmentBinary(existing, uploaded());
    expect(prisma.inspectionAttachment.update).toHaveBeenCalled();
    expect(gridFs.deleteFile).toHaveBeenCalledWith("file-old");
  });

  it("retains old evidence and deletes the new orphan when the swap fails", async () => {
    const { service, prisma, gridFs } = build();
    prisma.inspectionAttachment.update.mockRejectedValue(new Error("swap failed"));
    await expect(service.swapAttachmentBinary(existing, uploaded())).rejects.toThrow(
      "swap failed",
    );
    // New orphan removed, old NOT deleted.
    expect(gridFs.deleteFile).toHaveBeenCalledWith("file-new");
    expect(gridFs.deleteFile).not.toHaveBeenCalledWith("file-old");
    expect(gridFs.recordReconciliationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "REPLACE_METADATA_FAILED_COMPENSATED" }),
    );
  });

  it("queues an orphan cleanup when the old binary delete fails after swap", async () => {
    const { service, prisma, gridFs } = build();
    prisma.inspectionAttachment.update.mockResolvedValue({ id: "att-1" });
    gridFs.deleteFile.mockResolvedValue(false); // old delete fails
    await service.swapAttachmentBinary(existing, uploaded());
    expect(gridFs.recordReconciliationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ORPHAN_PENDING_DELETE",
        gridFsFileId: "file-old",
      }),
    );
  });
});

describe("EvidenceService.rollbackCreated", () => {
  it("deletes rows and binaries for a partial batch", async () => {
    const { service, prisma, gridFs } = build();
    prisma.inspectionAttachment.delete.mockResolvedValue(undefined);
    await service.rollbackCreated([
      { id: "att-1", gridFsFileId: "file-1" },
      { id: "att-2", gridFsFileId: "file-2" },
    ]);
    expect(prisma.inspectionAttachment.delete).toHaveBeenCalledTimes(2);
    expect(gridFs.deleteFile).toHaveBeenCalledWith("file-1");
    expect(gridFs.deleteFile).toHaveBeenCalledWith("file-2");
  });
});
