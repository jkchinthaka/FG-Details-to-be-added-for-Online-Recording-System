import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { GridFsEvidenceService } from "./gridfs-evidence.service";

@ApiTags("evidence")
@Controller("evidence")
export class EvidenceController {
  constructor(
    private readonly gridFs: GridFsEvidenceService,
    private readonly prisma: PrismaService,
  ) {}

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
}
