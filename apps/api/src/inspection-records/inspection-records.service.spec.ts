import { InspectionRecordsService } from "./inspection-records.service";
import {
  DuplicateRecordException,
  RecordLockedException,
  RecordNotFoundException,
  RecordValidationException,
} from "./inspection-records.errors";
import type { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";

function buildUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: "user-operator-1",
    employeeCode: "EMP-001",
    fullName: "Test Operator",
    roles: ["FG_OPERATOR"],
    permissions: ["records:create", "records:read"],
    ...overrides,
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-wall",
    sectionId: "section-fg",
    label: "Wall",
    helpText: null,
    sortOrder: 0,
    itemType: "ACCEPTABLE_UNACCEPTABLE_NA",
    isRequired: true,
    allowNotApplicable: false,
    requiresEvidenceOnFail: false,
    isCriticalFailure: false,
    remarkRequiredOnFail: true,
    correctiveActionRequiredOnFail: true,
    minValue: null,
    maxValue: null,
    defaultResponse: null,
    options: [],
    ...overrides,
  };
}

function makeSection(overrides: Record<string, unknown> = {}) {
  return {
    id: "section-fg",
    templateVersionId: "version-1",
    name: "Finished Goods",
    sortOrder: 0,
    items: [makeItem()],
    ...overrides,
  };
}

function makeTemplateVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-1",
    templateId: "template-1",
    versionNumber: 1,
    status: "PUBLISHED",
    notes: null,
    publishedAt: new Date("2026-01-01"),
    publishedById: null,
    sections: [makeSection()],
    template: { id: "template-1", code: "NMS/PPU/CL/24", title: "Daily Cleaning Verification", description: null },
    ...overrides,
  };
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "record-1",
    templateVersionId: "version-1",
    documentCode: "NMS/PPU/CL/24",
    status: "DRAFT",
    recordDate: new Date("2026-07-14T00:00:00.000Z"),
    shiftId: "shift-morning",
    shift: { id: "shift-morning", name: "Morning", code: "MORNING" },
    sectionId: null,
    section: null,
    areaLabel: "Finished Goods + Changing Room",
    createdById: "user-operator-1",
    createdBy: { id: "user-operator-1", fullName: "Test Operator", employeeCode: "EMP-001" },
    checkedById: null,
    verifiedById: null,
    submittedAt: null,
    checkedAt: null,
    verifiedAt: null,
    createdAt: new Date("2026-07-14T01:00:00.000Z"),
    updatedAt: new Date("2026-07-14T01:00:00.000Z"),
    ...overrides,
  };
}

function buildPrismaMock() {
  return {
    shift: {
      findUnique: jest.fn().mockResolvedValue({ id: "shift-morning", name: "Morning", code: "MORNING" }),
    },
    checklistTemplate: {
      findUnique: jest.fn().mockResolvedValue({ id: "template-1", code: "NMS/PPU/CL/24", currentVersionId: "version-1" }),
    },
    checklistTemplateVersion: {
      findUnique: jest.fn().mockResolvedValue(makeTemplateVersion()),
      findUniqueOrThrow: jest.fn().mockResolvedValue(makeTemplateVersion()),
    },
    inspectionRecord: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    inspectionResult: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    inspectionAttachment: {
      deleteMany: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    },
    correctiveAction: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    },
    taskAssignment: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue(undefined),
    },
  };
}

function buildService(prismaMock: ReturnType<typeof buildPrismaMock>) {
  return new InspectionRecordsService(prismaMock as unknown as PrismaService);
}

