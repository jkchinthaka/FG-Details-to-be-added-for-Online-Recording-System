import { InspectionRecordsService } from "./inspection-records.service";
import {
  CriticalFailureOverrideException,
  DuplicateRecordException,
  LoadingDecisionForbiddenException,
  ManualVehicleEntryForbiddenException,
  NotATruckInspectionException,
  RecordLockedException,
  RecordNotFoundException,
  RecordValidationException,
  VehicleNotFoundException,
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
    checkedBy: null,
    verifiedById: null,
    verifiedBy: null,
    submittedAt: null,
    checkedAt: null,
    verifiedAt: null,
    createdAt: new Date("2026-07-14T01:00:00.000Z"),
    updatedAt: new Date("2026-07-14T01:00:00.000Z"),
    reinspectionOfId: null,
    reinspectionOf: null,
    truckDetail: null,
    ...overrides,
  };
}

function makeTruckDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "truck-detail-1",
    recordId: "record-1",
    vehicleId: "vehicle-1",
    vehicle: {
      id: "vehicle-1",
      vehicleNumber: "WP CAB-1234",
      freezerTruckNumber: "FT-01",
      status: "ACTIVE",
      transporterId: "transporter-1",
      transporter: { id: "transporter-1", name: "Lanka Cold Logistics" },
    },
    driverId: null,
    driver: null,
    transporterId: "transporter-1",
    transporter: { id: "transporter-1", name: "Lanka Cold Logistics" },
    freezerTruckNumber: "FT-01",
    vehicleNumber: "WP CAB-1234",
    inspectionTime: "08:30",
    loadingReference: null,
    productCategory: null,
    temperatureCurrent: null,
    temperatureMin: null,
    temperatureMax: null,
    temperatureAcceptable: null,
    recommendedDecision: null,
    loadingDecision: "PENDING",
    decidedById: null,
    decidedBy: null,
    decidedAt: null,
    remarks: null,
    createdAt: new Date("2026-07-14T01:00:00.000Z"),
    updatedAt: new Date("2026-07-14T01:00:00.000Z"),
    ...overrides,
  };
}

function makeTruckTemplateVersion(overrides: Record<string, unknown> = {}) {
  return makeTemplateVersion({
    template: { id: "template-truck-1", code: "NMS/PPU/CL/30", title: "Inspection of Freezer Truck Before Loading", description: null },
    sections: [
      makeSection({
        items: [
          makeItem({ id: "item-door-lock", label: "Door lock", itemType: "PASS_FAIL_NA", isCriticalFailure: true, correctiveActionRequiredOnFail: true }),
          makeItem({ id: "item-floor", label: "Floor", itemType: "PASS_FAIL_NA", correctiveActionRequiredOnFail: false }),
        ],
      }),
    ],
    ...overrides,
  });
}

