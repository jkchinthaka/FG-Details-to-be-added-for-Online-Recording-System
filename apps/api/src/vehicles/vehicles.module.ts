import { Module } from "@nestjs/common";
import { AdminDriversController } from "./admin-drivers.controller";
import { AdminFleetService } from "./admin-fleet.service";
import { AdminTransportersController } from "./admin-transporters.controller";
import { AdminVehiclesController } from "./admin-vehicles.controller";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";

@Module({
  controllers: [
    VehiclesController,
    AdminVehiclesController,
    AdminDriversController,
    AdminTransportersController,
  ],
  providers: [VehiclesService, AdminFleetService],
  exports: [VehiclesService, AdminFleetService],
})
export class VehiclesModule {}