describe("InspectionRecordsService", () => {
  describe("createCleaningDraft", () => {
    it("creates a brand new record when no active record exists for the date/shift/area", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.create.mockResolvedValue(makeRecord());
      const service = buildService(prismaMock);

      const result = await service.createCleaningDraft(buildUser(), { recordDate: "2026-07-14" });

      expect(prismaMock.inspectionRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentCode: "NMS/PPU/CL/24",
            status: "DRAFT",
            createdById: "user-operator-1",
          }),
        }),
      );
      expect(result.header.documentCode).toBe("NMS/PPU/CL/24");
      expect(result.header.status).toBe("DRAFT");
      expect(result.editable).toBe(true);
    });

    it("resumes the requester's own existing draft instead of creating a duplicate", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findFirst.mockResolvedValue(
        makeRecord({ id: "record-existing", status: "DRAFT" }),
      );
      prismaMock.inspectionRecord.findUniqueOrThrow.mockResolvedValue(
        makeRecord({ id: "record-existing", status: "DRAFT" }),
      );
      const service = buildService(prismaMock);

      const result = await service.createCleaningDraft(buildUser(), { recordDate: "2026-07-14" });

      expect(prismaMock.inspectionRecord.create).not.toHaveBeenCalled();
      expect(result.header.id).toBe("record-existing");
    });

    it("throws DuplicateRecordException when the record for this date/shift/area is already submitted", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findFirst.mockResolvedValue(
        makeRecord({ id: "record-existing", status: "SUBMITTED" }),
      );
      const service = buildService(prismaMock);

      await expect(service.createCleaningDraft(buildUser(), { recordDate: "2026-07-14" })).rejects.toBeInstanceOf(
        DuplicateRecordException,
      );
      expect(prismaMock.inspectionRecord.create).not.toHaveBeenCalled();
    });

    it("throws DuplicateRecordException when another operator already owns the active draft", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findFirst.mockResolvedValue(
        makeRecord({ id: "record-existing", status: "DRAFT", createdById: "someone-else" }),
      );
      const service = buildService(prismaMock);

      await expect(service.createCleaningDraft(buildUser(), { recordDate: "2026-07-14" })).rejects.toBeInstanceOf(
        DuplicateRecordException,
      );
    });

    it("links the record back to the originating TaskAssignment when taskAssignmentId is provided and owned by the user", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.create.mockResolvedValue(makeRecord());
      prismaMock.taskAssignment.findUnique.mockResolvedValue({
        id: "assign-1",
        assignedToId: "user-operator-1",
        status: "ASSIGNED",
      });
      const service = buildService(prismaMock);

      await service.createCleaningDraft(buildUser(), { recordDate: "2026-07-14", taskAssignmentId: "assign-1" });

      expect(prismaMock.taskAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "assign-1" },
          data: expect.objectContaining({ recordId: "record-1", status: "IN_PROGRESS" }),
        }),
      );
    });

    it("ignores a taskAssignmentId that belongs to a different user instead of failing draft creation", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.create.mockResolvedValue(makeRecord());
      prismaMock.taskAssignment.findUnique.mockResolvedValue({
        id: "assign-1",
        assignedToId: "someone-else",
        status: "ASSIGNED",
      });
      const service = buildService(prismaMock);

      await expect(
        service.createCleaningDraft(buildUser(), { recordDate: "2026-07-14", taskAssignmentId: "assign-1" }),
      ).resolves.toBeDefined();
      expect(prismaMock.taskAssignment.update).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("returns the record detail for its owner", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord());
      const service = buildService(prismaMock);

      const result = await service.getById(buildUser(), "record-1");
      expect(result.header.id).toBe("record-1");
    });

    it("hides another operator's record from a pure FG_OPERATOR (404, not 403)", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord({ createdById: "someone-else" }));
      const service = buildService(prismaMock);

      await expect(service.getById(buildUser(), "record-1")).rejects.toBeInstanceOf(RecordNotFoundException);
    });

    it("lets a supervisor view another operator's record", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord({ createdById: "someone-else" }));
      const service = buildService(prismaMock);

      const result = await service.getById(buildUser({ id: "sup-1", roles: ["FG_SUPERVISOR"] }), "record-1");
      expect(result.header.id).toBe("record-1");
      expect(result.editable).toBe(false);
    });

    it("throws RecordNotFoundException for an unknown id", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(null);
      const service = buildService(prismaMock);

      await expect(service.getById(buildUser(), "nope")).rejects.toBeInstanceOf(RecordNotFoundException);
    });
  });

  describe("saveDraft", () => {
    it("persists a status response as an upserted InspectionResult", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord());
      prismaMock.inspectionResult.upsert.mockResolvedValue({ id: "result-1", itemId: "item-wall" });
      const service = buildService(prismaMock);

      await service.saveDraft(buildUser(), "record-1", {
        responses: { "item-wall": { itemId: "item-wall", value: { kind: "status", value: "PASS" } } },
      });

      expect(prismaMock.inspectionResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recordId_itemId: { recordId: "record-1", itemId: "item-wall" } },
          create: expect.objectContaining({ status: "ACCEPTABLE" }),
        }),
      );
    });

    it("throws RecordLockedException once the record has been submitted", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord({ status: "SUBMITTED" }));
      const service = buildService(prismaMock);

      await expect(
        service.saveDraft(buildUser(), "record-1", {
          responses: { "item-wall": { itemId: "item-wall", value: { kind: "status", value: "PASS" } } },
        }),
      ).rejects.toBeInstanceOf(RecordLockedException);
    });

    it("throws RecordNotFoundException when a non-owner attempts to edit the draft", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord({ createdById: "someone-else" }));
      const service = buildService(prismaMock);

      await expect(
        service.saveDraft(buildUser(), "record-1", {
          responses: { "item-wall": { itemId: "item-wall", value: { kind: "status", value: "PASS" } } },
        }),
      ).rejects.toBeInstanceOf(RecordNotFoundException);
    });
  });

  describe("submit", () => {
    it("rejects submission with RecordValidationException when a required item has no response", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord());
      prismaMock.inspectionResult.findMany.mockResolvedValue([]);
      const service = buildService(prismaMock);

      await expect(service.submit(buildUser(), "record-1", {})).rejects.toBeInstanceOf(RecordValidationException);
      expect(prismaMock.inspectionRecord.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "SUBMITTED" }) }),
      );
    });

    it("rejects submission when a failing item is missing its required remark", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord());
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        { id: "result-1", itemId: "item-wall", status: "UNACCEPTABLE", notes: null, issueReason: null, correction: null, correctiveAction: null, attachments: [] },
      ]);
      const service = buildService(prismaMock);

      const error = await service.submit(buildUser(), "record-1", {}).catch((e) => e);
      expect(error).toBeInstanceOf(RecordValidationException);
      expect(error.errors.some((e: { code: string }) => e.code === "REMARK_REQUIRED")).toBe(true);
    });

    it("submits successfully, locks the record and returns counts + next responsible role", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord());
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        { id: "result-1", itemId: "item-wall", status: "ACCEPTABLE", notes: null, issueReason: null, correction: null, correctiveAction: null, attachments: [] },
      ]);
      const service = buildService(prismaMock);

      const result = await service.submit(buildUser(), "record-1", {});

      expect(result.status).toBe("SUBMITTED");
      expect(result.counts).toEqual({ acceptable: 1, failed: 0, notApplicable: 0, unanswered: 0, total: 1 });
      expect(result.nextResponsibleRole).toBe("FG_SUPERVISOR");
      expect(prismaMock.inspectionRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "record-1" }, data: expect.objectContaining({ status: "SUBMITTED" }) }),
      );
      expect(prismaMock.taskAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recordId: "record-1" }, data: { status: "SUBMITTED" } }),
      );
    });

    it("creates a corrective action for a failing item configured to require one", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord());
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        {
          id: "result-1",
          itemId: "item-wall",
          status: "UNACCEPTABLE",
          notes: "Visible dirt on the wall",
          issueReason: "Dirt / residue",
          correction: "Cleaned immediately",
          correctiveAction: "Escalated to maintenance for a deep clean",
          attachments: [],
        },
      ]);
      const service = buildService(prismaMock);

      const result = await service.submit(buildUser(), "record-1", {});

      expect(result.correctiveActionsCreated).toBe(1);
      expect(prismaMock.correctiveAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recordId: "record-1", resultId: "result-1", priority: "HIGH" }),
        }),
      );
    });

    it("never creates a second corrective action for a result that already has one", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord());
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        {
          id: "result-1",
          itemId: "item-wall",
          status: "UNACCEPTABLE",
          notes: "Visible dirt",
          issueReason: "Dirt / residue",
          correction: null,
          correctiveAction: "Escalated to maintenance for a deep clean",
          attachments: [],
        },
      ]);
      prismaMock.correctiveAction.findFirst.mockResolvedValue({ id: "existing-ca" });
      const service = buildService(prismaMock);

      const result = await service.submit(buildUser(), "record-1", {});

      expect(result.correctiveActionsCreated).toBe(0);
      expect(prismaMock.correctiveAction.create).not.toHaveBeenCalled();
    });

    it("throws RecordLockedException when attempting to re-submit an already-submitted record", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord({ status: "SUBMITTED" }));
      const service = buildService(prismaMock);

      await expect(service.submit(buildUser(), "record-1", {})).rejects.toBeInstanceOf(RecordLockedException);
    });

    it("allows resubmission of a REJECTED record (returned-correction workflow)", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord({ status: "REJECTED" }));
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        { id: "result-1", itemId: "item-wall", status: "ACCEPTABLE", notes: null, issueReason: null, correction: null, correctiveAction: null, attachments: [] },
      ]);
      const service = buildService(prismaMock);

      const result = await service.submit(buildUser(), "record-1", {});
      expect(result.status).toBe("SUBMITTED");
    });
  });
});
