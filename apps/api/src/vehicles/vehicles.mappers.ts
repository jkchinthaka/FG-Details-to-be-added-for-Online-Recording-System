import type { DriverSummary, TransporterSummary, VehicleSummary } from "@nelna/shared";
import type { Prisma } from "../../generated/prisma-client";

export const VEHICLE_WITH_TRANSPORTER_INCLUDE = {
  transporter: true,
} satisfies Prisma.VehicleInclude;

export type VehicleWithTransporter = Prisma.VehicleGetPayload<{
  include: typeof VEHICLE_WITH_TRANSPORTER_INCLUDE;
}>;

export function toVehicleSummary(vehicle: VehicleWithTransporter): VehicleSummary {
  return {
    id: vehicle.id,
    vehicleNumber: vehicle.vehicleNumber,
    freezerTruckNumber: vehicle.freezerTruckNumber,
    status: vehicle.status,
    transporter: vehicle.transporter ? toTransporterSummary(vehicle.transporter) : null,
  };
}

export function toTransporterSummary(transporter: { id: string; name: string }): TransporterSummary {
  return { id: transporter.id, name: transporter.name };
}

export function toDriverSummary(driver: {
  id: string;
  fullName: string;
  licenseNumber: string;
  phone: string | null;
}): DriverSummary {
  return { id: driver.id, fullName: driver.fullName, licenseNumber: driver.licenseNumber, phone: driver.phone };
}
