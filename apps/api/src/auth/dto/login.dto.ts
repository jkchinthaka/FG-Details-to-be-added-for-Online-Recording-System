import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@nelna/shared";

export class LoginDto {
  @ApiProperty({ example: "fg.operator01" })
  @IsString()
  @MinLength(USERNAME_MIN_LENGTH, {
    message: "Enter your username",
  })
  @MaxLength(USERNAME_MAX_LENGTH)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      "Username must be 4–40 characters: letters, numbers, dot, underscore or hyphen only",
  })
  username!: string;

  @ApiProperty({ example: "••••••••", description: "Account password" })
  @IsString()
  @MinLength(1, { message: "Enter your password" })
  password!: string;
}
