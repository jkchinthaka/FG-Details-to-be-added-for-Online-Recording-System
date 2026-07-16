import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { PASSWORD_MIN_LENGTH } from "@nelna/shared";

export class ChangePasswordDto {
  @ApiProperty({ description: "Current account password" })
  @IsString()
  @MinLength(1, { message: "Enter your current password" })
  currentPassword!: string;

  @ApiProperty({ description: `New password (minimum ${PASSWORD_MIN_LENGTH} characters)` })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  newPassword!: string;
}
