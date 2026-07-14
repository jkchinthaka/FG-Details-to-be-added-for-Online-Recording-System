import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min } from "class-validator";

/** Optional body for `POST :code/versions` — when `fromVersionNumber` is
 *  omitted the service clones from the highest published version instead
 *  (see checklist-templates.service.ts `createDraftVersion`). */
export class CreateDraftVersionDto {
  @ApiPropertyOptional({
    description:
      "Clone sections/items/options from this version instead of the latest published one",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  fromVersionNumber?: number;
}
