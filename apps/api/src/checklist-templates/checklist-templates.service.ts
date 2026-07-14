import { Injectable } from "@nestjs/common";
import {
  addItemSchema,
  updateItemRulesSchema,
  type ChecklistTemplateSummary,
  type ChecklistTemplateVersionDefinition,
  type ChecklistTemplateVersionSummary,
  type PermissionKey,
} from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, TemplateStatus, type ChecklistItemType } from "../../generated/prisma-client";
import type { AddItemDto } from "./dto/add-item.dto";
import type { AddSectionDto } from "./dto/add-section.dto";
import type { CreateTemplateDto } from "./dto/create-template.dto";
import type { UpdateItemDto } from "./dto/update-item.dto";
import {
  EmptyTemplateException,
  InvalidItemRulesException,
  ItemNotFoundException,
  PublishedVersionNotFoundException,
  SectionNotFoundException,
  TemplateCodeConflictException,
  TemplateNotFoundException,
  TemplateVersionNotFoundException,
  VersionAlreadyArchivedException,
  VersionNotDraftException,
  VersionNotEditableException,
} from "./checklist-templates.errors";
import { VERSION_WITH_CONTENT_INCLUDE, mapVersionToDefinition, type VersionWithContent } from "./checklist-templates.mappers";

const templateWithVersionsInclude = {
  currentVersion: true,
  versions: { orderBy: { versionNumber: "asc" } },
} satisfies Prisma.ChecklistTemplateInclude;

type TemplateWithVersions = Prisma.ChecklistTemplateGetPayload<{
  include: typeof templateWithVersionsInclude;
}>;

const CAN_VIEW_DRAFTS: PermissionKey[] = ["templates:manage", "templates:publish"];

function toVersionSummary(version: {
  id: string;
  versionNumber: number;
  status: TemplateStatus;
  notes: string | null;
  publishedAt: Date | null;
}): ChecklistTemplateVersionSummary {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    notes: version.notes,
    publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
  };
}

function toTemplateSummary(template: TemplateWithVersions): ChecklistTemplateSummary {
  return {
    id: template.id,
    code: template.code,
    title: template.title,
    description: template.description,
    isActive: template.isActive,
    currentVersion: template.currentVersion ? toVersionSummary(template.currentVersion) : null,
    versions: template.versions.map(toVersionSummary),
  };
}

