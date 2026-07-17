/**
 * FG-AUTH-001 — read-only by default cleanup for expired refresh-token rows.
 *
 * Never deletes active (unexpired, unrevoked) tokens. Requires `--execute` to
 * mutate. Never runs during API startup.
 *
 * Usage:
 *   node scripts/database/cleanup-expired-refresh-tokens.js
 *   node scripts/database/cleanup-expired-refresh-tokens.js --execute
 *   node scripts/database/cleanup-expired-refresh-tokens.js --execute --older-than-days=30
 */
const path = require("path");
const { createRequire } = require("module");
const requireFromApi = createRequire(path.join(__dirname, "../../apps/api/package.json"));
const { MongoClient } = requireFromApi("mongodb");

const DEFAULT_OLDER_THAN_DAYS = 7;

function parseArgs(argv) {
  const args = { execute: false, olderThanDays: DEFAULT_OLDER_THAN_DAYS };
  for (const arg of argv) {
    if (arg === "--execute") args.execute = true;
    else if (arg.startsWith("--older-than-days=")) {
      const n = Number(arg.split("=")[1]);
      if (Number.isFinite(n) && n >= 0) args.olderThanDays = n;
    }
  }
  return args;
}

function redactCredentials(message) {
  return String(message).replace(/\/\/[^@]*@/g, "//****:****@");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const cutoff = new Date(Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000);
  const client = new MongoClient(url);
  try {
    await client.connect();
    const col = client.db().collection("refresh_tokens");
    const expiredCount = await col.countDocuments({ expiresAt: { $lt: cutoff } });
    const revokedExpiredCount = await col.countDocuments({
      expiresAt: { $lt: cutoff },
      revokedAt: { $ne: null },
    });

    console.log("=== FG-AUTH-001 expired refresh-token cleanup ===");
    console.log(`database           : ${client.db().databaseName}`);
    console.log(`mode               : ${args.execute ? "EXECUTE" : "READ-ONLY"}`);
    console.log(`older-than-days    : ${args.olderThanDays}`);
    console.log(`cutoff             : ${cutoff.toISOString()}`);
    console.log(`expired rows       : ${expiredCount}`);
    console.log(`revoked+expired    : ${revokedExpiredCount}`);

    if (!args.execute) {
      console.log(
        "\nRead-only run complete. Re-run with --execute to delete expired rows.",
      );
      return;
    }

    const result = await col.deleteMany({ expiresAt: { $lt: cutoff } });
    console.log(`\nDeleted ${result.deletedCount} expired refresh-token rows.`);
  } catch (error) {
    console.error(
      redactCredentials(error instanceof Error ? error.message : String(error)),
    );
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => undefined);
  }
}

main();
