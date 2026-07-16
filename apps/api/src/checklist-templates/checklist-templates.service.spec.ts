import { ChecklistTemplatesService } from "./checklist-templates.service";
import {
  EmptyTemplateException,
  InvalidItemRulesException,
  PublishedVersionNotFoundException,
  TemplateCodeConflictException,
  TemplateNotFoundException,
  TemplateVersionNotFoundException,
  VersionAlreadyArchivedException,
  VersionNotDraftException,
  VersionNotEditableException,
} from "./checklist-templates.errors";
import type { PrismaService } from "../prisma/prisma.service";

function makeSection(overrides: Record<string, unknown> = {}) {
  return {
    id: "section-1",
    templateVersionId: "version-1",
    name: "Finished Goods",
    sortOrder: 0,
    items: [],
    ...overrides,
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    sectionId: "section-1",
    label: "Floor",
    helpText: null,
    sortOrder: 0,
    itemType: "ACCEPTABLE_UNACCEPTABLE_NA",
    isRequired: true,
    allowNotApplicable: false,
    requiresEvidenceOnFail: false,
    isCriticalFailure: false,
    remarkRequiredOnFail: false,
    correctiveActionRequiredOnFail: false,
    minValue: null,
    maxValue: null,
    defaultResponse: null,
    options: [],
    ...overrides,
  };
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-1",
    templateId: "template-1",
    versionNumber: 1,
    status: "DRAFT",
    workflowVersion: 0,
    notes: null,
    publishedAt: null,
    publishedById: null,
    sections: [],
    template: {
      id: "template-1",
      code: "NMS/PPU/CL/24",
      title: "Daily Cleaning",
      description: null,
    },
    ...overrides,
  };
}

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "template-1",
    code: "NMS/PPU/CL/24",
    title: "Daily Cleaning",
    description: null,
    isActive: true,
    currentVersionId: null,
    currentVersion: null,
    versions: [],
    ...overrides,
  };
}

function buildPrismaMock() {
  const prismaMock = {
    checklistTemplate: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    checklistTemplateVersion: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    checklistSection: {
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    },
    checklistItem: {
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    },
    checklistItemOption: {
      deleteMany: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn(),
  };
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return undefined;
  });
  return prismaMock;
}

function buildService(prismaMock: ReturnType<typeof buildPrismaMock>) {
  return new ChecklistTemplatesService(prismaMock as unknown as PrismaService);
}

