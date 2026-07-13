import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ChecklistTemplatesModule } from "./checklist-templates/checklist-templates.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, ChecklistTemplatesModule],
})
export class AppModule {}
