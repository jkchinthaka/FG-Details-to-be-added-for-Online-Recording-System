import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Body shape is intentionally loose at the class-validator layer (`responses`
 * is a dynamic item-id -> response map) — full structural validation happens
 * against the shared Zod schema (`saveDraftResponsesSchema`) inside the
 * service, mirroring the checklist-templates module's pattern of DTO-level
 * shape + service-level business-rule validation.
 */
export class SaveDraftDto {
  @ApiProperty({ description: "ChecklistResponseMap — item id -> response", type: Object })
  @IsObject()
  responses!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  areaLabel?: string;
}
