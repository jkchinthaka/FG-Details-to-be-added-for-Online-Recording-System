import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional } from "class-validator";

export class SubmitRecordDto {
  @ApiPropertyOptional({
    description:
      "Final ChecklistResponseMap to persist before validating and submitting; omit to submit the already-saved draft as-is",
  })
  @IsOptional()
  @IsObject()
  responses?: Record<string, unknown>;
}
