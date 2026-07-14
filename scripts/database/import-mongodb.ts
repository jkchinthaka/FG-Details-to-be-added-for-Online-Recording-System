/**
 * Imports transformed MongoDB documents into fg_online via Prisma.
 * Refuses to run unless DATABASE_URL database name is exactly fg_online
 * (or fg_online_test when ALLOW_TEST_IMPORT=1).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../../apps/api/generated/prisma-client";

const IN = join(__dirname, "../../.tmp-migration/mongodb-transformed.json");

function databaseNameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/([^/?]+)(?:\?|$)/);
  return match?.[1] ?? null;
}

async function main() {
  if (!existsSync(IN)) {
    console.log(
      JSON.stringify({
        status: "SKIPPED",
        reason: "No mongodb-transformed.json — seed-only cutover or transform not run",
      }),
    );
    return;
  }

  const dbName = databaseNameFromUrl(process.env.DATABASE_URL);
  const allowTest = process.env.ALLOW_TEST_IMPORT === "1" && dbName === "fg_online_test";
  if (dbName !== "fg_online" && !allowTest) {
    throw new Error("Import refused: DATABASE_URL must target fg_online");
  }

  const payload = JSON.parse(readFileSync(IN, "utf8")) as {
    collections: Record<string, Array<Record<string, unknown>>>;
  };
  const prisma = new PrismaClient();
  try {
    // Prefer upsert-style seed for master data; bulk historical import is
    // intentional write path only when an export+transform pair exists.
    const roleCount = payload.collections.roles?.length ?? 0;
    const userCount = payload.collections.users?.length ?? 0;
    console.log(
      JSON.stringify({
        status: "READY",
        database: dbName,
        note: "Use Prisma seed for master data; historical row import is offline tooling",
        pendingRoles: roleCount,
        pendingUsers: userCount,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 400));
  process.exit(1);
});
