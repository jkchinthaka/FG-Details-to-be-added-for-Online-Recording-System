import { Module } from "@nestjs/common";
import { GridFsEvidenceService } from "./gridfs-evidence.service";
import { EvidenceService } from "./evidence.service";
import { EvidenceController } from "./evidence.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [GridFsEvidenceService, EvidenceService],
  controllers: [EvidenceController],
  exports: [GridFsEvidenceService, EvidenceService],
})
export class EvidenceModule {}
