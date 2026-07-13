import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class PublishVersionDto {
  @ApiPropertyOptional({ description: "Optional changelog / publish notes" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
