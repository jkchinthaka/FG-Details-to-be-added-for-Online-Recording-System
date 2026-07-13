import { Injectable } from "@nestjs/common";
import { NELNA_BRAND } from "@nelna/shared";
import { PrismaService } from "../prisma/prisma.service";

export type DbCheckStatus = "up" | "down" | "not_configured";

export type HealthResponse = {
  status: "healthy";
  service: string;
  product: string;
  version: string;
  environment: string;
  timestamp: string;
  checks: {
    api: "up";
    db: DbCheckStatus;
  };
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthResponse> {
    return {
      status: "healthy",
      service: "nelna-fg-api",
      product: NELNA_BRAND.productName,
      version: "0.1.0",
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
      checks: {
        api: "up",
        db: await this.checkDb(),
      },
    };
  }

  /** Never throws — DB being unreachable must not fail the health endpoint
   *  in local foundation mode where Postgres may not be running yet. */
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
}
