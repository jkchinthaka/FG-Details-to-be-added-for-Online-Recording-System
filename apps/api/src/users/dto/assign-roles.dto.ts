import { ApiProperty } from "@nestjs/swagger";
import { USER_ROLES, type UserRole } from "@nelna/shared";
import { ArrayUnique, IsArray, IsIn } from "class-validator";

/** Replaces the user's entire role set (not additive) — see users.service.ts. */
export class AssignRolesDto {
  @ApiProperty({ enum: USER_ROLES, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsIn(USER_ROLES, { each: true })
  roleNames!: UserRole[];
}
