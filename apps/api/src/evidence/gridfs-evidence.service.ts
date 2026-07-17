import { createHash, randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  GridFSBucket,
  MongoClient,
  ObjectId,
  type Db,
  type GridFSBucketWriteStream,
} from "mongodb";
import {
  EVIDENCE_MAX_FILE_BYTES,
  type EvidenceContentType,
  type EvidenceRejectionCode,
  detectEvidenceSignature,
  evidenceExtensionOf,
  extensionsForMime,
  isAllowedEvidenceExtension,
  isAllowedEvidenceMime,
  normalizeEvidenceFileName,
} from "@nelna/shared";

export const FG_EVIDENCE_BUCKET = "fgEvidence";

/** Bytes buffered before signature detection — enough for every allowed type. */
const SIGNATURE_HEAD_BYTES = 16;

/** Raised when an upload violates the evidence policy. Carries a stable code so
 *  the controller can translate it into a precise HTTP response for the UI. */
export class EvidenceUploadError extends Error {
  constructor(
    readonly code: EvidenceRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = "EvidenceUploadError";
  }
}

export type GridFsStreamUploadInput = {
  source: Readable;
  originalFileName: string;
  claimedMimeType: string;
  uploadedById: string;
  recordId?: string;
  resultId?: string;
  correctiveActionId?: string;
  evidenceType?: string;
  correlationId?: string;
};

export type GridFsBufferUploadInput = {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  uploadedById: string;
  recordId?: string;
  resultId?: string;
  correctiveActionId?: string;
  evidenceType?: string;
  correlationId?: string;
};

export type GridFsUploadResult = {
  gridFsFileId: string;
  bucketName: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: EvidenceContentType;
  sizeBytes: number;
  contentSha256: string;
  uploadedAt: Date;
  correlationId: string;
};

export type OrphanFileRecord = {
  gridFsFileId: string;
  storedFileName: string;
  sizeBytes: number;
  uploadedAt: Date | null;
};

function assertDatabaseName(url: string): string {
  const path = (url.split("?")[0] ?? "").split("/").pop() ?? "";
  if (!path) {
    throw new Error("DATABASE_URL must include an explicit database name");
  }
  return path;
}

/** Reject a filename whose extension is not on the allow-list before any I/O. */
function assertAllowedNameAndMime(originalFileName: string, claimedMime: string): void {
  if (!isAllowedEvidenceExtension(originalFileName)) {
    throw new EvidenceUploadError(
      "DISALLOWED_EXTENSION",
      "Evidence file extension is not allowed",
    );
  }
  const claimed = claimedMime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (claimed && !isAllowedEvidenceMime(claimed)) {
    throw new EvidenceUploadError("DISALLOWED_MIME", "Evidence MIME type is not allowed");
  }
}

/** The detected (magic-byte) type must be consistent with the extension and,
 *  when declared, the client MIME. This is the anti-spoofing gate. */
function assertConsistentType(
  detected: EvidenceContentType,
  originalFileName: string,
  claimedMime: string,
): void {
  const ext = evidenceExtensionOf(originalFileName);
  if (!extensionsForMime(detected).includes(ext)) {
    throw new EvidenceUploadError(
      "MIME_SPOOFED",
      "Evidence extension does not match its content",
    );
  }
  const claimed = claimedMime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (claimed && claimed !== detected) {
    throw new EvidenceUploadError(
      "MIME_SPOOFED",
      "Declared evidence type does not match its content",
    );
  }
}

