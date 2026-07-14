import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { NELNA_BRAND } from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";

export type DbCheckStatus = "up" | "down" | "not_configured";
export type StorageCheckStatus = "up" | "down" | "not_configured";

export type HealthChecks = {
  api: "up";
  db: DbCheckStatus;
  storage: StorageCheckStatus;
};

export type HealthResponse = {
  status: "healthy" | "degraded";
  service: string;
  product: string;
  /** Semver or release label — never includes secrets or hostnames */
  version: string;
  /** Safe build identifier (commit SHA short / CI build number) if provided */
  buildId: string | null;
  environment: string;
  timestamp: string;
  checks: HealthChecks;
};

function appVersion(): string {
  return process.env.APP_VERSION?.trim() || "0.1.0";
}

function buildId(): string | null {
  const raw = process.env.APP_BUILD_ID?.trim() || process.env.GIT_COMMIT_SHA?.trim();
  if (!raw) return null;
  // Keep public health payload free of long infra paths — truncate to 12 chars.
  return raw.slice(0, 12);
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: process is up. Does not depend on database. */
  getLiveness(): { status: "ok"; service: string } {
    return { status: "ok", service: "nelna-fg-api" };
  }

  /**
   * Readiness: safe to receive traffic. In production, database must be up.
   * Outside production, degraded DB reports as ready so local foundation mode works.
   */
  async getReadiness(): Promise<{ status: "ready" | "not_ready"; checks: HealthChecks }> {
    const checks = await this.collectChecks();
    const isProduction = (process.env.NODE_ENV ?? "development") === "production";
    const dbReady = checks.db === "up" || (!isProduction && checks.db !== "down");
    const storageReady = checks.storage !== "down";
    if (!dbReady || !storageReady) {
      throw new ServiceUnavailableException({
        status: "not_ready",
        checks,
      });
    }
    return { status: "ready", checks };
  }

  async getHealth(): Promise<HealthResponse> {
    const checks = await this.collectChecks();
    const degraded = checks.db === "down" || checks.storage === "down";
    return {
      status: degraded ? "degraded" : "healthy",
      service: "nelna-fg-api",
      product: NELNA_BRAND.productName,
      version: appVersion(),
      buildId: buildId(),
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async collectChecks(): Promise<HealthChecks> {
    return {
      api: "up",
      db: await this.checkDb(),
      storage: await this.checkStorage(),
    };
  }

  private async checkDb(): Promise<DbCheckStatus> {
    if (!process.env.DATABASE_URL) {
      return "not_configured";
    }
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "up";
    } catch {
      return "down";
    }
  }

  /** Optional local/object mount check — never returns bucket credentials. */
  private async checkStorage(): Promise<StorageCheckStatus> {
    const root = process.env.FILE_STORAGE_PATH?.trim();
    if (!root) {
      return "not_configured";
    }
    try {
      await access(root, fsConstants.R_OK | fsConstants.W_OK);
      return "up";
    } catch {
      return "down";
    }
  }
}
