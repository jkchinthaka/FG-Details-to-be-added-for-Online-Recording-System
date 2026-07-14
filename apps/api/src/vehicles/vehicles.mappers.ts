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

export function toTransporterSummary(transporter: {
  id: string;
  name: string;
}): TransporterSummary {
  return { id: transporter.id, name: transporter.name };
}

export function toDriverSummary(driver: {
  id: string;
  fullName: string;
  licenseNumber: string;
  phone: string | null;
}): DriverSummary {
  return {
    id: driver.id,
    fullName: driver.fullName,
    licenseNumber: driver.licenseNumber,
    phone: driver.phone,
  };
}

// ---------------------------------------------------------------------------
// Admin-facing variants — carry a couple of extra fields (`qrIdentifier`,
// `isActive`, `transporterId`) that operator-facing search never needed to
// expose. Kept local to the API rather than added to the shared `*Summary`
// types so the operator vehicle selector's payload shape stays unchanged.
// ---------------------------------------------------------------------------

export type AdminVehicleSummary = VehicleSummary & {
  qrIdentifier: string | null;
  transporterId: string | null;
};

export function toAdminVehicleSummary(
  vehicle: VehicleWithTransporter,
): AdminVehicleSummary {
  return {
    ...toVehicleSummary(vehicle),
    qrIdentifier: vehicle.qrIdentifier,
    transporterId: vehicle.transporterId,
  };
}

export type AdminDriverSummary = DriverSummary & {
  isActive: boolean;
  transporterId: string | null;
};

export function toAdminDriverSummary(driver: {
  id: string;
  fullName: string;
  licenseNumber: string;
  phone: string | null;
  isActive: boolean;
  transporterId: string | null;
}): AdminDriverSummary {
  return {
    ...toDriverSummary(driver),
    isActive: driver.isActive,
    transporterId: driver.transporterId,
  };
}
