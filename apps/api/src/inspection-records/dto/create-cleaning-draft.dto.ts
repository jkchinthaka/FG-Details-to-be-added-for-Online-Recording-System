import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { WORK_SHIFTS, type WorkShift } from "@nelna/shared";

export class CreateCleaningDraftDto {
  @ApiPropertyOptional({
    example: "2026-07-14",
    description:
      "Calendar date the cleaning verification covers (YYYY-MM-DD). Defaults to today.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "recordDate must be in YYYY-MM-DD format" })
  recordDate?: string;

  @ApiPropertyOptional({
    enum: WORK_SHIFTS,
    description: "Defaults to the current shift based on server time",
  })
  @IsOptional()
  @IsIn(WORK_SHIFTS)
  shiftCode?: WorkShift;

  @ApiPropertyOptional({ default: "Finished Goods + Changing Room" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  areaLabel?: string;

  @ApiPropertyOptional({
    description: "Links the record back to the originating Today's Tasks assignment",
  })
  @IsOptional()
  @IsString()
  taskAssignmentId?: string;
}
