/**
 * Pure helpers for MongoDB partial unique index ensure scripts.
 * Never log credentials or full DATABASE_URL.
 */

const PRODUCTION_DB_NAME = "fg_online";

const CURRENT_VERSION_INDEX_NAME = "checklist_templates_currentVersionId_key";
const CURRENT_VERSION_PARTIAL = {
  currentVersionId: { $exists: true, $type: "objectId" },
};

const USERNAME_PARTIAL_INDEX_NAME = "users_username_unique_partial";
const USERNAME_PRISMA_INDEX_NAME = "users_username_key";
const USERNAME_PARTIAL = {
  username: { $exists: true, $type: "string" },
};

const DRAFT_DEDUP_INDEX_NAME = "inspection_records_deduplicationKey_unique_sparse";
const DRAFT_DEDUP_PARTIAL = {
  deduplicationKey: { $exists: true, $type: "string" },
};
const DRAFT_DEDUP_ALLOWED_DBS = new Set(["fg_online", "fg_online_test"]);

function extractDbName(url) {
  if (!url || typeof url !== "string" || !url.trim()) {
    return null;
  }
  const withoutProtocol = url.trim().replace(/^mongodb(\+srv)?:\/\//i, "");
  const afterAuth = withoutProtocol.includes("@")
    ? withoutProtocol.slice(withoutProtocol.lastIndexOf("@") + 1)
    : withoutProtocol;
  const pathAndQuery = afterAuth.includes("/")
    ? afterAuth.slice(afterAuth.indexOf("/") + 1)
    : "";
  return (pathAndQuery.split("?")[0] || "").trim() || null;
}

function redactCredentials(message) {
  return String(message)
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, "mongodb://[redacted]")
    .replace(/[a-z0-9._%+-]+:[^@\s]+@/gi, "[redacted-userinfo]@")
    .replace(/password[=:]\S+/gi, "password=[redacted]")
    .replace(/\b[a-z0-9-]+\.mongodb\.net\b/gi, "[redacted-host]");
}

function assertProductionDatabaseName(databaseName) {
  if (databaseName !== PRODUCTION_DB_NAME) {
    throw new Error(
      `Refuse: database must be ${PRODUCTION_DB_NAME} (got ${databaseName ?? "none"})`,
    );
  }
}

function assertDatabaseAllowedForDraftDedupIndex(databaseName) {
  if (!DRAFT_DEDUP_ALLOWED_DBS.has(databaseName)) {
    throw new Error(
      `Refuse: draft dedup index scripts allow only fg_online or fg_online_test (got ${databaseName ?? "none"})`,
    );
  }
}

function isCorrectDraftDedupIndex(index) {
  if (!index || index.name !== DRAFT_DEDUP_INDEX_NAME) {
    return false;
  }
  if (index.unique !== true) {
    return false;
  }
  if (!indexKeyEquals(index, { deduplicationKey: 1 })) {
    return false;
  }
  // MongoDB forbids mixing sparse with partialFilterExpression — use partial only.
  if (index.sparse === true) {
    return false;
  }
  return partialFiltersEqual(index.partialFilterExpression, DRAFT_DEDUP_PARTIAL);
}

function findIncompatibleDraftDedupIndexes(indexes) {
  return (indexes || []).filter((index) => {
    if (!index || index.name === "_id_") {
      return false;
    }
    if (isCorrectDraftDedupIndex(index)) {
      return false;
    }
    const isDedupKey =
      indexKeyEquals(index, { deduplicationKey: 1 }) ||
      index.name === DRAFT_DEDUP_INDEX_NAME ||
      index.name === "inspection_records_deduplicationKey_key";
    return isDedupKey;
  });
}

/**
 * @returns {"unchanged"|"create"|"replace"}
 */
