import { RecordsService } from "./records.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";

function buildPrismaMock() {
  return {
    inspectionRecord: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function buildService(prismaMock: ReturnType<typeof buildPrismaMock>) {
  return new RecordsService(prismaMock as unknown as PrismaService);
}

function buildUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: "user-1",
    employeeCode: "EMP-001",
    fullName: "Test User",
    roles: ["FG_OPERATOR"],
    permissions: [],
    ...overrides,
  };
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    documentCode: "NMS/PPU/CL/24",
    status: "SUBMITTED",
    areaLabel: "Finished Goods",
    submittedAt: new Date("2026-07-14T05:00:00.000Z"),
    updatedAt: new Date("2026-07-14T05:00:00.000Z"),
    ...overrides,
  };
}

describe("RecordsService", () => {
  describe("getRecentRecords", () => {
    it("maps a record row into a summary with a human-readable title", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findMany.mockResolvedValue([makeRecord()]);
      const service = buildService(prismaMock);

      const result = await service.getRecentRecords(buildUser());

      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toMatchObject({
        id: "rec-1",
        title: "Daily Cleaning Verification",
        status: "SUBMITTED",
        submittedAt: "2026-07-14T05:00:00.000Z",
      });
    });

    it("scopes a pure FG Operator to only their own records", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      await service.getRecentRecords(buildUser({ id: "operator-9", roles: ["FG_OPERATOR"] }));

      expect(prismaMock.inspectionRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdById: "operator-9" } }),
      );
    });

    it("does not scope a supervisor to only their own records", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      await service.getRecentRecords(buildUser({ roles: ["FG_SUPERVISOR"] }));

      expect(prismaMock.inspectionRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it("clamps an out-of-range limit to the maximum", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      await service.getRecentRecords(buildUser(), 500);

      expect(prismaMock.inspectionRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
    });

    it("falls back to the default limit for an invalid input", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      await service.getRecentRecords(buildUser(), Number.NaN);

      expect(prismaMock.inspectionRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });

    it("degrades to an empty list instead of throwing when Postgres is unreachable", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findMany.mockRejectedValue(new Error("connect ECONNREFUSED"));
      const service = buildService(prismaMock);

      const result = await service.getRecentRecords(buildUser());

      expect(result).toEqual({ records: [] });
    });
  });
});
