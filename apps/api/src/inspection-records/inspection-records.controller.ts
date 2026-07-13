import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { InspectionRecordDetail, SubmitRecordResult } from "@nelna/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/auth.types";
import { CreateCleaningDraftDto } from "./dto/create-cleaning-draft.dto";
import { CreateTruckDraftDto } from "./dto/create-truck-draft.dto";
import { LoadingDecisionDto } from "./dto/loading-decision.dto";
import { SaveDraftDto } from "./dto/save-draft.dto";
import { SubmitRecordDto } from "./dto/submit-record.dto";
import { InspectionRecordsService } from "./inspection-records.service";

@ApiTags("inspection-records")
@Controller("inspection-records")
export class InspectionRecordsController {
  constructor(private readonly service: InspectionRecordsService) {}

  @Post("cleaning/draft")
  @RequirePermissions("records:create")
  @ApiOperation({
    summary: "Create (or resume) today's Daily Cleaning Verification draft for the current operator",
  })
  createCleaningDraft(
    @Body() dto: CreateCleaningDraftDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.createCleaningDraft(user, dto);
  }

  @Post("truck/draft")
  @RequirePermissions("records:create")
  @ApiOperation({
    summary: "Create (or resume) a Freezer Truck Inspection Before Loading draft for the selected vehicle",
  })
  createTruckDraft(
    @Body() dto: CreateTruckDraftDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.createTruckDraft(user, dto);
  }

  @Post(":id/loading-decision")
  @Roles("FG_SUPERVISOR", "QA_EXECUTIVE", "FOOD_SAFETY_TEAM_LEADER", "SYSTEM_ADMINISTRATOR")
  @RequirePermissions("loading_decisions:approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Record the final freezer truck loading decision (supervisor/QA only; a critical block cannot be overridden)",
  })
  approveLoadingDecision(
    @Param("id") id: string,
    @Body() dto: LoadingDecisionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.approveLoadingDecision(user, id, dto);
  }

  @Get(":id")
  @RequirePermissions("records:read")
  @ApiOperation({ summary: "Retrieve an inspection record's header, template version and current responses" })
  getById(@Param("id") id: string, @CurrentUser() user: RequestUser): Promise<InspectionRecordDetail> {
    return this.service.getById(user, id);
  }

  @Patch(":id/draft")
  @RequirePermissions("records:create")
  @ApiOperation({ summary: "Autosave/save the current draft responses (does not submit)" })
  saveDraft(
    @Param("id") id: string,
    @Body() dto: SaveDraftDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.saveDraft(user, id, dto);
  }

  @Post(":id/submit")
  @RequirePermissions("records:create")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Validate and submit a record, locking it from further operator edits" })
  submit(
    @Param("id") id: string,
    @Body() dto: SubmitRecordDto,
    @CurrentUser() user: RequestUser,
  ): Promise<SubmitRecordResult> {
    return this.service.submit(user, id, dto);
  }
}
