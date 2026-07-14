import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "../../generated/prisma-client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // Connect lazily when DATABASE_URL is present; health endpoints stay available offline.
    if (process.env.DATABASE_URL) {
      try {
        await this.$connect();
      } catch {
        // Local Phase 1 may run without Postgres; connection is required for record APIs later.
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