function buildPrismaMock() {
  const prismaMock = {
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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    vehicle: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    truckInspectionDetail: {
      update: jest.fn().mockResolvedValue(undefined),
    },
    approvalRecord: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn(),
  };
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  return prismaMock;
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
      expect(prismaMock.inspectionRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "record-1", status: { in: ["DRAFT", "REJECTED"] } },
          data: expect.objectContaining({ status: "SUBMITTED" }),
        }),
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

    it("locks a duplicate submit before it can create another corrective action", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique
        .mockResolvedValueOnce(makeRecord())
        .mockResolvedValueOnce(makeRecord({ status: "SUBMITTED" }));
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        {
          id: "result-1",
          itemId: "item-wall",
          status: "UNACCEPTABLE",
          notes: "Visible dirt",
          issueReason: "Dirt / residue",
          correction: null,
          correctiveAction: "Escalated to maintenance",
          attachments: [],
        },
      ]);
      const service = buildService(prismaMock);

      await service.submit(buildUser(), "record-1", {});
      await expect(service.submit(buildUser(), "record-1", {})).rejects.toBeInstanceOf(RecordLockedException);

      expect(prismaMock.correctiveAction.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.taskAssignment.updateMany).toHaveBeenCalledTimes(1);
    });

    it("treats a lost submit race as locked without creating downstream workflow rows", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord());
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        { id: "result-1", itemId: "item-wall", status: "ACCEPTABLE", notes: null, issueReason: null, correction: null, correctiveAction: null, attachments: [] },
      ]);
      prismaMock.inspectionRecord.updateMany.mockResolvedValue({ count: 0 });
      const service = buildService(prismaMock);

      await expect(service.submit(buildUser(), "record-1", {})).rejects.toBeInstanceOf(RecordLockedException);

      expect(prismaMock.correctiveAction.create).not.toHaveBeenCalled();
      expect(prismaMock.taskAssignment.updateMany).not.toHaveBeenCalled();
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

    it("does not compute a loading decision for a non-truck (cleaning) record", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord());
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        { id: "result-1", itemId: "item-wall", status: "ACCEPTABLE", notes: null, issueReason: null, correction: null, correctiveAction: null, attachments: [] },
      ]);
      const service = buildService(prismaMock);

      const result = await service.submit(buildUser(), "record-1", {});

      expect(result.loadingDecision).toBeNull();
      expect(prismaMock.truckInspectionDetail.update).not.toHaveBeenCalled();
    });
  });

  describe("submit — freezer truck loading decision", () => {
    function buildTruckRecord(overrides: Record<string, unknown> = {}) {
      return makeRecord({
        id: "record-truck-1",
        documentCode: "NMS/PPU/CL/30",
        truckDetail: makeTruckDetail({ recordId: "record-truck-1" }),
        ...overrides,
      });
    }

    it("recommends APPROVED_FOR_LOADING when All Conditions Passed", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(buildTruckRecord());
      prismaMock.checklistTemplateVersion.findUniqueOrThrow.mockResolvedValue(makeTruckTemplateVersion());
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        { id: "result-lock", itemId: "item-door-lock", status: "PASS", notes: null, issueReason: null, correction: null, correctiveAction: null, attachments: [] },
        { id: "result-floor", itemId: "item-floor", status: "PASS", notes: null, issueReason: null, correction: null, correctiveAction: null, attachments: [] },
      ]);
      const service = buildService(prismaMock);

      const result = await service.submit(buildUser(), "record-truck-1", {});

      expect(result.loadingDecision).toBe("APPROVED_FOR_LOADING");
      expect(result.hasCriticalFailure).toBe(false);
      expect(prismaMock.truckInspectionDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recordId: "record-truck-1" },
          data: { recommendedDecision: "APPROVED_FOR_LOADING", loadingDecision: "APPROVED_FOR_LOADING" },
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "LOADING_DECISION_RECOMMENDED" }),
        }),
      );
    });

    it("recommends CONDITIONALLY_APPROVED when only a non-critical item fails", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(buildTruckRecord());
      prismaMock.checklistTemplateVersion.findUniqueOrThrow.mockResolvedValue(makeTruckTemplateVersion());
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        { id: "result-lock", itemId: "item-door-lock", status: "PASS", notes: null, issueReason: null, correction: null, correctiveAction: null, attachments: [] },
        { id: "result-floor", itemId: "item-floor", status: "FAIL", notes: "Debris", issueReason: null, correction: null, correctiveAction: null, attachments: [] },
      ]);
      const service = buildService(prismaMock);

      const result = await service.submit(buildUser(), "record-truck-1", {});

      expect(result.loadingDecision).toBe("CONDITIONALLY_APPROVED");
      expect(result.hasCriticalFailure).toBe(false);
    });

    it("automatically blocks loading (LOADING_BLOCKED) on a critical failure — the block cannot be skipped", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(buildTruckRecord());
      prismaMock.checklistTemplateVersion.findUniqueOrThrow.mockResolvedValue(makeTruckTemplateVersion());
      prismaMock.inspectionResult.findMany.mockResolvedValue([
        {
          id: "result-lock",
          itemId: "item-door-lock",
          status: "FAIL",
          notes: "Lock broken",
          issueReason: "Damage",
          correction: null,
          correctiveAction: "Escalated to maintenance",
          attachments: [],
        },
        { id: "result-floor", itemId: "item-floor", status: "PASS", notes: null, issueReason: null, correction: null, correctiveAction: null, attachments: [] },
      ]);
      const service = buildService(prismaMock);

      const result = await service.submit(buildUser(), "record-truck-1", {});

      expect(result.loadingDecision).toBe("LOADING_BLOCKED");
      expect(result.hasCriticalFailure).toBe(true);
      // The critical failure also opens a corrective action automatically.
      expect(result.correctiveActionsCreated).toBe(1);
      expect(prismaMock.truckInspectionDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { recommendedDecision: "LOADING_BLOCKED", loadingDecision: "LOADING_BLOCKED" },
        }),
      );
    });
  });

  describe("createTruckDraft", () => {
    function buildUserWithManualEntry(): RequestUser {
      return buildUser({ roles: ["FG_SUPERVISOR"], permissions: ["records:create", "records:read", "vehicles:manual_entry"] });
    }

    it("creates a new truck inspection record for the selected vehicle", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: "vehicle-1",
        vehicleNumber: "WP CAB-1234",
        freezerTruckNumber: "FT-01",
        transporterId: "transporter-1",
      });
      prismaMock.checklistTemplate.findUnique.mockResolvedValue({ id: "template-truck-1", code: "NMS/PPU/CL/30", currentVersionId: "version-truck-1" });
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(makeTruckTemplateVersion());
      prismaMock.inspectionRecord.create.mockResolvedValue(
        makeRecord({ id: "record-truck-1", documentCode: "NMS/PPU/CL/30", truckDetail: makeTruckDetail({ recordId: "record-truck-1" }) }),
      );
      const service = buildService(prismaMock);

      const result = await service.createTruckDraft(buildUser(), { vehicleId: "vehicle-1" });

      expect(prismaMock.inspectionRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentCode: "NMS/PPU/CL/30",
            truckDetail: {
              create: expect.objectContaining({
                vehicleId: "vehicle-1",
                freezerTruckNumber: "FT-01",
                vehicleNumber: "WP CAB-1234",
                transporterId: "transporter-1",
              }),
            },
          }),
        }),
      );
      expect(result.truck?.vehicle?.vehicleNumber).toBe("WP CAB-1234");
    });

    it("throws VehicleNotFoundException when vehicleId doesn't resolve to a known vehicle", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.findUnique.mockResolvedValue(null);
      const service = buildService(prismaMock);

      await expect(service.createTruckDraft(buildUser(), { vehicleId: "missing" })).rejects.toBeInstanceOf(
        VehicleNotFoundException,
      );
    });

    it("rejects manual freezerTruckNumber/vehicleNumber entry without the vehicles:manual_entry permission", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      await expect(
        service.createTruckDraft(buildUser(), { freezerTruckNumber: "FT-09", vehicleNumber: "WP AB-1111" }),
      ).rejects.toBeInstanceOf(ManualVehicleEntryForbiddenException);
    });

    it("allows manual entry for a user holding vehicles:manual_entry", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue({ id: "template-truck-1", code: "NMS/PPU/CL/30", currentVersionId: "version-truck-1" });
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(makeTruckTemplateVersion());
      prismaMock.inspectionRecord.create.mockResolvedValue(
        makeRecord({ id: "record-truck-1", documentCode: "NMS/PPU/CL/30", truckDetail: makeTruckDetail({ vehicleId: null }) }),
      );
      const service = buildService(prismaMock);

      await service.createTruckDraft(buildUserWithManualEntry(), {
        freezerTruckNumber: "FT-09",
        vehicleNumber: "WP AB-1111",
      });

      expect(prismaMock.inspectionRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            truckDetail: { create: expect.objectContaining({ vehicleId: null, freezerTruckNumber: "FT-09", vehicleNumber: "WP AB-1111", inspectionTime: expect.any(String) }) },
          }),
        }),
      );
    });

    it("links a new draft back to a prior record via reinspectionOfRecordId (re-inspection linkage)", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: "vehicle-1",
        vehicleNumber: "WP CAB-1234",
        freezerTruckNumber: "FT-01",
        transporterId: "transporter-1",
      });
      prismaMock.checklistTemplate.findUnique.mockResolvedValue({ id: "template-truck-1", code: "NMS/PPU/CL/30", currentVersionId: "version-truck-1" });
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(makeTruckTemplateVersion());
      prismaMock.inspectionRecord.findUnique.mockResolvedValue({ id: "record-blocked-1" });
      prismaMock.inspectionRecord.create.mockResolvedValue(
        makeRecord({ id: "record-truck-2", documentCode: "NMS/PPU/CL/30", reinspectionOfId: "record-blocked-1" }),
      );
      const service = buildService(prismaMock);

      await service.createTruckDraft(buildUser(), { vehicleId: "vehicle-1", reinspectionOfRecordId: "record-blocked-1" });

      expect(prismaMock.inspectionRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reinspectionOfId: "record-blocked-1" }) }),
      );
    });

    it("throws a DuplicateRecordException when the same vehicle already has an active draft this shift", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.vehicle.findUnique.mockResolvedValue({
        id: "vehicle-1",
        vehicleNumber: "WP CAB-1234",
        freezerTruckNumber: "FT-01",
        transporterId: "transporter-1",
      });
      prismaMock.inspectionRecord.findFirst.mockResolvedValue(
        makeRecord({ id: "record-existing", status: "SUBMITTED", documentCode: "NMS/PPU/CL/30" }),
      );
      const service = buildService(prismaMock);

      await expect(service.createTruckDraft(buildUser(), { vehicleId: "vehicle-1" })).rejects.toBeInstanceOf(
        DuplicateRecordException,
      );
    });
  });

  describe("approveLoadingDecision", () => {
    function buildTruckRecord(overrides: { truckDetail?: Record<string, unknown> } = {}) {
      const { truckDetail, ...rest } = overrides;
      return makeRecord({
        id: "record-truck-1",
        documentCode: "NMS/PPU/CL/30",
        ...rest,
        truckDetail: makeTruckDetail({ recordId: "record-truck-1", ...(truckDetail ?? {}) }),
      });
    }

    it("rejects users without a supervisor/QA role (role-based approval restriction)", async () => {
      const prismaMock = buildPrismaMock();
      const service = buildService(prismaMock);

      await expect(
        service.approveLoadingDecision(buildUser({ roles: ["FG_OPERATOR"] }), "record-truck-1", {
          decision: "APPROVED_FOR_LOADING",
        }),
      ).rejects.toBeInstanceOf(LoadingDecisionForbiddenException);
      expect(prismaMock.inspectionRecord.findUnique).not.toHaveBeenCalled();
    });

    it("throws NotATruckInspectionException for a record without a truckDetail", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(makeRecord({ truckDetail: null }));
      const service = buildService(prismaMock);

      await expect(
        service.approveLoadingDecision(buildUser({ roles: ["FG_SUPERVISOR"] }), "record-1", {
          decision: "APPROVED_FOR_LOADING",
        }),
      ).rejects.toBeInstanceOf(NotATruckInspectionException);
    });

    it("never allows overriding a critical-failure recommendation to an approved outcome", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(
        buildTruckRecord({ truckDetail: { recommendedDecision: "LOADING_BLOCKED", loadingDecision: "LOADING_BLOCKED" } }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.approveLoadingDecision(buildUser({ roles: ["QA_EXECUTIVE"] }), "record-truck-1", {
          decision: "APPROVED_FOR_LOADING",
        }),
      ).rejects.toBeInstanceOf(CriticalFailureOverrideException);
      expect(prismaMock.truckInspectionDetail.update).not.toHaveBeenCalled();
    });

    it("still allows REJECTED as a final decision even when the recommendation is LOADING_BLOCKED", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(
        buildTruckRecord({ truckDetail: { recommendedDecision: "LOADING_BLOCKED", loadingDecision: "LOADING_BLOCKED" } }),
      );
      prismaMock.checklistTemplateVersion.findUniqueOrThrow.mockResolvedValue(makeTruckTemplateVersion());
      const service = buildService(prismaMock);

      await service.approveLoadingDecision(buildUser({ roles: ["QA_EXECUTIVE"] }), "record-truck-1", {
        decision: "REJECTED",
        remarks: "Truck rejected outright",
      });

      expect(prismaMock.truckInspectionDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ loadingDecision: "REJECTED" }) }),
      );
    });

    it("records a supervisor/QA final decision, an ApprovalRecord and an AuditLog entry", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.inspectionRecord.findUnique.mockResolvedValue(
        buildTruckRecord({ truckDetail: { recommendedDecision: "CONDITIONALLY_APPROVED", loadingDecision: "CONDITIONALLY_APPROVED" } }),
      );
      prismaMock.checklistTemplateVersion.findUniqueOrThrow.mockResolvedValue(makeTruckTemplateVersion());
      const service = buildService(prismaMock);

      const supervisor = buildUser({ id: "sup-1", roles: ["FG_SUPERVISOR"] });
      const result = await service.approveLoadingDecision(supervisor, "record-truck-1", {
        decision: "APPROVED_FOR_LOADING",
        remarks: "Reviewed on-site, safe to load",
      });

      expect(prismaMock.truckInspectionDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loadingDecision: "APPROVED_FOR_LOADING",
            decidedById: "sup-1",
            remarks: "Reviewed on-site, safe to load",
          }),
        }),
      );
      expect(prismaMock.approvalRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ approvalType: "LOADING_DECISION", decision: "APPROVED", decidedById: "sup-1" }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LOADING_DECISION_CHANGED",
            metadata: expect.objectContaining({ from: "CONDITIONALLY_APPROVED", to: "APPROVED_FOR_LOADING" }),
          }),
        }),
      );
      expect(result.header.id).toBe("record-truck-1");
    });
  });
});
