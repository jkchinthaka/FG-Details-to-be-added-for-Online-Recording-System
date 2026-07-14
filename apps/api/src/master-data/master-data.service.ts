import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, Priority } from "../../generated/prisma-client";
import type {
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
import { MasterDataCodeConflictException, MasterDataNotFoundException, PRISMA_UNIQUE_CONSTRAINT_CODE } from "./master-data.errors";

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Departments
  // -------------------------------------------------------------------------

  listDepartments(activeOnly?: boolean) {
    return this.prisma.department.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  createDepartment(dto: CreateDepartmentDto) {
    return this.withUniqueConflict("Department", dto.code, () =>
      this.prisma.department.create({ data: dto }),
    );
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    await this.assertExists("Department", () => this.prisma.department.findUnique({ where: { id } }), id);
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async setDepartmentActive(id: string, isActive: boolean) {
    await this.assertExists("Department", () => this.prisma.department.findUnique({ where: { id } }), id);
    return this.prisma.department.update({ where: { id }, data: { isActive } });
  }

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  listSections(departmentId?: string, activeOnly?: boolean) {
    return this.prisma.section.findMany({
      where: { ...(departmentId ? { departmentId } : {}), ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { name: "asc" },
    });
  }

  createSection(dto: CreateSectionDto) {
    return this.withUniqueConflict("Section", dto.code, () =>
      this.prisma.section.create({ data: dto }),
    );
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    await this.assertExists("Section", () => this.prisma.section.findUnique({ where: { id } }), id);
    return this.prisma.section.update({ where: { id }, data: dto });
  }

  async setSectionActive(id: string, isActive: boolean) {
    await this.assertExists("Section", () => this.prisma.section.findUnique({ where: { id } }), id);
    return this.prisma.section.update({ where: { id }, data: { isActive } });
  }

  // -------------------------------------------------------------------------
  // Shifts
  // -------------------------------------------------------------------------

  listShifts(activeOnly?: boolean) {
    return this.prisma.shift.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  createShift(dto: CreateShiftDto) {
    return this.withUniqueConflict("Shift", dto.code, () => this.prisma.shift.create({ data: dto }));
  }

  async updateShift(id: string, dto: UpdateShiftDto) {
    await this.assertExists("Shift", () => this.prisma.shift.findUnique({ where: { id } }), id);
    return this.prisma.shift.update({ where: { id }, data: dto });
  }

  async setShiftActive(id: string, isActive: boolean) {
    await this.assertExists("Shift", () => this.prisma.shift.findUnique({ where: { id } }), id);
    return this.prisma.shift.update({ where: { id }, data: { isActive } });
  }

  // -------------------------------------------------------------------------
  // Failure reasons
  // -------------------------------------------------------------------------

  listFailureReasons(activeOnly?: boolean) {
    return this.prisma.failureReason.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { label: "asc" },
    });
  }

  createFailureReason(dto: CreateFailureReasonDto) {
    return this.withUniqueConflict("FailureReason", dto.code, () =>
      this.prisma.failureReason.create({ data: dto }),
    );
  }

  async updateFailureReason(id: string, dto: UpdateFailureReasonDto) {
    await this.assertExists("FailureReason", () => this.prisma.failureReason.findUnique({ where: { id } }), id);
    return this.prisma.failureReason.update({ where: { id }, data: dto });
  }

  async setFailureReasonActive(id: string, isActive: boolean) {
    await this.assertExists("FailureReason", () => this.prisma.failureReason.findUnique({ where: { id } }), id);
    return this.prisma.failureReason.update({ where: { id }, data: { isActive } });
  }

  // -------------------------------------------------------------------------
  // Corrective action categories
  // -------------------------------------------------------------------------

  listCorrectiveActionCategories(activeOnly?: boolean) {
    return this.prisma.correctiveActionCategory.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  createCorrectiveActionCategory(dto: CreateCorrectiveActionCategoryDto) {
    return this.withUniqueConflict("CorrectiveActionCategory", dto.code, () =>
      this.prisma.correctiveActionCategory.create({ data: dto }),
    );
  }

  async updateCorrectiveActionCategory(id: string, dto: UpdateCorrectiveActionCategoryDto) {
    await this.assertExists(
      "CorrectiveActionCategory",
      () => this.prisma.correctiveActionCategory.findUnique({ where: { id } }),
      id,
    );
    return this.prisma.correctiveActionCategory.update({ where: { id }, data: dto });
  }

  async setCorrectiveActionCategoryActive(id: string, isActive: boolean) {
    await this.assertExists(
      "CorrectiveActionCategory",
      () => this.prisma.correctiveActionCategory.findUnique({ where: { id } }),
      id,
    );
    return this.prisma.correctiveActionCategory.update({ where: { id }, data: { isActive } });
  }

  // -------------------------------------------------------------------------
  // Temperature profiles
  // -------------------------------------------------------------------------

  listTemperatureProfiles(activeOnly?: boolean) {
    return this.prisma.temperatureProfile.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  createTemperatureProfile(dto: CreateTemperatureProfileDto) {
    return this.withUniqueConflict("TemperatureProfile", dto.code, () =>
      this.prisma.temperatureProfile.create({ data: dto }),
    );
  }

  async updateTemperatureProfile(id: string, dto: UpdateTemperatureProfileDto) {
    await this.assertExists(
      "TemperatureProfile",
      () => this.prisma.temperatureProfile.findUnique({ where: { id } }),
      id,
    );
    return this.prisma.temperatureProfile.update({ where: { id }, data: dto });
  }

  async setTemperatureProfileActive(id: string, isActive: boolean) {
    await this.assertExists(
      "TemperatureProfile",
      () => this.prisma.temperatureProfile.findUnique({ where: { id } }),
      id,
    );
    return this.prisma.temperatureProfile.update({ where: { id }, data: { isActive } });
  }

  // -------------------------------------------------------------------------
  // Priorities — static, read-only (no Nelna-specific policy invented)
  // -------------------------------------------------------------------------

  listPriorities(): Array<{ value: string; label: string }> {
    return Object.values(Priority).map((value) => ({ value, label: PRIORITY_LABELS[value] ?? value }));
  }

  // -------------------------------------------------------------------------
  // Loading decision policies — admin-supplied config only
  // -------------------------------------------------------------------------

  listLoadingDecisionPolicies() {
    return this.prisma.loadingDecisionPolicy.findMany({ orderBy: { key: "asc" } });
  }

  async getLoadingDecisionPolicy(key: string) {
    const policy = await this.prisma.loadingDecisionPolicy.findUnique({ where: { key } });
    if (!policy) throw new MasterDataNotFoundException("LoadingDecisionPolicy", key);
    return policy;
  }

  async upsertLoadingDecisionPolicy(key: string, dto: UpsertLoadingDecisionPolicyDto) {
    return this.prisma.loadingDecisionPolicy.upsert({
      where: { key },
      create: {
        key,
        description: dto.description,
        config: dto.config as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
      update: {
        description: dto.description,
        config: dto.config as Prisma.InputJsonValue,
        isActive: dto.isActive,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async assertExists(
    entityLabel: string,
    find: () => Promise<unknown>,
    id: string,
  ): Promise<void> {
    const record = await find();
    if (!record) throw new MasterDataNotFoundException(entityLabel, id);
  }

  private async withUniqueConflict<T>(entityLabel: string, code: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_CODE) {
        throw new MasterDataCodeConflictException(entityLabel, code);
      }
      throw error;
    }
  }
}
