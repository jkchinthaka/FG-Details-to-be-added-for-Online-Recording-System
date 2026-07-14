/**
 * Prisma's @unique on optional MongoDB fields creates a non-sparse unique
 * index that rejects multiple documents with missing/null currentVersionId.
 * PostgreSQL unique constraints allow multiple NULLs; restore that semantics
 * with a partial unique index after every `prisma db push`.
 *
 * Usage (DATABASE_URL required):
 *   node scripts/database/ensure-sparse-current-version-index.js
 */
const path = require("path");
const { createRequire } = require("module");
const requireFromApi = createRequire(path.join(__dirname, "../../apps/api/package.json"));
const { MongoClient } = requireFromApi("mongodb");

const INDEX_NAME = "checklist_templates_currentVersionId_key";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection("checklist_templates");

    const existing = await col.indexes();
    const prior = existing.find((i) => i.name === INDEX_NAME);
    if (prior) {
      await col.dropIndex(INDEX_NAME);
      console.log(`Dropped non-partial index ${INDEX_NAME}`);
    }

    await col.createIndex(
      { currentVersionId: 1 },
      {
        unique: true,
        name: INDEX_NAME,
        partialFilterExpression: {
          currentVersionId: { $exists: true, $type: "objectId" },
        },
      },
    );
    console.log(
      `Ensured sparse/partial unique index ${INDEX_NAME} on ${db.databaseName}.checklist_templates`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
