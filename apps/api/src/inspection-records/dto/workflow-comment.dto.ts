import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Shared body for return / reject / void / optional check-verify notes. */
export class WorkflowCommentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  comment?: string;
}
