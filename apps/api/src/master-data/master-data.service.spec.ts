import { MasterDataService } from "./master-data.service";
import { MasterDataCodeConflictException, MasterDataNotFoundException } from "./master-data.errors";
import { Prisma } from "../../generated/prisma-client";
import type { PrismaService } from "../prisma/prisma.service";

function buildPrismaMock() {
  return {
    department: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    section: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    failureReason: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    temperatureProfile: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    loadingDecisionPolicy: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
}

function buildService(prismaMock: ReturnType<typeof buildPrismaMock>) {
  return new MasterDataService(prismaMock as unknown as PrismaService);
}

describe("MasterDataService", () => {
  describe("createFailureReason", () => {
    it("wraps a unique-constraint violation as a 409 conflict", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.failureReason.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.createFailureReason({ code: "DUP", label: "Duplicate" }),
      ).rejects.toBeInstanceOf(MasterDataCodeConflictException);
    });

    it("creates a failure reason when the code is unique", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.failureReason.create.mockResolvedValue({ id: "fr-1", code: "TEMP", label: "Temperature" });
      const service = buildService(prismaMock);

      const result = await service.createFailureReason({ code: "TEMP", label: "Temperature" });
      expect(result).toMatchObject({ code: "TEMP" });
    });
  });

  describe("setFailureReasonActive — deactivate/archive (no hard delete)", () => {
    it("throws MasterDataNotFoundException for an unknown id", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.failureReason.findUnique.mockResolvedValue(null);
      const service = buildService(prismaMock);

      await expect(service.setFailureReasonActive("nope", false)).rejects.toBeInstanceOf(
        MasterDataNotFoundException,
      );
      expect(prismaMock.failureReason.update).not.toHaveBeenCalled();
    });

    it("flips isActive to false instead of deleting the row", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.failureReason.findUnique.mockResolvedValue({ id: "fr-1", code: "TEMP", isActive: true });
      prismaMock.failureReason.update.mockResolvedValue({ id: "fr-1", code: "TEMP", isActive: false });
      const service = buildService(prismaMock);

      const result = await service.setFailureReasonActive("fr-1", false);

      expect(result.isActive).toBe(false);
      expect(prismaMock.failureReason.update).toHaveBeenCalledWith({
        where: { id: "fr-1" },
        data: { isActive: false },
      });
    });

    it("reactivates an archived row via activate", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.failureReason.findUnique.mockResolvedValue({ id: "fr-1", code: "TEMP", isActive: false });
      prismaMock.failureReason.update.mockResolvedValue({ id: "fr-1", code: "TEMP", isActive: true });
      const service = buildService(prismaMock);

      const result = await service.setFailureReasonActive("fr-1", true);
      expect(result.isActive).toBe(true);
    });
  });

  describe("temperature profiles", () => {
    it("rejects a duplicate code with 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.temperatureProfile.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.createTemperatureProfile({ code: "COLD-01", name: "Cold room", minCelsius: -2, maxCelsius: 4 }),
      ).rejects.toBeInstanceOf(MasterDataCodeConflictException);
    });
  });

  describe("loading decision policies", () => {
    it("stores whatever config an admin posts, unmodified", async () => {
      const prismaMock = buildPrismaMock();
      const config = { blockOnCriticalFailure: true, escalateToRole: "FOOD_SAFETY_TEAM_LEADER" };
      prismaMock.loadingDecisionPolicy.upsert.mockResolvedValue({ key: "default", config, isActive: true });
      const service = buildService(prismaMock);

      const result = await service.upsertLoadingDecisionPolicy("default", { config });

      expect(result.config).toEqual(config);
      expect(prismaMock.loadingDecisionPolicy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: "default" },
          create: expect.objectContaining({ config }),
        }),
      );
    });

    it("throws MasterDataNotFoundException for an unknown policy key", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.loadingDecisionPolicy.findUnique.mockResolvedValue(null);
      const service = buildService(prismaMock);

      await expect(service.getLoadingDecisionPolicy("missing")).rejects.toBeInstanceOf(
        MasterDataNotFoundException,
      );
    });
  });

  describe("listPriorities", () => {
    it("returns the static Priority enum values with labels", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      const result = service.listPriorities();

      expect(result).toEqual(
        expect.arrayContaining([
          { value: "LOW", label: "Low" },
          { value: "MEDIUM", label: "Medium" },
          { value: "HIGH", label: "High" },
          { value: "CRITICAL", label: "Critical" },
        ]),
      );
    });
  });
});
