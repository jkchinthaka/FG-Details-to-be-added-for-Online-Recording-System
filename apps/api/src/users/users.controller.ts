import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import {
  RequireAllPermissions,
  RequirePermissions,
} from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { AssignDepartmentDto } from "./dto/assign-department.dto";
import { AssignRolesDto } from "./dto/assign-roles.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("admin-users")
@Controller("admin/users")
@RequirePermissions("users:manage")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: "List users (paginated, filterable by search/department/status/role)",
  })
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
    @Query("departmentId") departmentId?: string,
    @Query("status") status?: string,
    @Query("role") role?: string,
  ) {
    return this.usersService.list({
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
      search,
      departmentId,
      status,
      role,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single user by id" })
  getById(@Param("id") id: string) {
    return this.usersService.getById(id);
  }

  @Get(":id/access-history")
  @ApiOperation({ summary: "Session/login history for a user (no token secrets)" })
  accessHistory(@Param("id") id: string) {
    return this.usersService.accessHistory(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new user" })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: RequestUser) {
    return this.usersService.create(dto, actor.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a user's basic profile fields" })
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reactivate a user" })
  activate(@Param("id") id: string, @CurrentUser() actor: RequestUser) {
    return this.usersService.activate(id, actor.id);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Deactivate a user (blocked for the last active System Administrator)",
  })
  deactivate(@Param("id") id: string, @CurrentUser() actor: RequestUser) {
    return this.usersService.deactivate(id, actor.id);
  }

  @Patch(":id/department")
  @ApiOperation({ summary: "Assign a user's department/section" })
  assignDepartment(@Param("id") id: string, @Body() dto: AssignDepartmentDto) {
    return this.usersService.assignDepartment(id, dto);
  }

  @Patch(":id/roles")
  @RequireAllPermissions("users:manage", "roles:manage")
  @ApiOperation({
    summary:
      "Replace a user's role set (blocked if it would remove the last active admin)",
  })
  assignRoles(
    @Param("id") id: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.assignRoles(id, dto, actor.id);
  }

  @Post(":id/reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Admin-issued temporary password reset (returned once, never stored in plaintext)",
  })
  resetPassword(
    @Param("id") id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.resetPassword(id, dto, actor.id);
  }
}
