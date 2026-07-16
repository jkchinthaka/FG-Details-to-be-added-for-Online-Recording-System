import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MinLength } from "class-validator";
import { PASSWORD_MIN_LENGTH } from "@nelna/shared";

export class ChangePasswordDto {
  @ApiProperty({ description: "Current account password" })
  @IsString()
  @MinLength(1, { message: "Enter your current password" })
  currentPassword!: string;

  @ApiProperty({
    description: `New password (minimum ${PASSWORD_MIN_LENGTH} characters, mixed case, number, symbol)`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @Matches(/[A-Z]/, { message: "New password must include an uppercase letter" })
  @Matches(/[a-z]/, { message: "New password must include a lowercase letter" })
  @Matches(/\d/, { message: "New password must include a number" })
  @Matches(/[^A-Za-z0-9]/, { message: "New password must include a symbol" })
  newPassword!: string;
}
