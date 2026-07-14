import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { AdminFleetService } from "./admin-fleet.service";
import { CreateDriverDto, UpdateDriverDto } from "./dto/admin-fleet.dto";

@ApiTags("admin-drivers")
@Controller("admin/drivers")
@RequirePermissions("master_data:manage")
export class AdminDriversController {
  constructor(private readonly fleetService: AdminFleetService) {}

  @Get()
  @ApiOperation({ summary: "List all drivers for fleet administration" })
  list(@Query("activeOnly") activeOnly?: string) {
    return this.fleetService.listDrivers(activeOnly === "true");
  }

  @Post()
  @ApiOperation({ summary: "Register a new driver (409 warning on duplicate license number)" })
  create(@Body() dto: CreateDriverDto) {
    return this.fleetService.createDriver(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit a driver's name, phone or transporter" })
  update(@Param("id") id: string, @Body() dto: UpdateDriverDto) {
    return this.fleetService.updateDriver(id, dto);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  activate(@Param("id") id: string) {
    return this.fleetService.setDriverActive(id, true);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivate(@Param("id") id: string) {
    return this.fleetService.setDriverActive(id, false);
  }
}
