/**
 * Ensure partial unique index on checklist_templates.currentVersionId.
 *
 * Prisma `@unique` on optional MongoDB fields creates a non-sparse unique index
 * that rejects multiple documents with missing/null currentVersionId.
 * This script keeps the required partial unique index (same Prisma name) and
 * never weakens it.
 *
 * Production index sync must use this script — not `prisma db push` — because
 * Prisma cannot express the partial filter and will conflict (IndexKeySpecsConflict).
 *
 * DATABASE_URL must target fg_online. Never prints credentials.
 *
 * Usage:
 *   node scripts/database/ensure-sparse-current-version-index.js
 */
const path = require("path");
const { createRequire } = require("module");
const requireFromApi = createRequire(path.join(__dirname, "../../apps/api/package.json"));
const { MongoClient } = requireFromApi("mongodb");
const {
  CURRENT_VERSION_INDEX_NAME,
  CURRENT_VERSION_PARTIAL,
  extractDbName,
  redactCredentials,
  assertProductionDatabaseName,
  isCorrectCurrentVersionPartialIndex,
  planCurrentVersionIndexAction,
} = require("./mongo-index-ensure-rules");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const dbName = extractDbName(url);
  assertProductionDatabaseName(dbName);

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    if (db.databaseName !== dbName) {
      throw new Error(
        `Refuse: connected database ${db.databaseName} does not match URL database ${dbName}`,
      );
    }

    const col = db.collection("checklist_templates");
    const existing = await col.indexes();
    const action = planCurrentVersionIndexAction(existing);
    const prior = existing.find((i) => i.name === CURRENT_VERSION_INDEX_NAME);

    if (action === "unchanged") {
      console.log(
        `Index ${CURRENT_VERSION_INDEX_NAME} already correct (unique partial) on ${db.databaseName}.checklist_templates — unchanged`,
      );
    } else {
      if (prior) {
        await col.dropIndex(CURRENT_VERSION_INDEX_NAME);
        console.log(
          `Dropped incorrect index ${CURRENT_VERSION_INDEX_NAME} (will recreate as partial unique)`,
        );
      }

      await col.createIndex(
        { currentVersionId: 1 },
        {
          unique: true,
          name: CURRENT_VERSION_INDEX_NAME,
          partialFilterExpression: CURRENT_VERSION_PARTIAL,
        },
      );
      console.log(
        `Ensured partial unique index ${CURRENT_VERSION_INDEX_NAME} on ${db.databaseName}.checklist_templates`,
      );
    }

    const after = await col.indexes();
    const verified = after.find((i) => i.name === CURRENT_VERSION_INDEX_NAME);
    if (!isCorrectCurrentVersionPartialIndex(verified)) {
      throw new Error("currentVersionId index verification failed");
    }
    console.log(
      `Verified ${CURRENT_VERSION_INDEX_NAME}: unique=true partialFilterExpression=ok`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(redactCredentials(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
