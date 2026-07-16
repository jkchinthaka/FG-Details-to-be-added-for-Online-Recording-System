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
  /** Full authorized commit SHA when provided (no secrets) */
  commitSha: string | null;
  environment: string;
  timestamp: string;
  checks: HealthChecks;
};

function appVersion(): string {
  return process.env.APP_VERSION?.trim() || "1.0.0";
}

function commitSha(): string | null {
  const raw =
    process.env.GIT_COMMIT_SHA?.trim() ||
    (process.env.RENDER === "true" ? process.env.RENDER_GIT_COMMIT?.trim() : "") ||
    process.env.APP_BUILD_ID?.trim();
  if (!raw) return null;
  return raw;
}

function buildId(): string | null {
  const raw = commitSha();
  if (!raw) return null;
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
      commitSha: commitSha(),
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
      // MongoDB-compatible ping (replaces PostgreSQL `SELECT 1`).
      await this.prisma.$runCommandRaw({ ping: 1 });
      return "up";
    } catch {
      return "down";
    }
  }

  /** GridFS/evidence readiness when FILE_STORAGE_PATH is unset — GridFS is the primary store. */
  private async checkStorage(): Promise<StorageCheckStatus> {
    const root = process.env.FILE_STORAGE_PATH?.trim();
    if (root) {
      try {
        await access(root, fsConstants.R_OK | fsConstants.W_OK);
        return "up";
      } catch {
        return "down";
      }
    }
    // GridFS lives in MongoDB — treat DB ping as storage when no file path configured.
    if (!process.env.DATABASE_URL) {
      return "not_configured";
    }
    try {
      await this.prisma.$runCommandRaw({ ping: 1 });
      return "up";
    } catch {
      return "down";
    }
  }
}
