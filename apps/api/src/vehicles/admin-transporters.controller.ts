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
import { CreateTransporterDto, UpdateTransporterDto } from "./dto/admin-fleet.dto";

@ApiTags("admin-transporters")
@Controller("admin/transporters")
@RequirePermissions("master_data:manage")
export class AdminTransportersController {
  constructor(private readonly fleetService: AdminFleetService) {}

  @Get()
  @ApiOperation({ summary: "List all transporters for fleet administration" })
  list(@Query("activeOnly") activeOnly?: string) {
    return this.fleetService.listTransporters(activeOnly === "true");
  }

  @Post()
  @ApiOperation({ summary: "Register a new transporter (409 on duplicate name)" })
  create(@Body() dto: CreateTransporterDto) {
    return this.fleetService.createTransporter(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit a transporter's contact details" })
  update(@Param("id") id: string, @Body() dto: UpdateTransporterDto) {
    return this.fleetService.updateTransporter(id, dto);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  activate(@Param("id") id: string) {
    return this.fleetService.setTransporterActive(id, true);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivate(@Param("id") id: string) {
    return this.fleetService.setTransporterActive(id, false);
  }
}
