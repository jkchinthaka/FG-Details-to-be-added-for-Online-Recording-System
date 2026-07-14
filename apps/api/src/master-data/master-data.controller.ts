import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import {
  CreateCorrectiveActionCategoryDto,
  CreateDepartmentDto,
  CreateFailureReasonDto,
  CreateSectionDto,
  CreateShiftDto,
  CreateTemperatureProfileDto,
  UpdateCorrectiveActionCategoryDto,
  UpdateDepartmentDto,
  UpdateFailureReasonDto,
  UpdateSectionDto,
  UpdateShiftDto,
  UpdateTemperatureProfileDto,
  UpsertLoadingDecisionPolicyDto,
} from "./dto/master-data.dto";
import { MasterDataService } from "./master-data.service";

function parseActiveOnly(activeOnly?: string): boolean | undefined {
  if (activeOnly === undefined) return undefined;
  return activeOnly === "true";
}

@ApiTags("admin-master-data")
@Controller("admin/master-data")
@RequirePermissions("master_data:manage")
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  // ---------------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------------

  @Get("departments")
  listDepartments(@Query("activeOnly") activeOnly?: string) {
    return this.service.listDepartments(parseActiveOnly(activeOnly));
  }

  @Post("departments")
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.service.createDepartment(dto);
  }

  @Patch("departments/:id")
  updateDepartment(@Param("id") id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.updateDepartment(id, dto);
  }

  @Post("departments/:id/activate")
  @HttpCode(HttpStatus.OK)
  activateDepartment(@Param("id") id: string) {
    return this.service.setDepartmentActive(id, true);
  }

  @Post("departments/:id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivateDepartment(@Param("id") id: string) {
    return this.service.setDepartmentActive(id, false);
  }

  // ---------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------

  @Get("sections")
  listSections(@Query("departmentId") departmentId?: string, @Query("activeOnly") activeOnly?: string) {
    return this.service.listSections(departmentId, parseActiveOnly(activeOnly));
  }

  @Post("sections")
  createSection(@Body() dto: CreateSectionDto) {
    return this.service.createSection(dto);
  }

  @Patch("sections/:id")
  updateSection(@Param("id") id: string, @Body() dto: UpdateSectionDto) {
    return this.service.updateSection(id, dto);
  }

  @Post("sections/:id/activate")
  @HttpCode(HttpStatus.OK)
  activateSection(@Param("id") id: string) {
    return this.service.setSectionActive(id, true);
  }

  @Post("sections/:id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivateSection(@Param("id") id: string) {
    return this.service.setSectionActive(id, false);
  }

  // ---------------------------------------------------------------------
  // Shifts
  // ---------------------------------------------------------------------

  @Get("shifts")
  listShifts(@Query("activeOnly") activeOnly?: string) {
    return this.service.listShifts(parseActiveOnly(activeOnly));
  }

  @Post("shifts")
  createShift(@Body() dto: CreateShiftDto) {
    return this.service.createShift(dto);
  }

  @Patch("shifts/:id")
  updateShift(@Param("id") id: string, @Body() dto: UpdateShiftDto) {
    return this.service.updateShift(id, dto);
  }

  @Post("shifts/:id/activate")
  @HttpCode(HttpStatus.OK)
  activateShift(@Param("id") id: string) {
    return this.service.setShiftActive(id, true);
  }

  @Post("shifts/:id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivateShift(@Param("id") id: string) {
    return this.service.setShiftActive(id, false);
  }

  // ---------------------------------------------------------------------
  // Failure reasons
  // ---------------------------------------------------------------------

  @Get("failure-reasons")
  listFailureReasons(@Query("activeOnly") activeOnly?: string) {
    return this.service.listFailureReasons(parseActiveOnly(activeOnly));
  }

  @Post("failure-reasons")
  createFailureReason(@Body() dto: CreateFailureReasonDto) {
    return this.service.createFailureReason(dto);
  }

  @Patch("failure-reasons/:id")
  updateFailureReason(@Param("id") id: string, @Body() dto: UpdateFailureReasonDto) {
    return this.service.updateFailureReason(id, dto);
  }

  @Post("failure-reasons/:id/activate")
  @HttpCode(HttpStatus.OK)
  activateFailureReason(@Param("id") id: string) {
    return this.service.setFailureReasonActive(id, true);
  }

  @Post("failure-reasons/:id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivateFailureReason(@Param("id") id: string) {
    return this.service.setFailureReasonActive(id, false);
  }

  // ---------------------------------------------------------------------
  // Corrective action categories
  // ---------------------------------------------------------------------

  @Get("corrective-action-categories")
  listCorrectiveActionCategories(@Query("activeOnly") activeOnly?: string) {
    return this.service.listCorrectiveActionCategories(parseActiveOnly(activeOnly));
  }

  @Post("corrective-action-categories")
  createCorrectiveActionCategory(@Body() dto: CreateCorrectiveActionCategoryDto) {
    return this.service.createCorrectiveActionCategory(dto);
  }

  @Patch("corrective-action-categories/:id")
  updateCorrectiveActionCategory(@Param("id") id: string, @Body() dto: UpdateCorrectiveActionCategoryDto) {
    return this.service.updateCorrectiveActionCategory(id, dto);
  }

  @Post("corrective-action-categories/:id/activate")
  @HttpCode(HttpStatus.OK)
  activateCorrectiveActionCategory(@Param("id") id: string) {
    return this.service.setCorrectiveActionCategoryActive(id, true);
  }

  @Post("corrective-action-categories/:id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivateCorrectiveActionCategory(@Param("id") id: string) {
    return this.service.setCorrectiveActionCategoryActive(id, false);
  }

  // ---------------------------------------------------------------------
  // Temperature profiles
  // ---------------------------------------------------------------------

  @Get("temperature-profiles")
  listTemperatureProfiles(@Query("activeOnly") activeOnly?: string) {
    return this.service.listTemperatureProfiles(parseActiveOnly(activeOnly));
  }

  @Post("temperature-profiles")
  createTemperatureProfile(@Body() dto: CreateTemperatureProfileDto) {
    return this.service.createTemperatureProfile(dto);
  }

  @Patch("temperature-profiles/:id")
  updateTemperatureProfile(@Param("id") id: string, @Body() dto: UpdateTemperatureProfileDto) {
    return this.service.updateTemperatureProfile(id, dto);
  }

  @Post("temperature-profiles/:id/activate")
  @HttpCode(HttpStatus.OK)
  activateTemperatureProfile(@Param("id") id: string) {
    return this.service.setTemperatureProfileActive(id, true);
  }

  @Post("temperature-profiles/:id/deactivate")
  @HttpCode(HttpStatus.OK)
  deactivateTemperatureProfile(@Param("id") id: string) {
    return this.service.setTemperatureProfileActive(id, false);
  }

  // ---------------------------------------------------------------------
  // Priorities — static read-only list
  // ---------------------------------------------------------------------

  @Get("priorities")
  @ApiOperation({ summary: "Static Priority enum values (no Nelna-specific policy invented)" })
  listPriorities() {
    return this.service.listPriorities();
  }

  // ---------------------------------------------------------------------
  // Loading decision policies — admin-supplied config, stored as-is
  // ---------------------------------------------------------------------

  @Get("loading-decision-policies")
  listLoadingDecisionPolicies() {
    return this.service.listLoadingDecisionPolicies();
  }

  @Get("loading-decision-policies/:key")
  getLoadingDecisionPolicy(@Param("key") key: string) {
    return this.service.getLoadingDecisionPolicy(decodeURIComponent(key));
  }

  @Post("loading-decision-policies/:key")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Create or replace a loading decision policy's stored config (admin-supplied)" })
  upsertLoadingDecisionPolicy(@Param("key") key: string, @Body() dto: UpsertLoadingDecisionPolicyDto) {
    return this.service.upsertLoadingDecisionPolicy(decodeURIComponent(key), dto);
  }
}
