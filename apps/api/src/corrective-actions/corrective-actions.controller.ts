import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CORRECTIVE_ACTION_STATUSES, type CorrectiveActionStatus } from "@nelna/shared";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { CorrectiveActionsService } from "./corrective-actions.service";
import {
  AssignCorrectiveActionDto,
  CancelCorrectiveActionDto,
  CompleteCorrectiveActionDto,
  RejectCorrectiveActionDto,
  VerifyCorrectiveActionDto,
} from "./dto/corrective-action.dto";

@ApiTags("corrective-actions")
@Controller("corrective-actions")
export class CorrectiveActionsController {
  constructor(private readonly service: CorrectiveActionsService) {}

  @Get()
  @RequirePermissions("corrective_actions:read", "corrective_actions:manage")
  @ApiOperation({ summary: "List corrective actions" })
  list(
    @Query("status") status?: string,
    @Query("assignedToId") assignedToId?: string,
    @Query("priority") priority?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize = 20,
  ) {
    const normalizedStatus =
      status && (CORRECTIVE_ACTION_STATUSES as readonly string[]).includes(status)
        ? (status as CorrectiveActionStatus)
        : undefined;
    return this.service.list({
      status: normalizedStatus,
      assignedToId,
      priority,
      page: Math.max(1, page),
      pageSize: Math.min(100, Math.max(1, pageSize)),
    });
  }

  @Get(":id")
  @RequirePermissions("corrective_actions:read", "corrective_actions:manage")
  get(@Param("id") id: string) {
    return this.service.getById(id);
  }

  @Patch(":id/assign")
  @RequirePermissions("corrective_actions:manage")
  assign(
    @Param("id") id: string,
    @Body() dto: AssignCorrectiveActionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.assign(id, dto.assigneeId, dto.dueDate, user.id);
  }

  @Patch(":id/start")
  @RequirePermissions("corrective_actions:manage")
  start(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.start(id, user.id);
  }

  @Patch(":id/complete")
  @RequirePermissions("corrective_actions:manage")
  complete(
    @Param("id") id: string,
    @Body() dto: CompleteCorrectiveActionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.complete(id, dto.completionComment, user.id);
  }

  @Patch(":id/verify")
  @RequirePermissions("corrective_actions:manage", "records:verify")
  verify(
    @Param("id") id: string,
    @Body() dto: VerifyCorrectiveActionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.verify(id, dto.verificationComment, user.id);
  }

  @Patch(":id/reject")
  @RequirePermissions("corrective_actions:manage", "records:verify")
  reject(
    @Param("id") id: string,
    @Body() dto: RejectCorrectiveActionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.reject(id, dto.rejectionReason, user.id);
  }

  @Patch(":id/reopen")
  @RequirePermissions("corrective_actions:manage")
  reopen(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.reopen(id, user.id);
  }

  @Patch(":id/cancel")
  @RequirePermissions("corrective_actions:manage")
  cancel(
    @Param("id") id: string,
    @Body() dto: CancelCorrectiveActionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.cancel(id, dto.cancelReason, user.id);
  }
}
