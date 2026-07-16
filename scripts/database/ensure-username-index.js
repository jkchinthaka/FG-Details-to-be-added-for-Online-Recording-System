/**
 * Ensure a unique sparse/partial username index on users.
 *
 * Approach B: partial unique index on username when the field is a non-null string.
 * This allows documents that have not yet been cut over (missing username) while
 * still enforcing uniqueness for all populated usernames.
 *
 * Also detects and safely replaces Prisma's non-partial `users_username_key`
 * when the desired `users_username_unique_partial` can be applied.
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
const {
  USERNAME_PARTIAL_INDEX_NAME,
  USERNAME_PARTIAL,
  extractDbName,
  redactCredentials,
  assertProductionDatabaseName,
  assertNoDuplicateUsernameGroups,
  isCorrectUsernamePartialIndex,
  findIncompatibleUsernameIndexes,
  planUsernameIndexAction,
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

    try {
      assertNoDuplicateUsernameGroups(duplicates);
    } catch (err) {
      console.error(redactCredentials(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }

    const existing = await col.indexes();
    const action = planUsernameIndexAction(existing);
    const incompatible = findIncompatibleUsernameIndexes(existing);

    if (action === "unchanged") {
      console.log(
        `Index ${USERNAME_PARTIAL_INDEX_NAME} already correct on ${db.databaseName}.users — unchanged`,
      );
    } else {
      // Drop incompatible indexes only after duplicate check passed (safe to replace).
      for (const index of incompatible) {
        await col.dropIndex(index.name);
        console.log(
          `Dropped incompatible username index ${index.name} (safe after duplicate check)`,
        );
      }

      // If desired name existed but was incorrect, it is included in incompatible.
      // If it was correct but leftovers existed, it remains; skip create.
      const afterDrop = await col.indexes();
      const stillDesired = afterDrop.find((i) => i.name === USERNAME_PARTIAL_INDEX_NAME);
      if (stillDesired && isCorrectUsernamePartialIndex(stillDesired)) {
        console.log(
          `Retained correct partial index ${USERNAME_PARTIAL_INDEX_NAME}; removed leftover incompatible indexes`,
        );
      } else {
        if (stillDesired) {
          await col.dropIndex(USERNAME_PARTIAL_INDEX_NAME);
        }
        await col.createIndex(
          { username: 1 },
          {
            unique: true,
            name: USERNAME_PARTIAL_INDEX_NAME,
            partialFilterExpression: USERNAME_PARTIAL,
          },
        );
        console.log(
          `Created partial unique index ${USERNAME_PARTIAL_INDEX_NAME} on ${db.databaseName}.users`,
        );
      }
    }

    const after = await col.indexes();
    const created = after.find((i) => i.name === USERNAME_PARTIAL_INDEX_NAME);
    if (!isCorrectUsernamePartialIndex(created)) {
      throw new Error("Username index verification failed");
    }
    const leftover = findIncompatibleUsernameIndexes(after);
    if (leftover.length > 0) {
      throw new Error(
        `Username index verification failed: leftover incompatible indexes ${leftover
          .map((i) => i.name)
          .join(", ")}`,
      );
    }
    console.log(
      `Verified ${USERNAME_PARTIAL_INDEX_NAME}: unique=true partialFilterExpression=ok`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(redactCredentials(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
