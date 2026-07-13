import type { ChecklistItemType as SharedChecklistItemType, ChecklistItemDefinition, ChecklistSectionDefinition, ChecklistTemplateVersionDefinition } from "@nelna/shared";
import type { Prisma } from "../../generated/prisma-client";

const versionWithContentInclude = {
  sections: {
    include: {
      items: {
        include: { options: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  },
  template: true,
} satisfies Prisma.ChecklistTemplateVersionInclude;

export type VersionWithContent = Prisma.ChecklistTemplateVersionGetPayload<{
  include: typeof versionWithContentInclude;
}>;

export const VERSION_WITH_CONTENT_INCLUDE = versionWithContentInclude;

export function mapVersionToDefinition(version: VersionWithContent): ChecklistTemplateVersionDefinition {
  return {
    id: version.id,
    templateId: version.templateId,
    code: version.template.code,
    title: version.template.title,
    description: version.template.description,
    versionNumber: version.versionNumber,
    status: version.status,
    sections: version.sections.map(mapSectionToDefinition),
  };
}

function mapSectionToDefinition(
  section: VersionWithContent["sections"][number],
): ChecklistSectionDefinition {
  return {
    id: section.id,
    name: section.name,
    sortOrder: section.sortOrder,
    items: section.items.map(mapItemToDefinition),
  };
}

function mapItemToDefinition(
  item: VersionWithContent["sections"][number]["items"][number],
): ChecklistItemDefinition {
  return {
    id: item.id,
    label: item.label,
    helpText: item.helpText,
    sortOrder: item.sortOrder,
    itemType: item.itemType as SharedChecklistItemType,
    isRequired: item.isRequired,
    allowNotApplicable: item.allowNotApplicable,
    requiresEvidenceOnFail: item.requiresEvidenceOnFail,
    isCriticalFailure: item.isCriticalFailure,
    remarkRequiredOnFail: item.remarkRequiredOnFail,
    correctiveActionRequiredOnFail: item.correctiveActionRequiredOnFail,
    minValue: item.minValue,
    maxValue: item.maxValue,
    defaultResponse: item.defaultResponse,
    options: item.options.map((option) => ({
      id: option.id,
      value: option.value,
      label: option.label,
      sortOrder: option.sortOrder,
    })),
  };
}
