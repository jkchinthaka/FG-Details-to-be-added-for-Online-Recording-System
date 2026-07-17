/**
 * Ensure sparse/partial unique index on inspection_records.deduplicationKey.
 *
 * Name: inspection_records_deduplicationKey_unique_sparse
 * Key:  { deduplicationKey: 1 }
 * Options: unique + partialFilterExpression on string keys only
 * (do not set sparse — MongoDB rejects sparse + partialFilterExpression).
 *
 * Never uses prisma db push. Allowed databases: fg_online (ops) and
 * fg_online_test (automated tests). Never prints credentials.
 *
 * Usage:
 *   node scripts/database/ensure-draft-dedup-index.js
 */
const path = require("path");
const { createRequire } = require("module");
const requireFromApi = createRequire(path.join(__dirname, "../../apps/api/package.json"));
const { MongoClient } = requireFromApi("mongodb");
const {
  DRAFT_DEDUP_INDEX_NAME,
  DRAFT_DEDUP_PARTIAL,
  extractDbName,
  redactCredentials,
  assertDatabaseAllowedForDraftDedupIndex,
  isCorrectDraftDedupIndex,
  planDraftDedupIndexAction,
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
    if (db.databaseName !== dbName) {
      throw new Error(
        `Refuse: connected database ${db.databaseName} does not match URL database ${dbName}`,
      );
    }

    const col = db.collection("inspection_records");
    const existing = await col.indexes();
    const action = planDraftDedupIndexAction(existing);
    const incompatible = findIncompatibleDraftDedupIndexes(existing);

    if (action === "unchanged") {
      console.log(
        `Index ${DRAFT_DEDUP_INDEX_NAME} already correct on ${db.databaseName}.inspection_records — unchanged`,
      );
      return;
    }

    for (const index of incompatible) {
      await col.dropIndex(index.name);
      console.log(`Dropped incompatible index ${index.name}`);
    }

    const prior = existing.find((i) => i.name === DRAFT_DEDUP_INDEX_NAME);
    if (prior && !isCorrectDraftDedupIndex(prior)) {
      await col.dropIndex(DRAFT_DEDUP_INDEX_NAME);
      console.log(`Dropped incorrect index ${DRAFT_DEDUP_INDEX_NAME}`);
    }

    if (action === "create" || action === "replace") {
      const still = await col.indexes();
      if (!still.some((i) => isCorrectDraftDedupIndex(i))) {
        await col.createIndex(
          { deduplicationKey: 1 },
          {
            name: DRAFT_DEDUP_INDEX_NAME,
            unique: true,
            partialFilterExpression: DRAFT_DEDUP_PARTIAL,
          },
        );
        console.log(
          `Ensured ${DRAFT_DEDUP_INDEX_NAME} on ${db.databaseName}.inspection_records`,
        );
      }
    }
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
