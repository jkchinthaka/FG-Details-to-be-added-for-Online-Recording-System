import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { FINAL_LOADING_DECISIONS, type FinalLoadingDecision } from "@nelna/shared";

export class LoadingDecisionDto {
  @ApiProperty({ enum: FINAL_LOADING_DECISIONS })
  @IsIn(FINAL_LOADING_DECISIONS)
  decision!: FinalLoadingDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}
