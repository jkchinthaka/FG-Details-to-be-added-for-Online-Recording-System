import { VehiclesService } from "./vehicles.service";
import type { PrismaService } from "../prisma/prisma.service";

function makeVehicle(overrides: Record<string, unknown> = {}) {
  return {
    id: "vehicle-1",
    vehicleNumber: "WP CAB-1234",
    freezerTruckNumber: "FT-01",
    status: "ACTIVE",
    transporterId: "transporter-1",
    transporter: { id: "transporter-1", name: "Lanka Cold Logistics" },
    ...overrides,
  };
}

function buildPrismaMock() {
  return {
    vehicle: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    truckInspectionDetail: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function buildService(prismaMock: ReturnType<typeof buildPrismaMock>) {
  return new VehiclesService(prismaMock as unknown as PrismaService);
}

describe("VehiclesService", () => {
  describe("search", () => {
    it("searches by vehicle number, freezer truck number or transporter name when q is provided", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.findMany.mockResolvedValue([makeVehicle()]);
      const service = buildService(prismaMock);

      const result = await service.search("CAB");

      expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { vehicleNumber: { contains: "CAB", mode: "insensitive" } },
            ]),
          }),
        }),
      );
      expect(result.isRecent).toBe(false);
      expect(result.vehicles).toHaveLength(1);
      expect(result.vehicles[0]).toEqual({
        id: "vehicle-1",
        vehicleNumber: "WP CAB-1234",
        freezerTruckNumber: "FT-01",
        status: "ACTIVE",
        transporter: { id: "transporter-1", name: "Lanka Cold Logistics" },
      });
    });

    it("returns recently-inspected vehicles when no query is given", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.truckInspectionDetail.findMany.mockResolvedValue([{ vehicle: makeVehicle() }]);
      const service = buildService(prismaMock);

      const result = await service.search(undefined);

      expect(result.isRecent).toBe(true);
      expect(result.vehicles).toHaveLength(1);
      expect(prismaMock.vehicle.findMany).not.toHaveBeenCalled();
    });

    it("falls back to recently-registered vehicles when there is no inspection history", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.truckInspectionDetail.findMany.mockResolvedValue([]);
      prismaMock.vehicle.findMany.mockResolvedValue([makeVehicle({ id: "vehicle-2" })]);
      const service = buildService(prismaMock);

      const result = await service.search("   ");

      expect(result.isRecent).toBe(true);
      expect(result.vehicles).toHaveLength(1);
      expect(result.vehicles[0]?.id).toBe("vehicle-2");
    });

    it("treats a vehicle with no transporter as transporter: null", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.findMany.mockResolvedValue([makeVehicle({ transporter: null, transporterId: null })]);
      const service = buildService(prismaMock);

      const result = await service.search("WP");
      expect(result.vehicles[0]?.transporter).toBeNull();
    });
  });
});
