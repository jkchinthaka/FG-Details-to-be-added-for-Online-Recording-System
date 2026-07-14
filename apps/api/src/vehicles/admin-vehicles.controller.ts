import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { AdminFleetService } from "./admin-fleet.service";
import {
  CreateVehicleDto,
  SetVehicleQrDto,
  UpdateVehicleDto,
} from "./dto/admin-fleet.dto";

@ApiTags("admin-vehicles")
@Controller("admin/vehicles")
@RequirePermissions("master_data:manage")
export class AdminVehiclesController {
  constructor(private readonly fleetService: AdminFleetService) {}

  @Get()
  @ApiOperation({ summary: "List all vehicles for fleet administration" })
  list(@Query("activeOnly") activeOnly?: string) {
    return this.fleetService.listVehicles(activeOnly === "true");
  }

  @Post()
  @ApiOperation({
    summary: "Register a new vehicle (409 on duplicate vehicle/freezer-truck number)",
  })
  create(@Body() dto: CreateVehicleDto) {
    return this.fleetService.createVehicle(dto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update a vehicle's freezer truck number, QR identifier or transporter",
  })
  update(@Param("id") id: string, @Body() dto: UpdateVehicleDto) {
    return this.fleetService.updateVehicle(id, dto);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  activate(@Param("id") id: string) {
    return this.fleetService.setVehicleActive(id, true);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivate(@Param("id") id: string) {
    return this.fleetService.setVehicleActive(id, false);
  }

  @Patch(":id/qr-identifier")
  @ApiOperation({ summary: "Set or change a vehicle's QR code identifier" })
  setQrIdentifier(@Param("id") id: string, @Body() dto: SetVehicleQrDto) {
    return this.fleetService.setVehicleQrIdentifier(id, dto);
  }

  @Get(":id/inspection-history")
  @ApiOperation({ summary: "Recent freezer-truck inspection history for a vehicle" })
  inspectionHistory(@Param("id") id: string, @Query("limit") limit?: string) {
    return this.fleetService.vehicleInspectionHistory(
      id,
      limit ? Number.parseInt(limit, 10) : undefined,
    );
  }
}
