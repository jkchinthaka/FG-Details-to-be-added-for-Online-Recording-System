import { TasksService } from "./tasks.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";

function buildPrismaMock() {
  return {
    taskAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    inspectionRecord: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    correctiveAction: { count: jest.fn().mockResolvedValue(0) },
  };
}

function buildService(prismaMock: ReturnType<typeof buildPrismaMock>) {
  return new TasksService(prismaMock as unknown as PrismaService);
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

describe("TasksService", () => {
  describe("FG Operator — own assignments", () => {
    it("maps a today's task assignment into a startable task card", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.taskAssignment.findMany.mockResolvedValue([
        {
          id: "assign-1",
          templateCode: "NMS/PPU/CL/24",
          areaLabel: "Finished Goods + Changing Room",
          status: "ASSIGNED",
          recordId: null,
          shift: { name: "Morning" },
        },
      ]);
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(buildUser());

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]).toMatchObject({
        title: "Daily Cleaning Verification",
        recordType: "DAILY_CLEANING_VERIFICATION",
        status: "ASSIGNED",
        bucket: "pending",
        action: "START",
        href: "/records/cleaning?assignmentId=assign-1",
      });
      expect(result.summary).toEqual({
        completed: 0,
        pending: 1,
        attentionRequired: 0,
        totalCount: 1,
        completionPercent: 0,
      });
    });

    it("links straight to the in-progress record once the assignment has one", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.taskAssignment.findMany.mockResolvedValue([
        {
          id: "assign-3",
          templateCode: "NMS/PPU/CL/24",
          areaLabel: "Finished Goods + Changing Room",
          status: "IN_PROGRESS",
          recordId: "rec-99",
          shift: { name: "Morning" },
        },
      ]);
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(buildUser());

      expect(result.tasks[0]).toMatchObject({ href: "/records/cleaning/rec-99" });
    });

    it("buckets a rejected assignment as attention-required with a Continue action", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.taskAssignment.findMany.mockResolvedValue([
        {
          id: "assign-2",
          templateCode: "NMS/PPU/CL/30",
          areaLabel: "Dispatch bay",
          status: "REJECTED",
          recordId: null,
          shift: null,
        },
      ]);
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(buildUser());

      expect(result.tasks[0]).toMatchObject({
        bucket: "attention",
        action: "CONTINUE",
        href: "/records/freezer-truck?assignmentId=assign-2",
      });
      expect(result.summary.attentionRequired).toBe(1);
    });

    it("passes the assignedToId and dueDate through to the query", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      await service.getTodaysTasks(buildUser({ id: "user-42" }), "2026-07-14");

      expect(prismaMock.taskAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assignedToId: "user-42",
            dueDate: new Date("2026-07-14T00:00:00.000Z"),
          },
        }),
      );
    });

    it("does not query assignments for a role with no operator/supervisor access", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      await service.getTodaysTasks(buildUser({ roles: ["QA_EXECUTIVE"] }));

      expect(prismaMock.taskAssignment.findMany).not.toHaveBeenCalled();
    });
  });

  describe("degrading gracefully when Postgres is unreachable", () => {
    it("never throws, and returns an empty (zeroed) dashboard when every query rejects", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.taskAssignment.findMany.mockRejectedValue(
        new Error("connect ECONNREFUSED"),
      );
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(buildUser());

      expect(result.tasks).toEqual([]);
      expect(result.summary).toEqual({
        completed: 0,
        pending: 0,
        attentionRequired: 0,
        totalCount: 0,
        completionPercent: 0,
      });
    });

    it("still returns the widgets from roles whose queries succeeded when another role's query fails", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.taskAssignment.findMany.mockRejectedValue(
        new Error("connect ECONNREFUSED"),
      );
      prismaMock.inspectionRecord.findMany.mockResolvedValue([
        { id: "rec-1", documentCode: "NMS/PPU/CL/24", areaLabel: "Finished Goods" },
      ]);
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(
        buildUser({ roles: ["FG_SUPERVISOR"] }),
      );

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]?.bucket).toBe("pending");
    });
  });

  describe("FG Supervisor — pending checks queue", () => {
    it("maps a submitted record awaiting check into a review card", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findMany.mockResolvedValue([
        { id: "rec-1", documentCode: "NMS/PPU/CL/30", areaLabel: "Dispatch bay" },
      ]);
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(
        buildUser({ roles: ["FG_SUPERVISOR"] }),
      );

      expect(result.tasks[0]).toMatchObject({
        title: "Inspection of Freezer Truck Before Loading",
        action: "REVIEW",
        bucket: "pending",
        href: "/records",
      });
    });
  });

  describe("QA Executive — pending verifications and quality exceptions", () => {
    it("surfaces both a pending verification and a quality exception card", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findMany
        .mockResolvedValueOnce([
          { id: "rec-checked", documentCode: "NMS/PPU/CL/24", areaLabel: "FG" },
        ])
        .mockResolvedValueOnce([
          { id: "rec-rejected", documentCode: "NMS/PPU/CL/30", areaLabel: "Dispatch" },
        ]);
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(buildUser({ roles: ["QA_EXECUTIVE"] }));

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.find((t) => t.id === "record-rec-checked")).toMatchObject({
        bucket: "pending",
      });
      expect(result.tasks.find((t) => t.id === "record-rec-rejected")).toMatchObject({
        bucket: "attention",
        href: "/corrective-actions",
      });
      expect(result.summary.attentionRequired).toBe(1);
    });
  });

  describe("Food Safety Team Leader — compliance indicators", () => {
    it("returns compact indicators without querying anything task-card related", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
      prismaMock.correctiveAction.count.mockResolvedValue(3);
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(
        buildUser({ roles: ["FOOD_SAFETY_TEAM_LEADER"] }),
      );

      expect(result.complianceIndicators).toEqual([
        {
          id: "verified-today",
          label: "Verified today",
          value: "2/4",
          tone: "information",
        },
        {
          id: "open-corrective-actions",
          label: "Open corrective actions",
          value: "3",
          tone: "warning",
        },
      ]);
    });
  });

  describe("System Administrator — shortcuts", () => {
    it("returns static admin shortcuts and no task cards", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(
        buildUser({ roles: ["SYSTEM_ADMINISTRATOR"] }),
      );

      expect(result.tasks).toEqual([]);
      expect(result.adminShortcuts.length).toBeGreaterThan(0);
      expect(result.adminShortcuts.map((s) => s.href)).toContain(
        "/admin/templates/preview",
      );
    });
  });

  describe("multi-role users", () => {
    it("unions widgets for every role the user holds", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.taskAssignment.findMany.mockResolvedValue([
        {
          id: "assign-1",
          templateCode: "NMS/PPU/CL/24",
          areaLabel: "FG",
          status: "ASSIGNED",
          recordId: null,
          shift: null,
        },
      ]);
      const service = buildService(prismaMock);

      const result = await service.getTodaysTasks(
        buildUser({ roles: ["FG_OPERATOR", "SYSTEM_ADMINISTRATOR"] }),
      );

      expect(result.tasks).toHaveLength(1);
      expect(result.adminShortcuts.length).toBeGreaterThan(0);
    });
  });
});
