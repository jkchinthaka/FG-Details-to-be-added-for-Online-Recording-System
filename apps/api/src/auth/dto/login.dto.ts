import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "operator@example.local" })
  @IsEmail({}, { message: "Enter a valid email address" })
  email!: string;

  @ApiProperty({ example: "••••••••", description: "Account password" })
  @IsString()
  @MinLength(1, { message: "Enter your password" })
  password!: string;
}
