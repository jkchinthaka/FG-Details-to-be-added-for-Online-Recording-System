/**
 * Apply partial unique currentVersionId index on fg_online_test only.
 * Mirrors ensure-sparse-current-version-index.js but refuses production.
 */
const path = require("path");
const { createRequire } = require("module");
const requireFromApi = createRequire(path.join(__dirname, "../../apps/api/package.json"));
const { MongoClient } = requireFromApi("mongodb");
const {
  CURRENT_VERSION_INDEX_NAME,
  CURRENT_VERSION_PARTIAL,
  extractDbName,
  isCorrectCurrentVersionPartialIndex,
  planCurrentVersionIndexAction,
} = require("./mongo-index-ensure-rules");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const dbName = extractDbName(url);
  if (dbName !== "fg_online_test") {
    throw new Error(`Refuse: expected fg_online_test, got ${dbName}`);
  }

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection("checklist_templates");
    const existing = await col.indexes();
    const action = planCurrentVersionIndexAction(existing);
    const prior = existing.find((i) => i.name === CURRENT_VERSION_INDEX_NAME);

    if (action === "unchanged" && prior && isCorrectCurrentVersionPartialIndex(prior)) {
      console.log(`Index already correct on ${db.databaseName}`);
    } else {
      if (prior) {
        await col.dropIndex(CURRENT_VERSION_INDEX_NAME);
        console.log("Dropped incorrect currentVersionId index");
      }
      await col.createIndex(
        { currentVersionId: 1 },
        {
          unique: true,
          name: CURRENT_VERSION_INDEX_NAME,
          partialFilterExpression: CURRENT_VERSION_PARTIAL,
        },
      );
      console.log(`Ensured partial unique index on ${db.databaseName}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(String(error.message || error));
  process.exit(1);
});
