import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export class CreateDepartmentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) code!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export class CreateSectionDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) code!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @ApiProperty() @IsString() departmentId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class UpdateSectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export class CreateShiftDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) code!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @ApiProperty({ example: "06:00" }) @IsString() startTime!: string;
  @ApiProperty({ example: "14:00" }) @IsString() endTime!: string;
}

export class UpdateShiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endTime?: string;
}

// ---------------------------------------------------------------------------
// Failure reasons
// ---------------------------------------------------------------------------

export class CreateFailureReasonDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) code!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) label!: string;
}

export class UpdateFailureReasonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label?: string;
}

// ---------------------------------------------------------------------------
// Corrective action categories
// ---------------------------------------------------------------------------

export class CreateCorrectiveActionCategoryDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) code!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class UpdateCorrectiveActionCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

// ---------------------------------------------------------------------------
// Temperature profiles
// ---------------------------------------------------------------------------

export class CreateTemperatureProfileDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) code!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @ApiProperty() @IsNumber() minCelsius!: number;
  @ApiProperty() @IsNumber() maxCelsius!: number;
}

export class UpdateTemperatureProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minCelsius?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxCelsius?: number;
}

// ---------------------------------------------------------------------------
// Loading decision policies
// ---------------------------------------------------------------------------

/**
 * `config` is deliberately an opaque JSON blob — the API stores/returns
 * whatever an admin posts and never invents Nelna's actual approved loading
 * policy content (see docs/requirements/OPEN_BUSINESS_DECISIONS.md).
 */
export class UpsertLoadingDecisionPolicyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiProperty({ type: Object }) @IsObject() config!: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
