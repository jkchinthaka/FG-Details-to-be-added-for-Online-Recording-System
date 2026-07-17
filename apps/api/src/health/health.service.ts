import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import {
  NELNA_BRAND,
  buildReleaseManifest,
  resolveCommitShaFromEnv,
  type ReleaseManifest,
} from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { MetricsService } from "../metrics/metrics.service";

export type DbCheckStatus = "up" | "down" | "not_configured";
export type StorageCheckStatus = "up" | "down" | "not_configured";

export type HealthChecks = {
  api: "up";
  db: DbCheckStatus;
  storage: StorageCheckStatus;
};

export type DependencyLatency = {
  dbPingMs: number | null;
  storageCheckMs: number | null;
};

export type HealthResponse = {
  status: "healthy" | "degraded";
  service: string;
  product: string;
  /** Semver or release label — never includes secrets or hostnames */
  version: string;
  /** Safe shortened commit SHA (12 chars) — never a random framework build id */
  buildId: string | null;
  /** Full Git commit SHA when available */
  commitSha: string | null;
  environment: string;
  timestamp: string;
  checks: HealthChecks;
};

const SERVICE_NAME = "nelna-fg-api";
const PROCESS_STARTED_AT = new Date().toISOString();

function appVersion(): string {
  return process.env.APP_VERSION?.trim() || "1.0.0";
}

function resolveEnvironmentLabel(): string {
  return (
    process.env.NELNA_DEPLOY_TIER?.trim() || process.env.NODE_ENV?.trim() || "development"
  );
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: process is up. Does not depend on database. */
  getLiveness(): { status: "ok"; service: string } {
    return { status: "ok", service: SERVICE_NAME };
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
    const release = this.tryReleaseManifest();
    return {
      status: degraded ? "degraded" : "healthy",
      service: SERVICE_NAME,
      product: NELNA_BRAND.productName,
      version: appVersion(),
      buildId: release?.shortSha ?? null,
      commitSha: release?.commitSha ?? null,
      environment: resolveEnvironmentLabel(),
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * FG-DEP-001 — Safe release manifest for cross-service alignment checks.
   * Never includes secrets, hostnames or database detail.
   */
  getReleaseManifest(): ReleaseManifest {
    const commitSha = resolveCommitShaFromEnv();
    if (!commitSha) {
      throw new ServiceUnavailableException({
        code: "MISSING_SHA",
        message: "Release commit SHA is not configured for this process",
      });
    }
    const built = buildReleaseManifest({
      commitSha,
      applicationVersion: appVersion(),
      environment: resolveEnvironmentLabel(),
      service: SERVICE_NAME,
      deployedAt: PROCESS_STARTED_AT,
      builtAt: process.env.RELEASE_BUILT_AT?.trim() || PROCESS_STARTED_AT,
    });
    if (!built.ok) {
      throw new ServiceUnavailableException({
        code: built.code,
        message: built.message,
      });
    }
    return built.manifest;
  }

  /** FG-MON-001 — metrics + timed dependency probes (no hostnames/secrets). */
  async getMetricsSnapshot(metrics: MetricsService): Promise<Record<string, unknown>> {
    const release = this.tryReleaseManifest();
    const dependencyLatency = await this.measureDependencyLatency();
    const base = metrics.snapshot({
      buildId: release?.shortSha ?? "unknown",
      commitSha: release?.commitSha ?? "unknown",
      service: SERVICE_NAME,
    });
    return {
      ...base,
      dependencyLatency,
      alerts: {
        documentation: "docs/operations/MONITORING_ALERTS.md",
        runbooks: [
          "docs/operations/MONITORING_ALERTS.md",
          "docs/database/BACKUP_RESTORE_RUNBOOK.md",
        ],
      },
    };
  }

  private async measureDependencyLatency(): Promise<DependencyLatency> {
    let dbPingMs: number | null = null;
    let storageCheckMs: number | null = null;
    if (process.env.DATABASE_URL) {
      const started = Date.now();
      try {
        await this.prisma.$runCommandRaw({ ping: 1 });
        dbPingMs = Date.now() - started;
      } catch {
        dbPingMs = Date.now() - started;
      }
    }
    const storageStarted = Date.now();
    await this.checkStorage();
    storageCheckMs = Date.now() - storageStarted;
    return { dbPingMs, storageCheckMs };
  }

  private tryReleaseManifest(): ReleaseManifest | null {
    try {
      return this.getReleaseManifest();
    } catch {
      return null;
    }
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
