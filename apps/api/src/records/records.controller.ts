import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { RecentRecordsResponse } from "@nelna/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { RecordsService } from "./records.service";

@ApiTags("records")
@Controller("records")
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get("recent")
  @ApiOperation({
    summary: "Compact list of the most recent records visible to the current user",
  })
  getRecentRecords(
    @CurrentUser() user: RequestUser,
    @Query("limit") limit?: string,
  ): Promise<RecentRecordsResponse> {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.recordsService.getRecentRecords(user, parsedLimit);
  }
}
