import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import Busboy from "busboy";
import type { Request, Response } from "express";
import {
  EVIDENCE_MAX_FILES,
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_MAX_TOTAL_BYTES,
  type EvidenceRejectionCode,
} from "@nelna/shared";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  EvidenceUploadError,
  GridFsEvidenceService,
  type GridFsUploadResult,
} from "./gridfs-evidence.service";
import { EvidenceService, type UploadableRecord } from "./evidence.service";

type CreatedAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  gridFsFileId: string | null;
};

/** Maps a policy rejection code to the correct HTTP status for the client. */
function toHttpException(code: EvidenceRejectionCode, message: string): HttpException {
  switch (code) {
    case "FILE_TOO_LARGE":
    case "TOTAL_TOO_LARGE":
      return new PayloadTooLargeException({ code, message });
    case "TOO_MANY_FILES":
    case "EMPTY_FILE":
      return new BadRequestException({ code, message });
    case "DISALLOWED_EXTENSION":
    case "DISALLOWED_MIME":
    case "UNREADABLE_SIGNATURE":
    case "MIME_SPOOFED":
      return new UnsupportedMediaTypeException({ code, message });
    default:
      return new BadRequestException({ code, message });
  }
}

@ApiTags("evidence")
@Controller("evidence")
export class EvidenceController {
  constructor(
    private readonly gridFs: GridFsEvidenceService,
    private readonly evidence: EvidenceService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("upload")
  @RequirePermissions("records:create")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Stream one or more evidence files into GridFS" })
  async upload(
    @Req() req: Request,
    @CurrentUser() user: RequestUser,
    @Query("recordId") recordId: string,
    @Query("resultId") resultId?: string,
    @Query("evidenceType") evidenceType?: string,
  ): Promise<{ attachments: CreatedAttachment[] }> {
    if (!recordId) {
      throw new BadRequestException("recordId is required");
    }
    // Authorize BEFORE consuming the request body.
    const record = await this.evidence.assertRecordUploadable(recordId, user.id);

    const created = await this.parseAndStore(req, {
      user,
      record,
      resultId: resultId || undefined,
      evidenceType: evidenceType || "EVIDENCE",
    });

    return { attachments: created.map(summarize) };
  }

  @Post(":attachmentId/replace")
  @RequirePermissions("records:create")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Failure-safe replacement of an existing evidence file" })
  async replace(
    @Param("attachmentId") attachmentId: string,
    @Req() req: Request,
    @CurrentUser() user: RequestUser,
  ): Promise<CreatedAttachment> {
    // Authorize BEFORE consuming the request body.
    const existing = await this.evidence.assertAttachmentReplaceable(
      attachmentId,
      user.id,
    );

    const uploaded = await this.streamSingle(req, {
      user,
      recordId: existing.recordId,
      resultId: existing.resultId ?? undefined,
      evidenceType: "EVIDENCE",
    });

    const updated = await this.evidence.swapAttachmentBinary(existing, uploaded);
    return summarize(updated);
  }

  @Get(":attachmentId/download")
  @RequirePermissions("records:read")
  @ApiOperation({ summary: "Authorized streaming download of GridFS evidence" })
  async download(
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const attachment = await this.prisma.inspectionAttachment.findUnique({
      where: { id: attachmentId },
      include: { record: { select: { createdById: true, id: true } } },
    });
    if (!attachment?.gridFsFileId) {
      throw new NotFoundException("Evidence not found");
    }

    const canManage =
      user.permissions.includes("records:verify") ||
      user.permissions.includes("records:check") ||
      user.permissions.includes("users:manage");
    const isOwner =
      attachment.uploadedById === user.id || attachment.record.createdById === user.id;
    if (!canManage && !isOwner) {
      throw new ForbiddenException("Not authorized to download this evidence");
    }

    const meta = await this.gridFs.findFileMetadata(attachment.gridFsFileId);
    if (!meta) {
      throw new NotFoundException("Evidence binary missing");
    }

    const stream = await this.gridFs.openDownloadStream(attachment.gridFsFileId);
    res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    if (attachment.sizeBytes > 0) {
      res.setHeader("Content-Length", String(attachment.sizeBytes));
    }
    return new StreamableFile(stream);
  }

  /** Parses a multipart body, streaming each file into GridFS and creating an
   *  attachment per file. Rolls back the whole batch on any failure. */
  private parseAndStore(
    req: Request,
    ctx: {
      user: RequestUser;
      record: UploadableRecord;
      resultId?: string;
      evidenceType: string;
    },
  ): Promise<
    Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      mimeType: string;
      sizeBytes: number;
      gridFsFileId: string | null;
    }>
  > {
    return new Promise((resolve, reject) => {
      let bb: ReturnType<typeof Busboy>;
      try {
        bb = Busboy({
          headers: req.headers,
          limits: {
            files: EVIDENCE_MAX_FILES + 1,
            fileSize: EVIDENCE_MAX_FILE_BYTES,
            parts: EVIDENCE_MAX_FILES + 20,
          },
        });
      } catch {
        reject(new UnsupportedMediaTypeException("Expected a multipart upload"));
        return;
      }

      const created: Array<{
        id: string;
        fileName: string;
        fileUrl: string;
        mimeType: string;
        sizeBytes: number;
        gridFsFileId: string | null;
      }> = [];
      let totalBytes = 0;
      let fileCount = 0;
      let settled = false;
      let chain: Promise<void> = Promise.resolve();

      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        req.unpipe(bb);
        // Compensate any already-created attachments from this batch.
        void this.evidence.rollbackCreated(created).finally(() => reject(err));
      };

      bb.on("file", (_name, fileStream, info) => {
        fileCount += 1;
        if (fileCount > EVIDENCE_MAX_FILES) {
          fileStream.resume();
          fail(
            toHttpException(
              "TOO_MANY_FILES",
              `Attach at most ${EVIDENCE_MAX_FILES} files.`,
            ),
          );
          return;
        }

        let truncated = false;
        fileStream.on("limit", () => {
          truncated = true;
        });

        chain = chain.then(async () => {
          if (settled) {
            fileStream.resume();
            return;
          }
          try {
            const uploaded = await this.gridFs.uploadStream({
              source: fileStream,
              originalFileName: info.filename ?? "evidence.bin",
              claimedMimeType: info.mimeType ?? "",
              uploadedById: ctx.user.id,
              recordId: ctx.record.id,
              resultId: ctx.resultId,
              evidenceType: ctx.evidenceType,
            });
            if (truncated) {
              await this.gridFs.deleteFile(uploaded.gridFsFileId);
              throw toHttpException(
                "FILE_TOO_LARGE",
                "Each file must be within the size limit.",
              );
            }
            totalBytes += uploaded.sizeBytes;
            if (totalBytes > EVIDENCE_MAX_TOTAL_BYTES) {
              await this.gridFs.deleteFile(uploaded.gridFsFileId);
              throw toHttpException(
                "TOTAL_TOO_LARGE",
                "Total upload exceeds the size limit.",
              );
            }
            const attachment = await this.evidence.persistUploadedAttachment(
              ctx.record,
              ctx.resultId,
              uploaded,
              ctx.user.id,
            );
            created.push(attachment as never);
          } catch (err) {
            fail(this.normalizeError(err));
          }
        });
      });

      bb.on("filesLimit", () => {
        fail(
          toHttpException(
            "TOO_MANY_FILES",
            `Attach at most ${EVIDENCE_MAX_FILES} files.`,
          ),
        );
      });
      bb.on("error", (err) => fail(this.normalizeError(err)));
      bb.on("close", () => {
        void chain.then(() => {
          if (settled) return;
          if (created.length === 0) {
            settled = true;
            reject(toHttpException("EMPTY_FILE", "No evidence file was provided."));
            return;
          }
          settled = true;
          resolve(created);
        });
      });

      req.pipe(bb);
    });
  }

  /** Streams exactly one file for the replacement flow. */
  private streamSingle(
    req: Request,
    ctx: {
      user: RequestUser;
      recordId: string;
      resultId?: string;
      evidenceType: string;
    },
  ): Promise<GridFsUploadResult> {
    return new Promise((resolve, reject) => {
      let bb: ReturnType<typeof Busboy>;
      try {
        bb = Busboy({
          headers: req.headers,
          limits: { files: 1, fileSize: EVIDENCE_MAX_FILE_BYTES, parts: 20 },
        });
      } catch {
        reject(new UnsupportedMediaTypeException("Expected a multipart upload"));
        return;
      }

      let settled = false;
      let handled = false;
      let result: GridFsUploadResult | null = null;
      let chain: Promise<void> = Promise.resolve();

      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        req.unpipe(bb);
        reject(err);
      };

      bb.on("file", (_name, fileStream, info) => {
        if (handled) {
          fileStream.resume();
          return;
        }
        handled = true;
        let truncated = false;
        fileStream.on("limit", () => {
          truncated = true;
        });
        chain = chain.then(async () => {
          try {
            const uploaded = await this.gridFs.uploadStream({
              source: fileStream,
              originalFileName: info.filename ?? "evidence.bin",
              claimedMimeType: info.mimeType ?? "",
              uploadedById: ctx.user.id,
              recordId: ctx.recordId,
              resultId: ctx.resultId,
              evidenceType: ctx.evidenceType,
            });
            if (truncated) {
              await this.gridFs.deleteFile(uploaded.gridFsFileId);
              throw toHttpException(
                "FILE_TOO_LARGE",
                "The file must be within the size limit.",
              );
            }
            result = uploaded;
          } catch (err) {
            fail(this.normalizeError(err));
          }
        });
      });

      bb.on("error", (err) => fail(this.normalizeError(err)));
      bb.on("close", () => {
        void chain.then(() => {
          if (settled) return;
          if (!result) {
            settled = true;
            reject(toHttpException("EMPTY_FILE", "No evidence file was provided."));
            return;
          }
          settled = true;
          resolve(result);
        });
      });

      req.pipe(bb);
    });
  }

  /** Converts an internal EvidenceUploadError into the right HTTP error. */
  private normalizeError(err: unknown): unknown {
    if (err instanceof EvidenceUploadError) {
      return toHttpException(err.code, err.message);
    }
    return err;
  }
}

function summarize(attachment: {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  gridFsFileId: string | null;
}): CreatedAttachment {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    gridFsFileId: attachment.gridFsFileId,
  };
}
