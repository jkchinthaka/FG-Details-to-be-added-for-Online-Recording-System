import { AdminFleetService } from "./admin-fleet.service";
import { Prisma } from "../../generated/prisma-client";
import {
  DriverLicenseConflictException,
  TransporterConflictException,
  VehicleConflictException,
  VehicleNotFoundException,
} from "./vehicles.errors";
import type { PrismaService } from "../prisma/prisma.service";

function uniqueConstraintError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

function buildPrismaMock() {
  return {
    vehicle: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    driver: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transporter: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    truckInspectionDetail: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function buildService(prismaMock: ReturnType<typeof buildPrismaMock>) {
  return new AdminFleetService(prismaMock as unknown as PrismaService);
}

describe("AdminFleetService", () => {
  describe("createVehicle — duplicate prevention", () => {
    it("maps a duplicate vehicle number unique-constraint violation to a 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.create.mockRejectedValue(
        uniqueConstraintError(["vehicleNumber"]),
      );
      const service = buildService(prismaMock);

      await expect(
        service.createVehicle({ vehicleNumber: "WP CAB-1234" }),
      ).rejects.toBeInstanceOf(VehicleConflictException);
    });

    it("maps a duplicate QR identifier unique-constraint violation to a 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.create.mockRejectedValue(
        uniqueConstraintError(["qrIdentifier"]),
      );
      const service = buildService(prismaMock);

      await expect(
        service.createVehicle({ vehicleNumber: "WP NEW-0001", qrIdentifier: "QR-DUP" }),
      ).rejects.toBeInstanceOf(VehicleConflictException);
    });

    it("creates the vehicle when there is no conflict", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.create.mockResolvedValue({
        id: "vehicle-1",
        vehicleNumber: "WP CAB-1234",
        freezerTruckNumber: null,
        qrIdentifier: null,
        status: "ACTIVE",
        transporterId: null,
        transporter: null,
      });
      const service = buildService(prismaMock);

      const result = await service.createVehicle({ vehicleNumber: "WP CAB-1234" });
      expect(result.vehicleNumber).toBe("WP CAB-1234");
    });
  });

  describe("updateVehicle", () => {
    it("throws VehicleNotFoundException for an unknown id", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.findUnique.mockResolvedValue(null);
      const service = buildService(prismaMock);

      await expect(service.updateVehicle("nope", {})).rejects.toBeInstanceOf(
        VehicleNotFoundException,
      );
      expect(prismaMock.vehicle.update).not.toHaveBeenCalled();
    });
  });

  describe("createDriver — duplicate license warning", () => {
    it("throws DriverLicenseConflictException when the license number already exists", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.driver.findUnique.mockResolvedValue({
        id: "driver-1",
        licenseNumber: "B1234567",
      });
      const service = buildService(prismaMock);

      await expect(
        service.createDriver({ fullName: "Duplicate Driver", licenseNumber: "B1234567" }),
      ).rejects.toBeInstanceOf(DriverLicenseConflictException);
      expect(prismaMock.driver.create).not.toHaveBeenCalled();
    });

    it("creates the driver when the license number is unique", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.driver.findUnique.mockResolvedValue(null);
      prismaMock.driver.create.mockResolvedValue({
        id: "driver-1",
        fullName: "Sunil Perera",
        licenseNumber: "B1234567",
        phone: null,
        isActive: true,
        transporterId: null,
      });
      const service = buildService(prismaMock);

      const result = await service.createDriver({
        fullName: "Sunil Perera",
        licenseNumber: "B1234567",
      });
      expect(result.licenseNumber).toBe("B1234567");
    });
  });

  describe("createTransporter — duplicate prevention", () => {
    it("maps a duplicate name unique-constraint violation to a 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.transporter.create.mockRejectedValue(uniqueConstraintError(["name"]));
      const service = buildService(prismaMock);

      await expect(
        service.createTransporter({ name: "Lanka Cold Logistics" }),
      ).rejects.toBeInstanceOf(TransporterConflictException);
    });
  });

  describe("vehicleInspectionHistory", () => {
    it("returns inspection history without leaking unrelated fields", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.findUnique.mockResolvedValue({ id: "vehicle-1" });
      prismaMock.truckInspectionDetail.findMany.mockResolvedValue([
        {
          id: "insp-1",
          recordId: "record-1",
          driverId: "driver-1",
          transporterId: "transporter-1",
          inspectionTime: "08:00",
          recommendedDecision: "APPROVED_FOR_LOADING",
          loadingDecision: "APPROVED_FOR_LOADING",
          decidedAt: new Date("2026-01-01T00:00:00.000Z"),
          remarks: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      const service = buildService(prismaMock);

      const result = await service.vehicleInspectionHistory("vehicle-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "insp-1",
        loadingDecision: "APPROVED_FOR_LOADING",
      });
    });
  });
});
