/**
 * Ensure a unique sparse/partial username index on users.
 *
 * Approach B: partial unique index on username when the field is a non-null string.
 * This allows documents that have not yet been cut over (missing username) while
 * still enforcing uniqueness for all populated usernames.
 *
 * DATABASE_URL must target fg_online. Never prints credentials.
 *
 * Usage:
 *   node scripts/database/ensure-username-index.js
 */
const path = require("path");
const { createRequire } = require("module");
const requireFromApi = createRequire(path.join(__dirname, "../../apps/api/package.json"));
const { MongoClient } = requireFromApi("mongodb");

const INDEX_NAME = "users_username_unique_partial";
const REQUIRED_DB = "fg_online";

function extractDbName(url) {
  const withoutProtocol = url.replace(/^mongodb(\+srv)?:\/\//i, "");
  const afterAuth = withoutProtocol.includes("@")
    ? withoutProtocol.slice(withoutProtocol.lastIndexOf("@") + 1)
    : withoutProtocol;
  const pathAndQuery = afterAuth.includes("/")
    ? afterAuth.slice(afterAuth.indexOf("/") + 1)
    : "";
  return (pathAndQuery.split("?")[0] || "").trim() || null;
}

function redact(message) {
  return String(message)
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, "mongodb://[redacted]")
    .replace(/[a-z0-9._%+-]+:[^@\s]+@/gi, "[redacted-userinfo]@");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const dbName = extractDbName(url);
  if (dbName !== REQUIRED_DB) {
    console.error(`Refuse: database must be ${REQUIRED_DB} (got ${dbName ?? "none"})`);
    process.exit(1);
  }

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection("users");

    const duplicates = await col
      .aggregate([
        { $match: { username: { $type: "string" } } },
        {
          $group: {
            _id: { $toLower: "$username" },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (duplicates.length > 0) {
      console.error(
        `Refuse: ${duplicates.length} duplicate username group(s) — resolve before indexing`,
      );
      process.exit(1);
    }

    const existing = await col.indexes();
    const prior = existing.find((i) => i.name === INDEX_NAME);
    if (prior) {
      console.log(`Index ${INDEX_NAME} already present on ${db.databaseName}.users`);
    } else {
      await col.createIndex(
        { username: 1 },
        {
          unique: true,
          name: INDEX_NAME,
          partialFilterExpression: {
            username: { $exists: true, $type: "string" },
          },
        },
      );
      console.log(
        `Created partial unique index ${INDEX_NAME} on ${db.databaseName}.users`,
      );
    }

    const after = await col.indexes();
    const created = after.find((i) => i.name === INDEX_NAME);
    if (!created || !created.unique) {
      throw new Error("Username index verification failed");
    }
    console.log(
      `Verified ${INDEX_NAME}: unique=${Boolean(created.unique)} partial=${Boolean(
        created.partialFilterExpression,
      )}`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(redact(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
