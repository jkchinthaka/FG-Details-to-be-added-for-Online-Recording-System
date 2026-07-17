/**
 * FG-DR-001 — collection reconciliation against isolated fixtures / live DB snapshots.
 */
"use strict";

const crypto = require("crypto");
const { CANONICAL_COLLECTIONS } = require("./backup-manifest");

/**
 * @param {unknown} value
 * @returns {string}
 */
function stableHash(value) {
  const normalized = JSON.stringify(value, Object.keys(value || {}).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Sample up to `limit` document ids and hash their sorted id list.
 * @param {Array<{ _id?: unknown, id?: unknown }>} docs
 * @param {number} [limit]
 */
function sampleIdHash(docs, limit = 50) {
  const ids = docs
    .map((d) => String(d._id ?? d.id ?? ""))
    .filter(Boolean)
    .sort();
  const sample = ids.slice(0, limit);
  return {
    sampleSize: sample.length,
    total: ids.length,
    hash: crypto.createHash("sha256").update(sample.join("|")).digest("hex"),
  };
}

/**
 * Compare source vs target collection snapshots.
 * @param {{
 *   sourceCounts: Record<string, number>,
 *   targetCounts: Record<string, number>,
 *   sourceIndexes?: Record<string, object[]>,
 *   targetIndexes?: Record<string, object[]>,
 *   sourceSamples?: Record<string, ReturnType<typeof sampleIdHash>>,
 *   targetSamples?: Record<string, ReturnType<typeof sampleIdHash>>,
 * }} input
 */
function reconcileCollections(input) {
  const {
    sourceCounts,
    targetCounts,
    sourceIndexes = {},
    targetIndexes = {},
    sourceSamples = {},
    targetSamples = {},
  } = input;

  const countDiffs = [];
  const missingCollections = [];
  const indexDiffs = [];
  const sampleDiffs = [];

  for (const name of CANONICAL_COLLECTIONS) {
    const sc = sourceCounts[name];
    const tc = targetCounts[name];
    if (typeof sc !== "number") missingCollections.push(`source:${name}`);
    if (typeof tc !== "number") missingCollections.push(`target:${name}`);
    if (typeof sc === "number" && typeof tc === "number" && sc !== tc) {
      countDiffs.push({ collection: name, source: sc, target: tc });
    }
  }

  const indexNames = new Set([
    ...Object.keys(sourceIndexes),
    ...Object.keys(targetIndexes),
  ]);
  for (const collection of indexNames) {
    const s = JSON.stringify(sourceIndexes[collection] ?? []);
    const t = JSON.stringify(targetIndexes[collection] ?? []);
    if (s !== t) {
      indexDiffs.push({
        collection,
        sourceIndexCount: (sourceIndexes[collection] ?? []).length,
        targetIndexCount: (targetIndexes[collection] ?? []).length,
        sourceHash: stableHash(sourceIndexes[collection] ?? []),
        targetHash: stableHash(targetIndexes[collection] ?? []),
      });
    }
  }

  for (const name of Object.keys(sourceSamples)) {
    const s = sourceSamples[name];
    const t = targetSamples[name];
    if (!t || s.hash !== t.hash || s.total !== t.total) {
      sampleDiffs.push({
        collection: name,
        source: s,
        target: t ?? null,
      });
    }
  }

  const ok =
    countDiffs.length === 0 &&
    missingCollections.length === 0 &&
    indexDiffs.length === 0 &&
    sampleDiffs.length === 0;

  return {
    ok,
    countDiffs,
    missingCollections,
    indexDiffs,
    sampleDiffs,
    summary: ok
      ? "collection reconciliation PASS"
      : "collection reconciliation FAIL",
  };
}

/**
 * Build a minimal index manifest entry from MongoDB index specs.
 * @param {object[]} indexes
 */
function simplifyIndexManifest(indexes) {
  return (indexes || [])
    .map((idx) => ({
      name: idx.name,
      key: idx.key,
      unique: Boolean(idx.unique),
      sparse: Boolean(idx.sparse),
      partialFilterExpression: idx.partialFilterExpression ?? null,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

module.exports = {
  sampleIdHash,
  reconcileCollections,
  simplifyIndexManifest,
  stableHash,
};
