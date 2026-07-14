import { Module } from "@nestjs/common";
import { GridFsEvidenceService } from "./gridfs-evidence.service";
import { EvidenceController } from "./evidence.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [GridFsEvidenceService],
  controllers: [EvidenceController],
  exports: [GridFsEvidenceService],
})
export class EvidenceModule {}
