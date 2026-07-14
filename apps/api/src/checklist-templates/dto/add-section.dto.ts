import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class AddSectionDto {
  @ApiProperty({ example: "Finished Goods" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description: "Defaults to appending at the end of the version's sections",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
