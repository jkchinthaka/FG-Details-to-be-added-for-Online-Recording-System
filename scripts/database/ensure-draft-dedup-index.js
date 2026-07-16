/**
 * Ensures a sparse unique index on inspection_records.deduplicationKey.
 * Never uses prisma db push. Safe for fg_online and fg_online_test.
 */
const { MongoClient } = require("mongodb");
const {
  extractDbName,
  redactCredentials,
} = require("./mongo-index-ensure-rules");

const INDEX_NAME = "inspection_records_deduplicationKey_unique_sparse";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const dbName = extractDbName(url);
  if (!dbName) {
    throw new Error("DATABASE_URL must include a database name");
  }

  const client = new MongoClient(url);
  try {
    await client.connect();
    const collection = client.db(dbName).collection("inspection_records");
    const existing = await collection.indexes();
    const found = existing.find((idx) => idx.name === INDEX_NAME);
    if (found) {
      console.log(`Index ${INDEX_NAME} already present on ${dbName}`);
      return;
    }
    await collection.createIndex(
      { deduplicationKey: 1 },
      {
        name: INDEX_NAME,
        unique: true,
        sparse: true,
        partialFilterExpression: {
          deduplicationKey: { $exists: true, $type: "string" },
        },
      },
    );
    console.log(`Created ${INDEX_NAME} on ${dbName}`);
  } catch (error) {
    console.error(redactCredentials(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => undefined);
  }
}

main();
