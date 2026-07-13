import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ChecklistTemplatesModule } from "./checklist-templates/checklist-templates.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RecordsModule } from "./records/records.module";
import { TasksModule } from "./tasks/tasks.module";

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, ChecklistTemplatesModule, TasksModule, RecordsModule],
})
export class AppModule {}
