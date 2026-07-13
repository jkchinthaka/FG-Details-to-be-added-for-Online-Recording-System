import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { VehicleSearchResponse } from "@nelna/shared";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { VehiclesService } from "./vehicles.service";

@ApiTags("vehicles")
@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @RequirePermissions("records:create", "records:read")
  @ApiOperation({
    summary: "Search vehicles for the freezer truck inspection's vehicle selector; omit q for a recent vehicles list",
  })
  search(@Query("q") q?: string, @Query("limit") limit?: string): Promise<VehicleSearchResponse> {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.vehiclesService.search(q, parsedLimit);
  }
}
