import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class AssignDepartmentDto {
  @ApiPropertyOptional({ description: "Department id, or null to clear" })
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiPropertyOptional({ description: "Section id, or null to clear" })
  @IsOptional()
  @IsString()
  sectionId?: string | null;
}
