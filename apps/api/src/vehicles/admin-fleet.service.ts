import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "../../generated/prisma-client";
import type {
  CreateDriverDto,
  CreateTransporterDto,
  CreateVehicleDto,
  SetVehicleQrDto,
  UpdateDriverDto,
  UpdateTransporterDto,
  UpdateVehicleDto,
} from "./dto/admin-fleet.dto";
import {
  DriverLicenseConflictException,
  DriverNotFoundException,
  PRISMA_UNIQUE_CONSTRAINT_CODE,
  TransporterConflictException,
  TransporterNotFoundException,
  VehicleConflictException,
  VehicleNotFoundException,
} from "./vehicles.errors";
import {
  VEHICLE_WITH_TRANSPORTER_INCLUDE,
  toAdminDriverSummary,
  toAdminVehicleSummary,
} from "./vehicles.mappers";

const DEFAULT_HISTORY_LIMIT = 25;

@Injectable()
export class AdminFleetService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Vehicles
  // -------------------------------------------------------------------------

  async listVehicles(activeOnly?: boolean) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: activeOnly ? { status: "ACTIVE" } : undefined,
      include: VEHICLE_WITH_TRANSPORTER_INCLUDE,
      orderBy: { vehicleNumber: "asc" },
    });
    return vehicles.map(toAdminVehicleSummary);
  }

  async createVehicle(dto: CreateVehicleDto) {
    try {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          vehicleNumber: dto.vehicleNumber,
          freezerTruckNumber: dto.freezerTruckNumber,
          qrIdentifier: dto.qrIdentifier,
          transporterId: dto.transporterId,
        },
        include: VEHICLE_WITH_TRANSPORTER_INCLUDE,
      });
      return toAdminVehicleSummary(vehicle);
    } catch (error) {
      throw this.mapVehicleConflict(error, dto.vehicleNumber);
    }
  }

  async updateVehicle(id: string, dto: UpdateVehicleDto) {
    await this.findVehicleOrThrow(id);
    try {
      const vehicle = await this.prisma.vehicle.update({
        where: { id },
        data: {
          freezerTruckNumber: dto.freezerTruckNumber,
          qrIdentifier: dto.qrIdentifier,
          transporterId: dto.transporterId,
        },
        include: VEHICLE_WITH_TRANSPORTER_INCLUDE,
      });
      return toAdminVehicleSummary(vehicle);
    } catch (error) {
      throw this.mapVehicleConflict(
        error,
        dto.freezerTruckNumber ?? dto.qrIdentifier ?? id,
      );
    }
  }

  async setVehicleActive(id: string, isActive: boolean) {
    await this.findVehicleOrThrow(id);
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: { status: isActive ? "ACTIVE" : "INACTIVE" },
      include: VEHICLE_WITH_TRANSPORTER_INCLUDE,
    });
    return toAdminVehicleSummary(vehicle);
  }

  async setVehicleQrIdentifier(id: string, dto: SetVehicleQrDto) {
    await this.findVehicleOrThrow(id);
    try {
      const vehicle = await this.prisma.vehicle.update({
        where: { id },
        data: { qrIdentifier: dto.qrIdentifier },
        include: VEHICLE_WITH_TRANSPORTER_INCLUDE,
      });
      return toAdminVehicleSummary(vehicle);
    } catch (error) {
      throw this.mapVehicleConflict(error, dto.qrIdentifier);
    }
  }

  async vehicleInspectionHistory(id: string, limit = DEFAULT_HISTORY_LIMIT) {
    await this.findVehicleOrThrow(id);
    const inspections = await this.prisma.truckInspectionDetail.findMany({
      where: { vehicleId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        recordId: true,
        driverId: true,
        transporterId: true,
        inspectionTime: true,
        recommendedDecision: true,
        loadingDecision: true,
        decidedAt: true,
        remarks: true,
        createdAt: true,
      },
    });
    return inspections.map((inspection) => ({
      id: inspection.id,
      recordId: inspection.recordId,
      driverId: inspection.driverId,
      transporterId: inspection.transporterId,
      inspectionTime: inspection.inspectionTime,
      recommendedDecision: inspection.recommendedDecision,
      loadingDecision: inspection.loadingDecision,
      decidedAt: inspection.decidedAt ? inspection.decidedAt.toISOString() : null,
      remarks: inspection.remarks,
      createdAt: inspection.createdAt.toISOString(),
    }));
  }

  // -------------------------------------------------------------------------
  // Drivers
  // -------------------------------------------------------------------------

  async listDrivers(activeOnly?: boolean) {
    const drivers = await this.prisma.driver.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { fullName: "asc" },
    });
    return drivers.map(toAdminDriverSummary);
  }

  /** Warns (409) rather than silently merging when a license number already
   *  exists — see DEF-008 / ADM-04 UAT case. */
  async createDriver(dto: CreateDriverDto) {
    const existing = await this.prisma.driver.findUnique({
      where: { licenseNumber: dto.licenseNumber },
    });
    if (existing) throw new DriverLicenseConflictException(dto.licenseNumber);

    const driver = await this.prisma.driver.create({
      data: {
        fullName: dto.fullName,
        licenseNumber: dto.licenseNumber,
        phone: dto.phone,
        transporterId: dto.transporterId,
      },
    });
    return toAdminDriverSummary(driver);
  }

  async updateDriver(id: string, dto: UpdateDriverDto) {
    await this.findDriverOrThrow(id);
    const driver = await this.prisma.driver.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        transporterId: dto.transporterId,
      },
    });
    return toAdminDriverSummary(driver);
  }

  async setDriverActive(id: string, isActive: boolean) {
    await this.findDriverOrThrow(id);
    const driver = await this.prisma.driver.update({ where: { id }, data: { isActive } });
    return toAdminDriverSummary(driver);
  }

  // -------------------------------------------------------------------------
  // Transporters
  // -------------------------------------------------------------------------

  async listTransporters(activeOnly?: boolean) {
    return this.prisma.transporter.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  async createTransporter(dto: CreateTransporterDto) {
    try {
      return await this.prisma.transporter.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_CODE
      ) {
        throw new TransporterConflictException(dto.name);
      }
      throw error;
    }
  }

  async updateTransporter(id: string, dto: UpdateTransporterDto) {
    await this.findTransporterOrThrow(id);
    return this.prisma.transporter.update({ where: { id }, data: dto });
  }

  async setTransporterActive(id: string, isActive: boolean) {
    await this.findTransporterOrThrow(id);
    return this.prisma.transporter.update({ where: { id }, data: { isActive } });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async findVehicleOrThrow(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new VehicleNotFoundException(id);
    return vehicle;
  }

  private async findDriverOrThrow(id: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new DriverNotFoundException(id);
    return driver;
  }

  private async findTransporterOrThrow(id: string) {
    const transporter = await this.prisma.transporter.findUnique({ where: { id } });
    if (!transporter) throw new TransporterNotFoundException(id);
    return transporter;
  }

  private mapVehicleConflict(error: unknown, fallbackValue: string): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PRISMA_UNIQUE_CONSTRAINT_CODE
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(",")
        : "field";
      return new VehicleConflictException(target, fallbackValue);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
