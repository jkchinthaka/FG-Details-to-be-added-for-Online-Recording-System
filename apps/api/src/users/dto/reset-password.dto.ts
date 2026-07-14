import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Body is entirely optional: when `temporaryPassword` is omitted the service
 * generates a random one and returns it once in the response (never stored
 * or logged in plaintext).
 */
export class ResetPasswordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  temporaryPassword?: string;
}
