import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { USER_ROLES, type UserRole } from "@nelna/shared";
import { IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "EMP-1001" })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  employeeCode!: string;

  @ApiProperty({ example: "Nimal Perera" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @ApiPropertyOptional({ example: "nimal.perera@nelna.lk" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: "Initial password (min 8 characters)" })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

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
