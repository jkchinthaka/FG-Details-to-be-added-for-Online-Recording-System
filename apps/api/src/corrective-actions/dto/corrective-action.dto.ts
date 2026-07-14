import { IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AssignCorrectiveActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  assigneeId!: string;

  @ApiPropertyOptional({ description: "YYYY-MM-DD" })
  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class CommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  comment!: string;
}

export class RejectCorrectiveActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  rejectionReason!: string;
}

export class CancelCorrectiveActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  cancelReason!: string;
}

export class CompleteCorrectiveActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  completionComment!: string;
}

export class VerifyCorrectiveActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  verificationComment!: string;
}
