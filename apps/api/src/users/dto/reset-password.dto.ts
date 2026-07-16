import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PASSWORD_MIN_LENGTH } from "@nelna/shared";

/**
 * Body is entirely optional: when `temporaryPassword` is omitted the service
 * generates a random one and returns it once in the response (never stored
 * or logged in plaintext).
 */
export class ResetPasswordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(200)
  temporaryPassword?: string;
}
