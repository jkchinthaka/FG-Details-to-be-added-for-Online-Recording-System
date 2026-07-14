import { Module } from "@nestjs/common";
import { EvidenceModule } from "../evidence/evidence.module";
import { InspectionRecordsController } from "./inspection-records.controller";
import { InspectionRecordsService } from "./inspection-records.service";

@Module({
  imports: [EvidenceModule],
  controllers: [InspectionRecordsController],
  providers: [InspectionRecordsService],
  exports: [InspectionRecordsService],
})
export class InspectionRecordsModule {}
