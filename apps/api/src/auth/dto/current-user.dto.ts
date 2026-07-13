import { ApiProperty } from "@nestjs/swagger";
import type { CurrentUser, PermissionKey, UserRole } from "@nelna/shared";

/**
 * Swagger-documented response shape for /auth/login and /auth/me.
 * `passwordHash` never appears here or anywhere else in an API response.
 */
export class CurrentUserDto implements CurrentUser {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  employeeCode!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_ACTIVATION"] })
  status!: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_ACTIVATION";

  @ApiProperty({ type: [String] })
  roles!: UserRole[];

  @ApiProperty({ type: [String] })
  permissions!: PermissionKey[];

  @ApiProperty({ nullable: true, type: String })
  lastLoginAt!: string | null;
}
