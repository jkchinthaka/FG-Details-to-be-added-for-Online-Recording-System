import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsString } from "class-validator";

/** Body for both section and item reordering endpoints: the full, exact set
 *  of ids for the collection being reordered, in their new display order. */
export class ReorderDto {
  @ApiProperty({ type: [String], description: "All ids in the collection, in the desired display order" })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}
