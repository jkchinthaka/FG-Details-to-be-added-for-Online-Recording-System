import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { USER_ROLES, type UserRole } from "@nelna/shared";
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from "@nelna/shared";

export class CreateUserDto {
  @ApiProperty({ example: "EMP-1001" })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  employeeCode!: string;

  @ApiProperty({ example: "fg.operator01" })
  @IsString()
  @MinLength(USERNAME_MIN_LENGTH)
  @MaxLength(USERNAME_MAX_LENGTH)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      "Username must be 4–40 characters: letters, numbers, dot, underscore or hyphen only",
  })
  username!: string;

  @ApiProperty({ example: "Nimal Perera" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @ApiPropertyOptional({ example: "nimal.perera@nelna.lk" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: `Temporary password (min ${PASSWORD_MIN_LENGTH} characters)` })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(200)
  temporaryPassword!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sectionId?: string;

  @ApiPropertyOptional({ enum: USER_ROLES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(USER_ROLES, { each: true })
  roleNames?: UserRole[];
}