function planDraftDedupIndexAction(existingIndexes) {
  const indexes = existingIndexes || [];
  const desired = indexes.find((index) => index.name === DRAFT_DEDUP_INDEX_NAME);
  const incompatible = findIncompatibleDraftDedupIndexes(indexes);

  if (desired && isCorrectDraftDedupIndex(desired) && incompatible.length === 0) {
    return "unchanged";
  }
  if (!desired && incompatible.length === 0) {
    return "create";
  }
  return "replace";
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function partialFiltersEqual(actual, expected) {
  if (!actual || !expected) {
    return false;
  }
  return stableStringify(actual) === stableStringify(expected);
}

function indexKeyEquals(index, expectedKey) {
  if (!index || !index.key || typeof index.key !== "object") {
    return false;
  }
  return stableStringify(index.key) === stableStringify(expectedKey);
}

function isCorrectCurrentVersionPartialIndex(index) {
  if (!index || index.name !== CURRENT_VERSION_INDEX_NAME) {
    return false;
  }
  if (index.unique !== true) {
    return false;
  }
  if (!indexKeyEquals(index, { currentVersionId: 1 })) {
    return false;
  }
  return partialFiltersEqual(index.partialFilterExpression, CURRENT_VERSION_PARTIAL);
}

function isCorrectUsernamePartialIndex(index) {
  if (!index || index.name !== USERNAME_PARTIAL_INDEX_NAME) {
    return false;
  }
  if (index.unique !== true) {
    return false;
  }
  if (!indexKeyEquals(index, { username: 1 })) {
    return false;
  }
  return partialFiltersEqual(index.partialFilterExpression, USERNAME_PARTIAL);
}

/**
 * Username indexes that conflict with the desired partial unique index.
 * Includes Prisma's non-partial `users_username_key` and any other unique
 * username index that is not the desired partial.
 */
function findIncompatibleUsernameIndexes(indexes) {
  return (indexes || []).filter((index) => {
    if (!index || index.name === "_id_") {
      return false;
    }
    if (isCorrectUsernamePartialIndex(index)) {
      return false;
    }
    const isUsernameKey =
      indexKeyEquals(index, { username: 1 }) ||
      index.name === USERNAME_PRISMA_INDEX_NAME ||
      index.name === USERNAME_PARTIAL_INDEX_NAME;
    if (!isUsernameKey) {
      return false;
    }
    // Unique non-partial, wrong partial, or Prisma default name on username
    return index.unique === true || index.name === USERNAME_PRISMA_INDEX_NAME;
  });
}

/**
 * Decide whether the currentVersion index should be left alone, created, or replaced.
 * @returns {"unchanged"|"create"|"replace"}
 */
function planCurrentVersionIndexAction(existingIndexes) {
  const prior = (existingIndexes || []).find(
    (index) => index.name === CURRENT_VERSION_INDEX_NAME,
  );
  if (!prior) {
    return "create";
  }
  if (isCorrectCurrentVersionPartialIndex(prior)) {
    return "unchanged";
  }
  return "replace";
}

/**
 * @returns {"unchanged"|"create"|"replace"}
 */
function planUsernameIndexAction(existingIndexes) {
  const indexes = existingIndexes || [];
  const desired = indexes.find((index) => index.name === USERNAME_PARTIAL_INDEX_NAME);
  const incompatible = findIncompatibleUsernameIndexes(indexes);

  if (desired && isCorrectUsernamePartialIndex(desired) && incompatible.length === 0) {
    return "unchanged";
  }
  if (desired && isCorrectUsernamePartialIndex(desired) && incompatible.length > 0) {
    // Desired partial is fine; still need to drop leftover Prisma/other indexes.
    return "replace";
  }
  if (!desired && incompatible.length === 0) {
    return "create";
  }
  return "replace";
}

/** Call before any username index drop/create. */
function assertNoDuplicateUsernameGroups(duplicates) {
  const count = Array.isArray(duplicates) ? duplicates.length : 0;
  if (count > 0) {
    throw new Error(
      `Refuse: ${count} duplicate username group(s) — resolve before indexing`,
    );
  }
}

module.exports = {
  PRODUCTION_DB_NAME,
  CURRENT_VERSION_INDEX_NAME,
  CURRENT_VERSION_PARTIAL,
  USERNAME_PARTIAL_INDEX_NAME,
  USERNAME_PRISMA_INDEX_NAME,
  USERNAME_PARTIAL,
  DRAFT_DEDUP_INDEX_NAME,
  DRAFT_DEDUP_PARTIAL,
  DRAFT_DEDUP_ALLOWED_DBS,
  extractDbName,
  redactCredentials,
  assertProductionDatabaseName,
  assertDatabaseAllowedForDraftDedupIndex,
  assertNoDuplicateUsernameGroups,
  partialFiltersEqual,
  isCorrectCurrentVersionPartialIndex,
  isCorrectUsernamePartialIndex,
  isCorrectDraftDedupIndex,
  findIncompatibleUsernameIndexes,
  findIncompatibleDraftDedupIndexes,
  planCurrentVersionIndexAction,
  planUsernameIndexAction,
  planDraftDedupIndexAction,
};
