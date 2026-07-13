import { PartialType } from "@nestjs/swagger";
import { AddItemDto } from "./add-item.dto";

/** Every field is optional — only the supplied fields are patched. */
export class UpdateItemDto extends PartialType(AddItemDto) {}
