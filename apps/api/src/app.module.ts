import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ChecklistTemplatesModule } from "./checklist-templates/checklist-templates.module";
import { HealthModule } from "./health/health.module";
import { InspectionRecordsModule } from "./inspection-records/inspection-records.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RecordsModule } from "./records/records.module";
import { TasksModule } from "./tasks/tasks.module";
import { VehiclesModule } from "./vehicles/vehicles.module";
import { ReportsModule } from "./reports/reports.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    ChecklistTemplatesModule,
    TasksModule,
    RecordsModule,
    InspectionRecordsModule,
    VehiclesModule,
    ReportsModule,
  ],
})
export class AppModule {}
