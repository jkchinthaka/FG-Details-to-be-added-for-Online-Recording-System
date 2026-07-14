import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CHECKLIST_ITEM_TYPES, type ChecklistItemType } from "@nelna/shared";
import { ItemOptionDto } from "./item-option.dto";

export class AddItemDto {
  @ApiProperty({ example: "Cold Room 1" })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  helpText?: string;

  @ApiPropertyOptional({
    description: "Defaults to appending at the end of the section's items",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    enum: CHECKLIST_ITEM_TYPES,
    default: "ACCEPTABLE_UNACCEPTABLE_NA",
  })
  @IsOptional()
  @IsIn(CHECKLIST_ITEM_TYPES)
  itemType?: ChecklistItemType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowNotApplicable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresEvidenceOnFail?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: "A failing response on this item is a critical failure",
  })
  @IsOptional()
  @IsBoolean()
  isCriticalFailure?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  remarkRequiredOnFail?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  correctiveActionRequiredOnFail?: boolean;

  @ApiPropertyOptional({
    description: "Inclusive lower bound for NUMBER/TEMPERATURE items",
  })
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional({
    description: "Inclusive upper bound for NUMBER/TEMPERATURE items",
  })
  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional({ description: "Pre-filled value an operator can still override" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  defaultResponse?: string;

  @ApiPropertyOptional({
    type: [ItemOptionDto],
    description: "Required for SINGLE_SELECT items",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ItemOptionDto)
  options?: ItemOptionDto[];
}
