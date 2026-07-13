import { Injectable } from "@nestjs/common";
import type { VehicleSearchResponse } from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import { VEHICLE_WITH_TRANSPORTER_INCLUDE, toVehicleSummary } from "./vehicles.mappers";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

/**
 * Backs the freezer truck inspection's searchable vehicle selector
 * (`GET /vehicles?q=`). With no query, returns the most recently *inspected*
 * vehicles (a genuinely useful "recent" list, not just recently created) —
 * falling back to the most recently registered vehicles for a fresh
 * database with no inspection history yet.
 */
@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string | undefined, limitInput?: number): Promise<VehicleSearchResponse> {
    const take = clampLimit(limitInput);
    const trimmed = query?.trim();

    if (trimmed) {
      const vehicles = await this.prisma.vehicle.findMany({
        where: {
          OR: [
            { vehicleNumber: { contains: trimmed, mode: "insensitive" } },
            { freezerTruckNumber: { contains: trimmed, mode: "insensitive" } },
            { transporter: { name: { contains: trimmed, mode: "insensitive" } } },
          ],
        },
        include: VEHICLE_WITH_TRANSPORTER_INCLUDE,
        orderBy: { vehicleNumber: "asc" },
        take,
      });
      return { vehicles: vehicles.map(toVehicleSummary), isRecent: false };
    }

    return { vehicles: await this.recentVehicles(take), isRecent: true };
  }

  private async recentVehicles(take: number) {
    const recentInspections = await this.prisma.truckInspectionDetail.findMany({
      where: { vehicleId: { not: null } },
      distinct: ["vehicleId"],
      orderBy: { createdAt: "desc" },
      take,
      include: { vehicle: { include: VEHICLE_WITH_TRANSPORTER_INCLUDE } },
    });

    const fromInspections = recentInspections
      .map((inspection) => inspection.vehicle)
      .filter((vehicle): vehicle is NonNullable<typeof vehicle> => vehicle !== null)
      .map(toVehicleSummary);

    if (fromInspections.length > 0) {
      return fromInspections;
    }

    const fallback = await this.prisma.vehicle.findMany({
      include: VEHICLE_WITH_TRANSPORTER_INCLUDE,
      orderBy: { updatedAt: "desc" },
      take,
    });
    return fallback.map(toVehicleSummary);
  }
}

function clampLimit(limitInput: number | undefined): number {
  if (!limitInput || Number.isNaN(limitInput) || limitInput < 1) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(limitInput), MAX_LIMIT);
}