describe("ChecklistTemplatesService", () => {
  describe("listPublished", () => {
    it("maps templates with a published current version into summaries", async () => {
      const prismaMock = buildPrismaMock();
      const publishedVersion = {
        id: "v1",
        versionNumber: 1,
        status: "PUBLISHED",
        notes: null,
        publishedAt: new Date("2026-01-01"),
      };
      prismaMock.checklistTemplate.findMany.mockResolvedValue([
        makeTemplate({
          currentVersionId: "v1",
          currentVersion: publishedVersion,
          versions: [publishedVersion],
        }),
      ]);
      const service = buildService(prismaMock);

      const result = await service.listPublished();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        code: "NMS/PPU/CL/24",
        currentVersion: { status: "PUBLISHED" },
      });
      expect(prismaMock.checklistTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, currentVersion: { status: "PUBLISHED" } },
        }),
      );
    });
  });

  describe("getPublishedVersion", () => {
    it("throws TemplateNotFoundException for an unknown code", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(null);
      const service = buildService(prismaMock);

      await expect(service.getPublishedVersion("NOPE")).rejects.toBeInstanceOf(
        TemplateNotFoundException,
      );
    });

    it("throws PublishedVersionNotFoundException when the template has never been published", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(
        makeTemplate({ currentVersionId: null }),
      );
      const service = buildService(prismaMock);

      await expect(service.getPublishedVersion("NMS/PPU/CL/24")).rejects.toBeInstanceOf(
        PublishedVersionNotFoundException,
      );
    });

    it("returns the full mapped definition for a published current version", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(
        makeTemplate({ currentVersionId: "version-1" }),
      );
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({
          status: "PUBLISHED",
          sections: [makeSection({ items: [makeItem()] })],
        }),
      );
      const service = buildService(prismaMock);

      const result = await service.getPublishedVersion("NMS/PPU/CL/24");

      expect(result.status).toBe("PUBLISHED");
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0]?.items).toHaveLength(1);
    });
  });

  describe("getVersionByNumber — published protection / draft visibility", () => {
    it("returns a PUBLISHED version to any requester regardless of permissions", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({ status: "PUBLISHED" }),
      );
      const service = buildService(prismaMock);

      const result = await service.getVersionByNumber("NMS/PPU/CL/24", 1, []);
      expect(result.status).toBe("PUBLISHED");
    });

    it("hides a DRAFT version from a requester without templates:manage/publish", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({ status: "DRAFT" }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.getVersionByNumber("NMS/PPU/CL/24", 1, ["records:read"]),
      ).rejects.toBeInstanceOf(TemplateVersionNotFoundException);
    });

    it("allows a requester holding templates:manage to view a DRAFT version", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({ status: "DRAFT" }),
      );
      const service = buildService(prismaMock);

      const result = await service.getVersionByNumber("NMS/PPU/CL/24", 1, [
        "templates:manage",
      ]);
      expect(result.status).toBe("DRAFT");
    });
  });

  describe("createTemplate", () => {
    it("rejects a duplicate template code with 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      const service = buildService(prismaMock);

      await expect(
        service.createTemplate({ code: "NMS/PPU/CL/24", title: "Dup" }, "user-1"),
      ).rejects.toBeInstanceOf(TemplateCodeConflictException);
    });

    it("creates the template with an empty draft v1", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce(null);
      prismaMock.checklistTemplate.create.mockResolvedValue({
        ...makeTemplate({ code: "NEW/CODE" }),
        versions: [{ id: "version-1" }],
      });
      prismaMock.checklistTemplateVersion.findUniqueOrThrow.mockResolvedValue(
        makeVersion({
          template: {
            id: "template-1",
            code: "NEW/CODE",
            title: "New",
            description: null,
          },
        }),
      );
      const service = buildService(prismaMock);

      const result = await service.createTemplate(
        { code: "NEW/CODE", title: "New" },
        "user-1",
      );

      expect(result.code).toBe("NEW/CODE");
      expect(result.status).toBe("DRAFT");
      expect(result.versionNumber).toBe(1);
    });
  });

  describe("createDraftVersion — clone from published", () => {
    it("creates an empty draft when the template has never been published", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(
        makeTemplate({ versions: [] }),
      );
      prismaMock.checklistTemplateVersion.create.mockResolvedValue(
        makeVersion({ versionNumber: 1, sections: [] }),
      );
      const service = buildService(prismaMock);

      const result = await service.createDraftVersion("NMS/PPU/CL/24");

      expect(result.sections).toHaveLength(0);
      expect(prismaMock.checklistTemplateVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 1, sections: undefined }),
        }),
      );
    });

    it("clones sections/items/options from the highest published version by default", async () => {
      const prismaMock = buildPrismaMock();
      const publishedSummary = {
        id: "v1",
        versionNumber: 1,
        status: "PUBLISHED",
        notes: null,
        publishedAt: new Date("2026-01-01"),
      };
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(
        makeTemplate({ currentVersionId: "v1", versions: [publishedSummary] }),
      );
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({
          id: "v1",
          versionNumber: 1,
          status: "PUBLISHED",
          sections: [makeSection({ items: [makeItem({ label: "Floor" })] })],
        }),
      );
      prismaMock.checklistTemplateVersion.create.mockResolvedValue(
        makeVersion({
          id: "v2",
          versionNumber: 2,
          sections: [makeSection({ items: [makeItem({ label: "Floor" })] })],
        }),
      );
      const service = buildService(prismaMock);

      const result = await service.createDraftVersion("NMS/PPU/CL/24");

      expect(prismaMock.checklistTemplateVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versionNumber: 2,
            sections: {
              create: [
                expect.objectContaining({
                  name: "Finished Goods",
                  items: { create: [expect.objectContaining({ label: "Floor" })] },
                }),
              ],
            },
          }),
        }),
      );
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0]?.items[0]?.label).toBe("Floor");
    });
  });

  describe("cloneDraftFromVersion", () => {
    it("clones a specific version's content into a new draft regardless of publish status", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique
        .mockResolvedValueOnce(
          makeTemplate({ versions: [{ id: "v1", versionNumber: 1, status: "DRAFT" }] }),
        )
        .mockResolvedValueOnce(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({
          id: "v1",
          versionNumber: 1,
          sections: [makeSection({ items: [makeItem()] })],
        }),
      );
      prismaMock.checklistTemplateVersion.create.mockResolvedValue(
        makeVersion({
          id: "v2",
          versionNumber: 2,
          sections: [makeSection({ items: [makeItem()] })],
        }),
      );
      const service = buildService(prismaMock);

      const result = await service.cloneDraftFromVersion("NMS/PPU/CL/24", 1);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0]?.items).toHaveLength(1);
    });

    it("propagates TemplateVersionNotFoundException for an unknown source version", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(
        makeTemplate({ versions: [] }),
      );
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(null);
      const service = buildService(prismaMock);

      await expect(
        service.cloneDraftFromVersion("NMS/PPU/CL/24", 99),
      ).rejects.toBeInstanceOf(TemplateVersionNotFoundException);
      expect(prismaMock.checklistTemplateVersion.create).not.toHaveBeenCalled();
    });
  });

  describe("published-version immutability (409/400 on direct edits)", () => {
    it("rejects adding a section to a PUBLISHED version with 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({ status: "PUBLISHED" }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.addSection("NMS/PPU/CL/24", 1, { name: "New section" }),
      ).rejects.toBeInstanceOf(VersionNotEditableException);
      expect(prismaMock.checklistSection.create).not.toHaveBeenCalled();
    });

    it("rejects adding an item to an ARCHIVED version with 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({ status: "ARCHIVED", sections: [makeSection()] }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.addItem("NMS/PPU/CL/24", 1, "section-1", { label: "New item" }),
      ).rejects.toBeInstanceOf(VersionNotEditableException);
      expect(prismaMock.checklistItem.create).not.toHaveBeenCalled();
    });

    it("rejects updating an item on a PUBLISHED version with 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({
          status: "PUBLISHED",
          sections: [makeSection({ items: [makeItem()] })],
        }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.updateItem("NMS/PPU/CL/24", 1, "item-1", { label: "Changed" }),
      ).rejects.toBeInstanceOf(VersionNotEditableException);
    });

    it("rejects reordering sections on a non-draft version with 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({ status: "PUBLISHED", sections: [makeSection()] }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.reorderSections("NMS/PPU/CL/24", 1, ["section-1"]),
      ).rejects.toBeInstanceOf(VersionNotEditableException);
    });
  });

  describe("addItem validation (dynamic rules)", () => {
    function draftVersionWithSection() {
      return makeVersion({ status: "DRAFT", sections: [makeSection()] });
    }

    it("rejects minValue greater than maxValue with 400", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        draftVersionWithSection(),
      );
      const service = buildService(prismaMock);

      await expect(
        service.addItem("NMS/PPU/CL/24", 1, "section-1", {
          label: "Temp",
          itemType: "TEMPERATURE",
          minValue: 10,
          maxValue: 0,
        }),
      ).rejects.toBeInstanceOf(InvalidItemRulesException);
    });

    it("rejects a SINGLE_SELECT item with no options with 400", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        draftVersionWithSection(),
      );
      const service = buildService(prismaMock);

      await expect(
        service.addItem("NMS/PPU/CL/24", 1, "section-1", {
          label: "Pick one",
          itemType: "SINGLE_SELECT",
        }),
      ).rejects.toBeInstanceOf(InvalidItemRulesException);
    });

    it("accepts a valid item and persists the configured rules", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        draftVersionWithSection(),
      );
      const service = buildService(prismaMock);

      await service.addItem("NMS/PPU/CL/24", 1, "section-1", {
        label: "Cold Room 1",
        itemType: "ACCEPTABLE_UNACCEPTABLE_NA",
        isCriticalFailure: true,
        remarkRequiredOnFail: true,
      });

      expect(prismaMock.checklistItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: "Cold Room 1",
            isCriticalFailure: true,
            remarkRequiredOnFail: true,
          }),
        }),
      );
    });
  });

  describe("publishVersion", () => {
    it("rejects publishing a non-draft version with 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({
          status: "PUBLISHED",
          sections: [makeSection({ items: [makeItem()] })],
        }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.publishVersion("NMS/PPU/CL/24", 1, "user-1", undefined),
      ).rejects.toBeInstanceOf(VersionNotDraftException);
    });

    it("rejects publishing an empty draft (no sections/items) with 400", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({ status: "DRAFT", sections: [] }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.publishVersion("NMS/PPU/CL/24", 1, "user-1", undefined),
      ).rejects.toBeInstanceOf(EmptyTemplateException);
    });

    it("rejects publishing a draft that has sections but no items with 400", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({ status: "DRAFT", sections: [makeSection({ items: [] })] }),
      );
      const service = buildService(prismaMock);

      await expect(
        service.publishVersion("NMS/PPU/CL/24", 1, "user-1", undefined),
      ).rejects.toBeInstanceOf(EmptyTemplateException);
    });

    it("publishes a valid draft and promotes it to the template's current version", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique
        .mockResolvedValueOnce(
          makeVersion({
            status: "DRAFT",
            sections: [makeSection({ items: [makeItem()] })],
          }),
        )
        .mockResolvedValueOnce(
          makeVersion({
            status: "PUBLISHED",
            sections: [makeSection({ items: [makeItem()] })],
          }),
        );
      const service = buildService(prismaMock);

      const result = await service.publishVersion(
        "NMS/PPU/CL/24",
        1,
        "user-1",
        "Initial publish",
      );

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(result.status).toBe("PUBLISHED");
    });
  });

  describe("archiveVersion", () => {
    it("rejects archiving an already-archived version with 409", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplateVersion.findUnique.mockResolvedValue(
        makeVersion({ status: "ARCHIVED" }),
      );
      const service = buildService(prismaMock);

      await expect(service.archiveVersion("NMS/PPU/CL/24", 1)).rejects.toBeInstanceOf(
        VersionAlreadyArchivedException,
      );
    });

    it("clears the template's currentVersionId when archiving the current version", async () => {
      const prismaMock = buildPrismaMock();
      prismaMock.checklistTemplate.findUnique.mockResolvedValue(makeTemplate());
      prismaMock.checklistTemplate.findUniqueOrThrow.mockResolvedValue(
        makeTemplate({ currentVersionId: "version-1" }),
      );
      prismaMock.checklistTemplateVersion.findUnique
        .mockResolvedValueOnce(makeVersion({ status: "PUBLISHED" }))
        .mockResolvedValueOnce(makeVersion({ status: "ARCHIVED" }));
      const service = buildService(prismaMock);

      await service.archiveVersion("NMS/PPU/CL/24", 1);

      expect(prismaMock.checklistTemplate.update).toHaveBeenCalledWith({
        where: { id: "template-1" },
        data: { currentVersionId: null },
      });
    });
  });
});
