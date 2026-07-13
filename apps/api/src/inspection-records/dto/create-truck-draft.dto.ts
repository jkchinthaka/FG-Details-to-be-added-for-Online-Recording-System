import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { WORK_SHIFTS, type WorkShift } from "@nelna/shared";

export class CreateTruckDraftDto {
  @ApiPropertyOptional({
    example: "2026-07-14",
    description: "Calendar date the inspection covers (YYYY-MM-DD). Defaults to today.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "recordDate must be in YYYY-MM-DD format" })
  recordDate?: string;

  @ApiPropertyOptional({ enum: WORK_SHIFTS, description: "Defaults to the current shift based on server time" })
  @IsOptional()
  @IsIn(WORK_SHIFTS)
  shiftCode?: WorkShift;

  @ApiPropertyOptional({ default: "Dispatch / Loading Bay" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  areaLabel?: string;

  @ApiPropertyOptional({ description: "Selected vehicle id from the searchable vehicle picker" })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ description: "Manual fallback — requires the vehicles:manual_entry permission" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  freezerTruckNumber?: string;

  @ApiPropertyOptional({ description: "Manual fallback — requires the vehicles:manual_entry permission" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transporterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  loadingReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  productCategory?: string;

  @ApiPropertyOptional({ description: "Links the record back to the originating Today's Tasks assignment" })
  @IsOptional()
  @IsString()
  taskAssignmentId?: string;

  @ApiPropertyOptional({ description: "Prior blocked/rejected inspection of the same truck being re-inspected" })
  @IsOptional()
  @IsString()
  reinspectionOfRecordId?: string;
}
