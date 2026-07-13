import { Module } from "@nestjs/common";
import { InspectionRecordsController } from "./inspection-records.controller";
import { InspectionRecordsService } from "./inspection-records.service";

@Module({
  controllers: [InspectionRecordsController],
  providers: [InspectionRecordsService],
  exports: [InspectionRecordsService],
})
export class InspectionRecordsModule {}
