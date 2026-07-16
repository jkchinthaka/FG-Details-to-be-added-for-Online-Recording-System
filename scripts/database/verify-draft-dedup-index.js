/**
 * Read-only verifier for the FG-DB-001 draft deduplication unique index.
 * Never mutates indexes. Allowed: fg_online, fg_online_test.
 *
 * Exit 0 when the correct index is present; exit 1 otherwise.
 *
 * Usage:
 *   node scripts/database/verify-draft-dedup-index.js
 */
const path = require("path");
const { createRequire } = require("module");
const requireFromApi = createRequire(path.join(__dirname, "../../apps/api/package.json"));
const { MongoClient } = requireFromApi("mongodb");
const {
  DRAFT_DEDUP_INDEX_NAME,
  extractDbName,
  redactCredentials,
  assertDatabaseAllowedForDraftDedupIndex,
  isCorrectDraftDedupIndex,
  findIncompatibleDraftDedupIndexes,
} = require("./mongo-index-ensure-rules");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const dbName = extractDbName(url);
  assertDatabaseAllowedForDraftDedupIndex(dbName);

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    const indexes = await db.collection("inspection_records").indexes();
    const desired = indexes.find((i) => i.name === DRAFT_DEDUP_INDEX_NAME);
    const incompatible = findIncompatibleDraftDedupIndexes(indexes);

    if (desired && isCorrectDraftDedupIndex(desired) && incompatible.length === 0) {
      console.log(
        `OK: ${DRAFT_DEDUP_INDEX_NAME} verified on ${db.databaseName}.inspection_records`,
      );
      return;
    }

    console.error(
      `FAIL: draft dedup index incorrect on ${db.databaseName}` +
        ` (desiredPresent=${Boolean(desired && isCorrectDraftDedupIndex(desired))}` +
        `, incompatible=${incompatible.map((i) => i.name).join(",") || "none"})`,
    );
    process.exitCode = 1;
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
