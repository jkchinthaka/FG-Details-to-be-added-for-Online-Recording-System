import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { GridFsEvidenceService } from "./gridfs-evidence.service";
import {
  assertAllowedEvidenceExtension,
  MAX_EVIDENCE_FILES_PER_REQUEST,
  MAX_EVIDENCE_FILE_BYTES,
} from "./evidence-upload.rules";

type UploadedMemoryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@ApiTags("evidence")
@Controller("evidence")
export class EvidenceController {
  constructor(
    private readonly gridFs: GridFsEvidenceService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("upload")
        @RequirePermissions("records:create")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Authenticated streaming multipart evidence upload to GridFS (no base64 JSON)",
  })
  @UseInterceptors(
    FilesInterceptor("files", MAX_EVIDENCE_FILES_PER_REQUEST, {
      limits: {
        fileSize: MAX_EVIDENCE_FILE_BYTES,
        files: MAX_EVIDENCE_FILES_PER_REQUEST,
      },
    }),
  )
  async upload(
    @CurrentUser() user: RequestUser,
    @Query("recordId") recordId: string,
    @Query("resultId") resultId: string | undefined,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_EVIDENCE_FILE_BYTES })],
        fileIsRequired: true,
      }),
    )
    files: UploadedMemoryFile[],
  ) {
    if (!recordId?.trim()) {
      throw new BadRequestException("recordId is required");
    }
    if (!files?.length) {
      throw new BadRequestException("At least one file is required");
    }
    if (files.length > MAX_EVIDENCE_FILES_PER_REQUEST) {
      throw new BadRequestException(
        `At most ${MAX_EVIDENCE_FILES_PER_REQUEST} files may be uploaded at once`,
      );
    }

    const record = await this.prisma.inspectionRecord.findUnique({
      where: { id: recordId },
      select: { id: true, createdById: true, status: true },
    });
    if (!record) {
      throw new NotFoundException("Inspection record not found");
    }

    const canManage =
      user.permissions.includes("records:verify") ||
      user.permissions.includes("records:check") ||
      user.permissions.includes("users:manage");
    if (!canManage && record.createdById !== user.id) {
      throw new ForbiddenException("Not authorized to upload evidence for this record");
    }

    const uploaded: Array<{
      attachmentId: string;
      gridFsFileId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      contentSha256: string;
    }> = [];
    const orphanGridFsIds: string[] = [];

    try {
      for (const file of files) {
        assertAllowedEvidenceExtension(file.originalname);
        const stored = await this.gridFs.upload({
          buffer: file.buffer,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          uploadedById: user.id,
          recordId: record.id,
          resultId: resultId || undefined,
        });
        orphanGridFsIds.push(stored.gridFsFileId);

        const attachment = await this.prisma.inspectionAttachment.create({
          data: {
            recordId: record.id,
            resultId: resultId || null,
            fileUrl: `gridfs://${stored.gridFsFileId}`,
            fileName: stored.originalFileName,
            storedFileName: stored.storedFileName,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            contentSha256: stored.contentSha256,
            gridFsFileId: stored.gridFsFileId,
            gridFsBucket: stored.bucketName,
            uploadCorrelationId: stored.correlationId,
            uploadedById: user.id,
          },
        });
        await this.prisma.inspectionAttachment.update({
          where: { id: attachment.id },
          data: { fileUrl: `/evidence/${attachment.id}/download` },
        });

        orphanGridFsIds.pop();
        uploaded.push({
          attachmentId: attachment.id,
          gridFsFileId: stored.gridFsFileId,
          fileName: stored.originalFileName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          contentSha256: stored.contentSha256,
        });
      }
    } catch (error) {
      for (const id of orphanGridFsIds) {
        await this.gridFs.delete(id).catch(() => undefined);
      }
      throw error;
    }

    return { uploaded };
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

    const downloaded = await this.gridFs.openDownloadStream(attachment.gridFsFileId);
    res.set({
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
    });
    return new StreamableFile(downloaded);
  }
}