@Injectable()
export class ChecklistTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Listing / retrieval
  // -------------------------------------------------------------------------

  async listPublished(): Promise<ChecklistTemplateSummary[]> {
    const templates = await this.prisma.checklistTemplate.findMany({
      where: { isActive: true, currentVersion: { status: TemplateStatus.PUBLISHED } },
      include: templateWithVersionsInclude,
      orderBy: { code: "asc" },
    });
    return templates.map(toTemplateSummary);
  }

  async listAll(): Promise<ChecklistTemplateSummary[]> {
    const templates = await this.prisma.checklistTemplate.findMany({
      include: templateWithVersionsInclude,
      orderBy: { code: "asc" },
    });
    return templates.map(toTemplateSummary);
  }

  async getTemplateSummary(code: string): Promise<ChecklistTemplateSummary> {
    const template = await this.findTemplateOrThrow(code);
    return toTemplateSummary(template);
  }

  async getPublishedVersion(code: string): Promise<ChecklistTemplateVersionDefinition> {
    const template = await this.prisma.checklistTemplate.findUnique({ where: { code } });
    if (!template) throw new TemplateNotFoundException(code);

    if (!template.currentVersionId) {
      throw new PublishedVersionNotFoundException(code);
    }

    const version = await this.prisma.checklistTemplateVersion.findUnique({
      where: { id: template.currentVersionId },
      include: VERSION_WITH_CONTENT_INCLUDE,
    });

    if (!version || version.status !== TemplateStatus.PUBLISHED) {
      throw new PublishedVersionNotFoundException(code);
    }

    return mapVersionToDefinition(version);
  }

  /** Any authenticated user may view a PUBLISHED version; DRAFT/ARCHIVED
   *  versions require template management/publish permission. */
  async getVersionByNumber(
    code: string,
    versionNumber: number,
    requesterPermissions: PermissionKey[],
  ): Promise<ChecklistTemplateVersionDefinition> {
    const version = await this.findVersionOrThrow(code, versionNumber);

    if (version.status !== TemplateStatus.PUBLISHED) {
      const canViewDrafts = requesterPermissions.some((permission) => CAN_VIEW_DRAFTS.includes(permission));
      if (!canViewDrafts) {
        throw new TemplateVersionNotFoundException(versionNumber);
      }
    }

    return mapVersionToDefinition(version);
  }

  // -------------------------------------------------------------------------
  // Draft template / version lifecycle
  // -------------------------------------------------------------------------

  async createTemplate(dto: CreateTemplateDto, userId: string): Promise<ChecklistTemplateVersionDefinition> {
    const existing = await this.prisma.checklistTemplate.findUnique({ where: { code: dto.code } });
    if (existing) throw new TemplateCodeConflictException(dto.code);

    const template = await this.prisma.checklistTemplate.create({
      data: {
        code: dto.code,
        title: dto.title,
        description: dto.description,
        createdById: userId,
        versions: { create: { versionNumber: 1, status: TemplateStatus.DRAFT } },
      },
      include: { versions: true },
    });

    const version = await this.prisma.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: template.versions[0]!.id },
      include: VERSION_WITH_CONTENT_INCLUDE,
    });
    return mapVersionToDefinition(version);
  }

  /**
   * Creates a new draft version. Unless `fromVersionNumber` is given, it
   * clones sections/items/options from the template's highest *published*
   * version (an empty draft when the template has never been published) —
   * so admins don't have to rebuild an entire checklist from scratch just
   * to make a small revision. See `cloneDraftFromVersion` for the explicit
   * "clone this specific version" entry point.
   */
  async createDraftVersion(code: string, fromVersionNumber?: number): Promise<ChecklistTemplateVersionDefinition> {
    const template = await this.findTemplateOrThrow(code);
    const nextVersionNumber = Math.max(0, ...template.versions.map((v) => v.versionNumber)) + 1;
    const source = await this.resolveCloneSource(template, fromVersionNumber);

    const created = await this.prisma.checklistTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: nextVersionNumber,
        status: TemplateStatus.DRAFT,
        sections: source ? { create: buildClonedSectionsInput(source.sections) } : undefined,
      },
      include: VERSION_WITH_CONTENT_INCLUDE,
    });
    return mapVersionToDefinition(created);
  }

  /** Explicit "clone this specific version into a new draft" entry point —
   *  same cloning logic as `createDraftVersion`, but always requires a
   *  source version rather than falling back to the latest published one. */
  async cloneDraftFromVersion(code: string, fromVersionNumber: number): Promise<ChecklistTemplateVersionDefinition> {
    return this.createDraftVersion(code, fromVersionNumber);
  }

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  async addSection(
    code: string,
    versionNumber: number,
    dto: AddSectionDto,
  ): Promise<ChecklistTemplateVersionDefinition> {
    const version = await this.findVersionOrThrow(code, versionNumber);
    this.assertDraft(version);

    const sortOrder = dto.sortOrder ?? version.sections.length;
    await this.prisma.checklistSection.create({
      data: { templateVersionId: version.id, name: dto.name, sortOrder },
    });

    return this.getVersionByNumber(code, versionNumber, CAN_VIEW_DRAFTS);
  }

  async reorderSections(
    code: string,
    versionNumber: number,
    orderedIds: string[],
  ): Promise<ChecklistTemplateVersionDefinition> {
    const version = await this.findVersionOrThrow(code, versionNumber);
    this.assertDraft(version);

    const existingIds = new Set(version.sections.map((section) => section.id));
    if (orderedIds.length !== existingIds.size || !orderedIds.every((id) => existingIds.has(id))) {
      throw new SectionNotFoundException();
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.checklistSection.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    return this.getVersionByNumber(code, versionNumber, CAN_VIEW_DRAFTS);
  }

  // -------------------------------------------------------------------------
  // Items
  // -------------------------------------------------------------------------

  async addItem(
    code: string,
    versionNumber: number,
    sectionId: string,
    dto: AddItemDto,
  ): Promise<ChecklistTemplateVersionDefinition> {
    const version = await this.findVersionOrThrow(code, versionNumber);
    this.assertDraft(version);

    const section = version.sections.find((s) => s.id === sectionId);
    if (!section) throw new SectionNotFoundException();

    this.assertValidItemRules(addItemSchema.safeParse(dto));

    const sortOrder = dto.sortOrder ?? section.items.length;
    await this.prisma.checklistItem.create({
      data: {
        sectionId,
        label: dto.label,
        helpText: dto.helpText,
        sortOrder,
        itemType: (dto.itemType ?? "ACCEPTABLE_UNACCEPTABLE_NA") as ChecklistItemType,
        isRequired: dto.isRequired ?? true,
        allowNotApplicable: dto.allowNotApplicable ?? false,
        requiresEvidenceOnFail: dto.requiresEvidenceOnFail ?? false,
        isCriticalFailure: dto.isCriticalFailure ?? false,
        remarkRequiredOnFail: dto.remarkRequiredOnFail ?? false,
        correctiveActionRequiredOnFail: dto.correctiveActionRequiredOnFail ?? false,
        minValue: dto.minValue,
        maxValue: dto.maxValue,
        defaultResponse: dto.defaultResponse,
        options: dto.options
          ? {
              create: dto.options.map((option, index) => ({
                value: option.value,
                label: option.label,
                sortOrder: option.sortOrder ?? index,
              })),
            }
          : undefined,
      },
    });

    return this.getVersionByNumber(code, versionNumber, CAN_VIEW_DRAFTS);
  }

  async updateItem(
    code: string,
    versionNumber: number,
    itemId: string,
    dto: UpdateItemDto,
  ): Promise<ChecklistTemplateVersionDefinition> {
    const version = await this.findVersionOrThrow(code, versionNumber);
    this.assertDraft(version);

    const item = version.sections.flatMap((s) => s.items).find((i) => i.id === itemId);
    if (!item) throw new ItemNotFoundException();

    this.assertValidItemRules(
      updateItemRulesSchema.safeParse({
        ...dto,
        minValue: dto.minValue ?? (item.minValue ?? undefined),
        maxValue: dto.maxValue ?? (item.maxValue ?? undefined),
        itemType: dto.itemType ?? item.itemType,
        options: dto.options ?? item.options,
      }),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.checklistItem.update({
        where: { id: itemId },
        data: {
          label: dto.label,
          helpText: dto.helpText,
          sortOrder: dto.sortOrder,
          itemType: dto.itemType as ChecklistItemType | undefined,
          isRequired: dto.isRequired,
          allowNotApplicable: dto.allowNotApplicable,
          requiresEvidenceOnFail: dto.requiresEvidenceOnFail,
          isCriticalFailure: dto.isCriticalFailure,
          remarkRequiredOnFail: dto.remarkRequiredOnFail,
          correctiveActionRequiredOnFail: dto.correctiveActionRequiredOnFail,
          minValue: dto.minValue,
          maxValue: dto.maxValue,
          defaultResponse: dto.defaultResponse,
        },
      });

      if (dto.options) {
        await tx.checklistItemOption.deleteMany({ where: { itemId } });
        await tx.checklistItemOption.createMany({
          data: dto.options.map((option, index) => ({
            itemId,
            value: option.value,
            label: option.label,
            sortOrder: option.sortOrder ?? index,
          })),
        });
      }
    });

    return this.getVersionByNumber(code, versionNumber, CAN_VIEW_DRAFTS);
  }

  async reorderItems(
    code: string,
    versionNumber: number,
    sectionId: string,
    orderedIds: string[],
  ): Promise<ChecklistTemplateVersionDefinition> {
    const version = await this.findVersionOrThrow(code, versionNumber);
    this.assertDraft(version);

    const section = version.sections.find((s) => s.id === sectionId);
    if (!section) throw new SectionNotFoundException();

    const existingIds = new Set(section.items.map((item) => item.id));
    if (orderedIds.length !== existingIds.size || !orderedIds.every((id) => existingIds.has(id))) {
      throw new ItemNotFoundException();
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.checklistItem.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    return this.getVersionByNumber(code, versionNumber, CAN_VIEW_DRAFTS);
  }

  // -------------------------------------------------------------------------
  // Publish / archive
  // -------------------------------------------------------------------------

  async publishVersion(
    code: string,
    versionNumber: number,
    userId: string,
    notes: string | undefined,
  ): Promise<ChecklistTemplateVersionDefinition> {
    const version = await this.findVersionOrThrow(code, versionNumber);
    if (version.status !== TemplateStatus.DRAFT) {
      throw new VersionNotDraftException();
    }

    const itemCount = version.sections.reduce((sum, section) => sum + section.items.length, 0);
    if (version.sections.length === 0 || itemCount === 0) {
      throw new EmptyTemplateException();
    }

    await this.prisma.$transaction([
      this.prisma.checklistTemplateVersion.update({
        where: { id: version.id },
        data: {
          status: TemplateStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedById: userId,
          notes,
        },
      }),
      this.prisma.checklistTemplate.update({
        where: { id: version.templateId },
        data: { currentVersionId: version.id },
      }),
    ]);

    return this.getVersionByNumber(code, versionNumber, CAN_VIEW_DRAFTS);
  }

  async archiveVersion(code: string, versionNumber: number): Promise<ChecklistTemplateVersionDefinition> {
    const version = await this.findVersionOrThrow(code, versionNumber);
    if (version.status === TemplateStatus.ARCHIVED) {
      throw new VersionAlreadyArchivedException();
    }

    const template = await this.prisma.checklistTemplate.findUniqueOrThrow({ where: { id: version.templateId } });

    await this.prisma.$transaction([
      this.prisma.checklistTemplateVersion.update({
        where: { id: version.id },
        data: { status: TemplateStatus.ARCHIVED },
      }),
      ...(template.currentVersionId === version.id
        ? [
            this.prisma.checklistTemplate.update({
              where: { id: template.id },
              data: { currentVersionId: null },
            }),
          ]
        : []),
    ]);

    return this.getVersionByNumber(code, versionNumber, CAN_VIEW_DRAFTS);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** Resolves which version (if any) a new draft should clone its content
   *  from: the explicitly-requested version when `fromVersionNumber` is
   *  given, otherwise the template's highest PUBLISHED version, otherwise
   *  `null` (empty draft — e.g. a brand-new template with no history). */
  private async resolveCloneSource(
    template: TemplateWithVersions,
    fromVersionNumber: number | undefined,
  ): Promise<VersionWithContent | null> {
    if (fromVersionNumber !== undefined) {
      return this.findVersionOrThrow(template.code, fromVersionNumber);
    }

    const publishedVersions = template.versions.filter((v) => v.status === TemplateStatus.PUBLISHED);
    if (publishedVersions.length === 0) return null;

    const highest = publishedVersions.reduce((a, b) => (b.versionNumber > a.versionNumber ? b : a));
    return this.prisma.checklistTemplateVersion.findUnique({
      where: { id: highest.id },
      include: VERSION_WITH_CONTENT_INCLUDE,
    });
  }

  private async findTemplateOrThrow(code: string): Promise<TemplateWithVersions> {
    const template = await this.prisma.checklistTemplate.findUnique({
      where: { code },
      include: templateWithVersionsInclude,
    });
    if (!template) throw new TemplateNotFoundException(code);
    return template;
  }

  private async findVersionOrThrow(code: string, versionNumber: number): Promise<VersionWithContent> {
    const template = await this.prisma.checklistTemplate.findUnique({ where: { code } });
    if (!template) throw new TemplateNotFoundException(code);

    const version = await this.prisma.checklistTemplateVersion.findUnique({
      where: { templateId_versionNumber: { templateId: template.id, versionNumber } },
      include: VERSION_WITH_CONTENT_INCLUDE,
    });
    if (!version) throw new TemplateVersionNotFoundException(versionNumber);
    return version;
  }

  private assertDraft(version: VersionWithContent): void {
    if (version.status !== TemplateStatus.DRAFT) {
      throw new VersionNotEditableException();
    }
  }

  private assertValidItemRules(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): void {
    if (!result.success) {
      const message = result.error?.issues.map((issue) => issue.message).join("; ") ?? "Invalid item rules";
      throw new InvalidItemRulesException(message);
    }
  }
}

/** Builds the nested Prisma `create` input that clones a source version's
 *  sections/items/options verbatim (fresh ids, same content and ordering) —
 *  shared by `createDraftVersion`'s default-clone behaviour and
 *  `cloneDraftFromVersion`'s explicit "clone this version" entry point. */
function buildClonedSectionsInput(sections: VersionWithContent["sections"]) {
  return sections.map((section) => ({
    name: section.name,
    sortOrder: section.sortOrder,
    items: {
      create: section.items.map((item) => ({
        label: item.label,
        helpText: item.helpText,
        sortOrder: item.sortOrder,
        itemType: item.itemType,
        isRequired: item.isRequired,
        allowNotApplicable: item.allowNotApplicable,
        requiresEvidenceOnFail: item.requiresEvidenceOnFail,
        isCriticalFailure: item.isCriticalFailure,
        remarkRequiredOnFail: item.remarkRequiredOnFail,
        correctiveActionRequiredOnFail: item.correctiveActionRequiredOnFail,
        minValue: item.minValue,
        maxValue: item.maxValue,
        defaultResponse: item.defaultResponse,
        options: {
          create: item.options.map((option) => ({
            value: option.value,
            label: option.label,
            sortOrder: option.sortOrder,
          })),
        },
      })),
    },
  }));
}
