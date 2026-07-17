import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { ChecklistTemplatesModule } from "./checklist-templates/checklist-templates.module";
import { EvidenceModule } from "./evidence/evidence.module";
import { HealthModule } from "./health/health.module";
import { InspectionRecordsModule } from "./inspection-records/inspection-records.module";
import { MasterDataModule } from "./master-data/master-data.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RecordsModule } from "./records/records.module";
import { TasksModule } from "./tasks/tasks.module";
import { UsersModule } from "./users/users.module";
import { VehiclesModule } from "./vehicles/vehicles.module";
import { ReportsModule } from "./reports/reports.module";
import { CorrectiveActionsModule } from "./corrective-actions/corrective-actions.module";
import { SecurityModule } from "./common/security.module";
import { MetricsModule } from "./metrics/metrics.module";

@Module({
  imports: [
    PrismaModule,
    MetricsModule,
    AuditModule,
    SecurityModule,
    AuthModule,
    HealthModule,
    ChecklistTemplatesModule,
    TasksModule,
    RecordsModule,
    InspectionRecordsModule,
    VehiclesModule,
    ReportsModule,
    UsersModule,
    MasterDataModule,
    EvidenceModule,
    CorrectiveActionsModule,
  ],
})
export class AppModule {}
