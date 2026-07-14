import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
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
import { WorkflowCommentDto } from "./dto/workflow-comment.dto";
import { InspectionRecordsService } from "./inspection-records.service";

@ApiTags("inspection-records")
@Controller("inspection-records")
export class InspectionRecordsController {
  constructor(private readonly service: InspectionRecordsService) {}

  @Get("queues/pending-check")
  @RequirePermissions("records:check")
  @ApiOperation({ summary: "List records awaiting supervisor check" })
  listPendingCheck(@CurrentUser() user: RequestUser) {
    return this.service.listPendingCheck(user);
  }

  @Get("queues/pending-verification")
  @RequirePermissions("records:verify")
  @ApiOperation({ summary: "List records awaiting QA verification" })
  listPendingVerification(@CurrentUser() user: RequestUser) {
    return this.service.listPendingVerification(user);
  }

  @Post("cleaning/draft")
  @RequirePermissions("records:create")
  @ApiOperation({
    summary:
      "Create (or resume) today's Daily Cleaning Verification draft for the current operator",
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
    summary:
      "Create (or resume) a Freezer Truck Inspection Before Loading draft for the selected vehicle",
  })
  createTruckDraft(
    @Body() dto: CreateTruckDraftDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.createTruckDraft(user, dto);
  }

  @Post(":id/loading-decision")
  @Roles(
    "FG_SUPERVISOR",
    "QA_EXECUTIVE",
    "FOOD_SAFETY_TEAM_LEADER",
    "SYSTEM_ADMINISTRATOR",
  )
  @RequirePermissions("loading_decisions:approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Record the final freezer truck loading decision (supervisor/QA only; a critical block cannot be overridden)",
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
  @ApiOperation({
    summary:
      "Retrieve an inspection record's header, template version and current responses",
  })
  getById(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.getById(user, id);
  }

  @Patch(":id/draft")
  @RequirePermissions("records:create")
  @ApiOperation({
    summary: "Autosave/save the current draft responses (does not submit)",
  })
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
  @ApiOperation({
    summary: "Validate and submit a record, locking it from further operator edits",
  })
  submit(
    @Param("id") id: string,
    @Body() dto: SubmitRecordDto,
    @CurrentUser() user: RequestUser,
  ): Promise<SubmitRecordResult> {
    return this.service.submit(user, id, dto);
  }

  @Post(":id/check")
  @RequirePermissions("records:check")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Supervisor check — advances to pending verification" })
  check(
    @Param("id") id: string,
    @Body() dto: WorkflowCommentDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.checkRecord(user, id, dto);
  }

  @Post(":id/verify")
  @RequirePermissions("records:verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "QA verify — locks the record as verified" })
  verify(
    @Param("id") id: string,
    @Body() dto: WorkflowCommentDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.verifyRecord(user, id, dto);
  }

  @Post(":id/return")
  @RequirePermissions("records:return")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Return record for operator correction (comment required)" })
  returnForCorrection(
    @Param("id") id: string,
    @Body() dto: WorkflowCommentDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.returnRecord(user, id, dto);
  }

  @Post(":id/reject")
  @RequirePermissions("records:reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject record at verification (comment required)" })
  reject(
    @Param("id") id: string,
    @Body() dto: WorkflowCommentDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.rejectRecord(user, id, dto);
  }

  @Post(":id/void")
  @RequirePermissions("records:void")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Void a verified record (soft archive; comment required)" })
  voidRecord(
    @Param("id") id: string,
    @Body() dto: WorkflowCommentDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InspectionRecordDetail> {
    return this.service.voidRecord(user, id, dto);
  }

  @Get(":id/approvals")
  @RequirePermissions("records:read")
  @ApiOperation({ summary: "Approval / return / reject history timeline" })
  approvalHistory(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.listApprovalHistory(user, id);
  }
}