@Injectable()
export class GridFsEvidenceService implements OnModuleDestroy {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private bucket: GridFSBucket | null = null;
  private connecting: Promise<void> | null = null;

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close().catch(() => undefined);
      this.client = null;
      this.db = null;
      this.bucket = null;
    }
  }

  async ping(): Promise<boolean> {
    await this.ensureConnected();
    if (!this.db) return false;
    await this.db.command({ ping: 1 });
    return true;
  }

  /**
   * Stream a file part directly into GridFS without ever holding the whole file
   * in memory or converting it to base64. The first bytes are sniffed for a
   * valid signature before the object is finalised; size is enforced as the
   * stream flows, and any partial object is deleted on failure so a rejected
   * upload never leaves an orphan.
   */
  async uploadStream(input: GridFsStreamUploadInput): Promise<GridFsUploadResult> {
    await this.ensureConnected();
    const bucket = this.bucket;
    if (!bucket) {
      throw new Error("GridFS bucket is not available");
    }

    assertAllowedNameAndMime(input.originalFileName, input.claimedMimeType);

    const originalFileName = normalizeEvidenceFileName(input.originalFileName);
    const correlationId = input.correlationId?.trim() || randomUUID();
    const storedFileName = `${Date.now()}-${randomUUID()}${evidenceExtensionOf(
      originalFileName,
    )}`;
    const hash = createHash("sha256");

    let size = 0;
    let headBuf = Buffer.alloc(0);
    let detected: EvidenceContentType | null = null;
    let uploadStream: GridFSBucketWriteStream | null = null;

    const openWith = (mime: EvidenceContentType): GridFSBucketWriteStream =>
      bucket.openUploadStream(storedFileName, {
        metadata: {
          originalFileName,
          mimeType: mime,
          contentType: mime,
          contentSha256: null,
          uploadedById: input.uploadedById,
          recordId: input.recordId ?? null,
          resultId: input.resultId ?? null,
          correctiveActionId: input.correctiveActionId ?? null,
          evidenceType: input.evidenceType ?? "EVIDENCE",
          correlationId,
          bucketName: FG_EVIDENCE_BUCKET,
          retentionStatus: "ACTIVE",
        },
      });

    const writeChunk = (stream: GridFSBucketWriteStream, chunk: Buffer): Promise<void> =>
      new Promise((resolve, reject) => {
        stream.write(chunk, (err) => (err ? reject(err) : resolve()));
      });

    const abort = async (): Promise<void> => {
      if (uploadStream) {
        const id = uploadStream.id;
        uploadStream.destroy();
        await bucket.delete(id).catch(() => undefined);
      }
    };

    try {
      for await (const raw of input.source) {
        const chunk: Buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
        size += chunk.length;
        if (size > EVIDENCE_MAX_FILE_BYTES) {
          throw new EvidenceUploadError(
            "FILE_TOO_LARGE",
            "Evidence file exceeds maximum size",
          );
        }
        hash.update(chunk);

        if (!uploadStream) {
          headBuf = Buffer.concat([headBuf, chunk]);
          if (headBuf.length >= SIGNATURE_HEAD_BYTES) {
            detected = detectEvidenceSignature(headBuf);
            if (!detected) {
              throw new EvidenceUploadError(
                "UNREADABLE_SIGNATURE",
                "Evidence content is not a supported file type",
              );
            }
            assertConsistentType(detected, originalFileName, input.claimedMimeType);
            uploadStream = openWith(detected);
            await writeChunk(uploadStream, headBuf);
          }
        } else {
          await writeChunk(uploadStream, chunk);
        }
      }

      // Small file: signature was never triggered mid-stream.
      if (!uploadStream) {
        if (size === 0) {
          throw new EvidenceUploadError("EMPTY_FILE", "Evidence file is empty");
        }
        detected = detectEvidenceSignature(headBuf);
        if (!detected) {
          throw new EvidenceUploadError(
            "UNREADABLE_SIGNATURE",
            "Evidence content is not a supported file type",
          );
        }
        assertConsistentType(detected, originalFileName, input.claimedMimeType);
        uploadStream = openWith(detected);
        await writeChunk(uploadStream, headBuf);
      }

      const contentSha256 = hash.digest("hex");
      const finalStream = uploadStream;
      await new Promise<void>((resolve, reject) => {
        finalStream.on("error", reject);
        finalStream.on("finish", () => resolve());
        finalStream.end();
      });

      // Persist the content hash and final size now that they are known.
      await this.db!.collection(`${FG_EVIDENCE_BUCKET}.files`)
        .updateOne(
          { _id: finalStream.id },
          {
            $set: { "metadata.contentSha256": contentSha256, "metadata.sizeBytes": size },
          },
        )
        .catch(() => undefined);

      return {
        gridFsFileId: finalStream.id.toString(),
        bucketName: FG_EVIDENCE_BUCKET,
        originalFileName,
        storedFileName,
        mimeType: detected!,
        sizeBytes: size,
        contentSha256,
        uploadedAt: new Date(),
        correlationId,
      };
    } catch (err) {
      await abort();
      throw err;
    }
  }

  /**
   * Buffer-based upload used only for offline-captured evidence that arrives as
   * a data URL. Applies the same signature/consistency policy as the streaming
   * path. Not used for live multipart uploads.
   */
  async upload(input: GridFsBufferUploadInput): Promise<GridFsUploadResult> {
    if (!input.buffer?.length) {
      throw new EvidenceUploadError("EMPTY_FILE", "Evidence file is empty");
    }
    if (input.buffer.length > EVIDENCE_MAX_FILE_BYTES) {
      throw new EvidenceUploadError(
        "FILE_TOO_LARGE",
        "Evidence file exceeds maximum size",
      );
    }
    const { Readable } = await import("node:stream");
    return this.uploadStream({
      source: Readable.from(input.buffer),
      originalFileName: input.originalFileName,
      claimedMimeType: input.mimeType,
      uploadedById: input.uploadedById,
      recordId: input.recordId,
      resultId: input.resultId,
      correctiveActionId: input.correctiveActionId,
      evidenceType: input.evidenceType,
      correlationId: input.correlationId,
    });
  }

  async openDownloadStream(gridFsFileId: string) {
    await this.ensureConnected();
    if (!this.bucket) {
      throw new Error("GridFS bucket is not available");
    }
    if (!ObjectId.isValid(gridFsFileId)) {
      throw new EvidenceUploadError(
        "UNREADABLE_SIGNATURE",
        "Invalid evidence identifier",
      );
    }
    return this.bucket.openDownloadStream(new ObjectId(gridFsFileId));
  }

  async findFileMetadata(gridFsFileId: string) {
    await this.ensureConnected();
    if (!this.db || !ObjectId.isValid(gridFsFileId)) {
      return null;
    }
    return this.db.collection(`${FG_EVIDENCE_BUCKET}.files`).findOne({
      _id: new ObjectId(gridFsFileId),
    });
  }

  /** Best-effort binary delete. Returns true when the object was removed. */
  async deleteFile(gridFsFileId: string): Promise<boolean> {
    await this.ensureConnected();
    if (!this.bucket || !ObjectId.isValid(gridFsFileId)) {
      return false;
    }
    try {
      await this.bucket.delete(new ObjectId(gridFsFileId));
      return true;
    } catch {
      return false;
    }
  }

  /** True when the binary object exists in the bucket. */
  async fileExists(gridFsFileId: string): Promise<boolean> {
    const meta = await this.findFileMetadata(gridFsFileId);
    return meta !== null;
  }

  /**
   * Records a safe, non-sensitive reconciliation event (no binary data, no
   * filenames with personal data — only ids and a machine reason). Used by the
   * replacement compensation paths and read by the orphan reconciliation
   * command. Failures here never propagate: reconciliation is advisory.
   */
  async recordReconciliationEvent(event: {
    type: string;
    gridFsFileId?: string;
    attachmentId?: string;
    reason?: string;
  }): Promise<void> {
    try {
      await this.ensureConnected();
      if (!this.db) return;
      await this.db.collection(`${FG_EVIDENCE_BUCKET}_reconciliation`).insertOne({
        type: event.type,
        gridFsFileId: event.gridFsFileId ?? null,
        attachmentId: event.attachmentId ?? null,
        reason: event.reason ?? null,
        resolved: false,
        createdAt: new Date(),
      });
    } catch {
      // Advisory only — never fail the caller because bookkeeping failed.
    }
  }

  /** Reads unresolved reconciliation events (read-only). */
  async listPendingReconciliationEvents(): Promise<
    Array<{ type: string; gridFsFileId: string | null; attachmentId: string | null }>
  > {
    await this.ensureConnected();
    if (!this.db) return [];
    const rows = await this.db
      .collection(`${FG_EVIDENCE_BUCKET}_reconciliation`)
      .find({ resolved: false })
      .toArray();
    return rows.map((row) => ({
      type: typeof row.type === "string" ? row.type : "UNKNOWN",
      gridFsFileId: typeof row.gridFsFileId === "string" ? row.gridFsFileId : null,
      attachmentId: typeof row.attachmentId === "string" ? row.attachmentId : null,
    }));
  }

  async markReconciliationResolved(gridFsFileId: string): Promise<void> {
    await this.ensureConnected();
    if (!this.db) return;
    await this.db
      .collection(`${FG_EVIDENCE_BUCKET}_reconciliation`)
      .updateMany(
        { gridFsFileId, resolved: false },
        { $set: { resolved: true, resolvedAt: new Date() } },
      )
      .catch(() => undefined);
  }

  /** Lists every stored file id (used by the read-only reconciliation command). */
  async listAllFiles(): Promise<OrphanFileRecord[]> {
    await this.ensureConnected();
    if (!this.db) return [];
    const cursor = this.db
      .collection(`${FG_EVIDENCE_BUCKET}.files`)
      .find({}, { projection: { _id: 1, filename: 1, length: 1, uploadDate: 1 } });
    const rows = await cursor.toArray();
    return rows.map((row) => ({
      gridFsFileId: String(row._id),
      storedFileName: typeof row.filename === "string" ? row.filename : "",
      sizeBytes: typeof row.length === "number" ? row.length : 0,
      uploadedAt: row.uploadDate instanceof Date ? row.uploadDate : null,
    }));
  }

  private async ensureConnected(): Promise<void> {
    if (this.bucket) return;
    if (!this.connecting) {
      this.connecting = this.connect();
    }
    await this.connecting;
  }

  private async connect(): Promise<void> {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error("DATABASE_URL is not configured for GridFS");
    }
    if (!/^mongodb(\+srv)?:\/\//i.test(url)) {
      throw new Error("GridFS requires a MongoDB DATABASE_URL");
    }
    const dbName = assertDatabaseName(url);
    if (process.env.NODE_ENV === "production" && dbName !== "fg_online") {
      throw new Error("GridFS production database name mismatch");
    }
    this.client = new MongoClient(url, { maxPoolSize: 5 });
    await this.client.connect();
    this.db = this.client.db(dbName);
    this.bucket = new GridFSBucket(this.db, { bucketName: FG_EVIDENCE_BUCKET });
  }
}
