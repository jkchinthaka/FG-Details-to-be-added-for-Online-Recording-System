import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Patch,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  ChecklistTemplateSummary,
  ChecklistTemplateVersionDefinition,
} from "@nelna/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { ChecklistTemplatesService } from "./checklist-templates.service";
import { AddItemDto } from "./dto/add-item.dto";
import { AddSectionDto } from "./dto/add-section.dto";
import { CreateDraftVersionDto } from "./dto/create-draft-version.dto";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { PublishVersionDto } from "./dto/publish-version.dto";
import { ReorderDto } from "./dto/reorder.dto";
import { UpdateItemDto } from "./dto/update-item.dto";

@ApiTags("checklist-templates")
@Controller("checklist-templates")
export class ChecklistTemplatesController {
  constructor(private readonly service: ChecklistTemplatesService) {}

  // ---------------------------------------------------------------------
  // Reads — literal-prefixed routes registered before the `:code` catch-all
  // ---------------------------------------------------------------------

  @Get("published")
  @ApiOperation({ summary: "List every template that currently has a published version" })
  listPublished(): Promise<ChecklistTemplateSummary[]> {
    return this.service.listPublished();
  }

  @Get()
  @RequirePermissions("templates:manage", "templates:publish")
  @ApiOperation({ summary: "List all checklist templates, including drafts (admin)" })
  listAll(): Promise<ChecklistTemplateSummary[]> {
    return this.service.listAll();
  }

  @Post()
  @RequirePermissions("templates:manage")
  @ApiOperation({ summary: "Create a new checklist template with an empty draft v1" })
  createTemplate(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.createTemplate(dto, user.id);
  }

  @Get(":code/published")
  @ApiOperation({
    summary: "Retrieve a template's current published version (full sections/items)",
  })
  getPublishedVersion(
    @Param("code") code: string,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.getPublishedVersion(decodeURIComponent(code));
  }

  @Get(":code/versions/:versionNumber")
  @ApiOperation({ summary: "Retrieve a specific template version by number" })
  getVersion(
    @Param("code") code: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
    @CurrentUser() user: RequestUser,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.getVersionByNumber(
      decodeURIComponent(code),
      versionNumber,
      user.permissions,
    );
  }

  @Get(":code")
  @RequirePermissions("templates:manage", "templates:publish")
  @ApiOperation({ summary: "Retrieve a template's metadata and version history (admin)" })
  getTemplateSummary(@Param("code") code: string): Promise<ChecklistTemplateSummary> {
    return this.service.getTemplateSummary(decodeURIComponent(code));
  }

  // ---------------------------------------------------------------------
  // Draft authoring — all require templates:manage
  // ---------------------------------------------------------------------

  @Post(":code/versions")
  @RequirePermissions("templates:manage")
  @ApiOperation({
    summary:
      "Create a new draft version for an existing template — clones the highest published version by default, or `fromVersionNumber` when given",
  })
  createDraftVersion(
    @Param("code") code: string,
    @Body() dto?: CreateDraftVersionDto,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.createDraftVersion(
      decodeURIComponent(code),
      dto?.fromVersionNumber,
    );
  }

  @Post(":code/versions/:versionNumber/clone")
  @RequirePermissions("templates:manage")
  @ApiOperation({
    summary: "Create a new draft version by cloning a specific existing version",
  })
  cloneDraftFromVersion(
    @Param("code") code: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.cloneDraftFromVersion(decodeURIComponent(code), versionNumber);
  }

  @Post(":code/versions/:versionNumber/sections")
  @RequirePermissions("templates:manage")
  @ApiOperation({ summary: "Add a section to a draft version" })
  addSection(
    @Param("code") code: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
    @Body() dto: AddSectionDto,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.addSection(decodeURIComponent(code), versionNumber, dto);
  }

  @Patch(":code/versions/:versionNumber/sections/reorder")
  @RequirePermissions("templates:manage")
  @ApiOperation({ summary: "Reorder a draft version's sections" })
  reorderSections(
    @Param("code") code: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
    @Body() dto: ReorderDto,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.reorderSections(
      decodeURIComponent(code),
      versionNumber,
      dto.orderedIds,
    );
  }

  @Post(":code/versions/:versionNumber/sections/:sectionId/items")
  @RequirePermissions("templates:manage")
  @ApiOperation({
    summary: "Add an item (with its response type and rules) to a draft section",
  })
  addItem(
    @Param("code") code: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
    @Param("sectionId") sectionId: string,
    @Body() dto: AddItemDto,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.addItem(decodeURIComponent(code), versionNumber, sectionId, dto);
  }

  @Patch(":code/versions/:versionNumber/sections/:sectionId/items/reorder")
  @RequirePermissions("templates:manage")
  @ApiOperation({ summary: "Reorder a draft section's items" })
  reorderItems(
    @Param("code") code: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
    @Param("sectionId") sectionId: string,
    @Body() dto: ReorderDto,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.reorderItems(
      decodeURIComponent(code),
      versionNumber,
      sectionId,
      dto.orderedIds,
    );
  }

  @Patch(":code/versions/:versionNumber/items/:itemId")
  @RequirePermissions("templates:manage")
  @ApiOperation({
    summary: "Update a draft item's label, response type or validation rules",
  })
  updateItem(
    @Param("code") code: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateItemDto,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.updateItem(decodeURIComponent(code), versionNumber, itemId, dto);
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  @Post(":code/versions/:versionNumber/publish")
  @RequirePermissions("templates:publish")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Publish a draft version (immutable afterwards)" })
  publishVersion(
    @Param("code") code: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
    @Body() dto: PublishVersionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.publishVersion(
      decodeURIComponent(code),
      versionNumber,
      user.id,
      dto.notes,
    );
  }

  @Post(":code/versions/:versionNumber/archive")
  @RequirePermissions("templates:manage", "templates:publish")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive a template version (draft or published)" })
  archiveVersion(
    @Param("code") code: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
  ): Promise<ChecklistTemplateVersionDefinition> {
    return this.service.archiveVersion(decodeURIComponent(code), versionNumber);
  }
}
