import { createHash, randomUUID } from "node:crypto";
import { Injectable, OnModuleDestroy, UnauthorizedException } from "@nestjs/common";
import { GridFSBucket, MongoClient, ObjectId, type Db } from "mongodb";

export const FG_EVIDENCE_BUCKET = "fgEvidence";

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export type GridFsUploadInput = {
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
  mimeType: string;
  sizeBytes: number;
  contentSha256: string;
  uploadedAt: Date;
  correlationId: string;
};

function assertDatabaseName(url: string): string {
  const path = (url.split("?")[0] ?? "").split("/").pop() ?? "";
  if (!path) {
    throw new Error("DATABASE_URL must include an explicit database name");
  }
  return path;
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "evidence.bin";
  return base.slice(0, 180);
}

function detectMimeFromMagic(buffer: Buffer, claimed: string): string {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 3) === "GIF") {
    return "image/gif";
  }
  return claimed;
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

  async upload(input: GridFsUploadInput): Promise<GridFsUploadResult> {
    await this.ensureConnected();
    if (!this.bucket) {
      throw new Error("GridFS bucket is not available");
    }

    if (!input.buffer?.length) {
      throw new UnauthorizedException("Empty evidence file");
    }
    if (input.buffer.length > MAX_EVIDENCE_BYTES) {
      throw new UnauthorizedException("Evidence file exceeds maximum size");
    }

    const mimeType = detectMimeFromMagic(input.buffer, input.mimeType);
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new UnauthorizedException("Evidence MIME type is not allowed");
    }

    const originalFileName = sanitizeFileName(input.originalFileName);
    const correlationId = input.correlationId?.trim() || randomUUID();
    const contentSha256 = createHash("sha256").update(input.buffer).digest("hex");
    const storedFileName = `${Date.now()}-${correlationId.slice(0, 8)}-${originalFileName}`;

    const uploadStream = this.bucket.openUploadStream(storedFileName, {
      metadata: {
        originalFileName,
        mimeType,
        contentType: mimeType,
        sizeBytes: input.buffer.length,
        contentSha256,
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

    await new Promise<void>((resolve, reject) => {
      uploadStream.on("error", reject);
      uploadStream.on("finish", () => resolve());
      uploadStream.end(input.buffer);
    });

    return {
      gridFsFileId: uploadStream.id.toString(),
      bucketName: FG_EVIDENCE_BUCKET,
      originalFileName,
      storedFileName,
      mimeType,
      sizeBytes: input.buffer.length,
      contentSha256,
      uploadedAt: new Date(),
      correlationId,
    };
  }

  async openDownloadStream(gridFsFileId: string) {
    await this.ensureConnected();
    if (!this.bucket) {
      throw new Error("GridFS bucket is not available");
    }
    if (!ObjectId.isValid(gridFsFileId)) {
      throw new UnauthorizedException("Invalid evidence identifier");
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
