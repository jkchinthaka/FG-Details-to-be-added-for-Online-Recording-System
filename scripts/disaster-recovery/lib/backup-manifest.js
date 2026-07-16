/**
 * FG-DR-001 — backup manifest generation and verification (filesystem).
 * Never packages secrets; never writes connection strings into manifests.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/** Canonical application collections (Prisma @@map names). */
const CANONICAL_COLLECTIONS = [
  "users",
  "roles",
  "permissions",
  "user_roles",
  "role_permissions",
  "refresh_tokens",
  "departments",
  "sections",
  "shifts",
  "checklist_templates",
  "checklist_template_versions",
  "checklist_sections",
  "checklist_items",
  "checklist_item_options",
  "task_assignments",
  "inspection_records",
  "inspection_results",
  "inspection_attachments",
  "approval_records",
  "corrective_actions",
  "corrective_action_evidence",
  "vehicles",
  "drivers",
  "transporters",
  "truck_inspection_details",
  "notifications",
  "audit_logs",
  "failure_reasons",
  "corrective_action_categories",
  "temperature_profiles",
  "loading_decision_policies",
];

const GRIDFS_FILES = "fgEvidence.files";
const GRIDFS_CHUNKS = "fgEvidence.chunks";

/**
 * @param {Buffer | string} content
 * @returns {string}
 */
function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * @param {object} input
 * @param {string} input.databaseName
 * @param {Record<string, number>} input.counts
 * @param {Record<string, string>} input.sha256ByRelativePath
 * @param {object[]} [input.indexes]
 * @param {string} [input.toolVersion]
 * @param {string} [input.createdAt]
 * @returns {object}
 */
function buildBackupManifest(input) {
  const {
    databaseName,
    counts,
    sha256ByRelativePath,
    indexes = [],
    toolVersion = "fg-dr-001",
    createdAt = new Date().toISOString(),
  } = input;

  if (!databaseName || typeof databaseName !== "string") {
    throw new Error("databaseName is required");
  }

  return {
    schemaVersion: 1,
    toolVersion,
    createdAt,
    databaseName,
    collections: CANONICAL_COLLECTIONS,
    gridfs: { bucket: "fgEvidence", files: GRIDFS_FILES, chunks: GRIDFS_CHUNKS },
    counts: { ...counts },
    sha256: { ...sha256ByRelativePath },
    indexes,
    safety: {
      containsCredentials: false,
      doNotCommit: true,
      encryptionRequiredAtRest: true,
    },
  };
}

/**
 * Verify a backup directory against its MANIFEST.json.
 * @param {string} backupDir
 * @returns {{ ok: boolean, errors: string[], manifest: object | null }}
 */
function verifyBackupDirectory(backupDir) {
  const errors = [];
  const manifestPath = path.join(backupDir, "MANIFEST.json");
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, errors: ["MANIFEST.json missing"], manifest: null };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return {
      ok: false,
      errors: [`MANIFEST.json unreadable: ${err instanceof Error ? err.message : String(err)}`],
      manifest: null,
    };
  }

  if (!manifest.databaseName) errors.push("manifest.databaseName missing");
  if (!manifest.sha256 || typeof manifest.sha256 !== "object") {
    errors.push("manifest.sha256 missing");
  } else {
    for (const [rel, expected] of Object.entries(manifest.sha256)) {
      const full = path.join(backupDir, rel);
      if (!fs.existsSync(full)) {
        errors.push(`missing artifact: ${rel}`);
        continue;
      }
      const actual = sha256(fs.readFileSync(full));
      if (actual !== expected) {
        errors.push(`hash mismatch: ${rel}`);
      }
    }
  }

  if (manifest.counts && typeof manifest.counts === "object") {
    for (const name of CANONICAL_COLLECTIONS) {
      if (typeof manifest.counts[name] !== "number") {
        errors.push(`count missing for collection: ${name}`);
      }
    }
  } else {
    errors.push("manifest.counts missing");
  }

  return { ok: errors.length === 0, errors, manifest };
}

/**
 * Redact a report object so URLs / secrets never appear in outputs.
 * @param {unknown} value
 * @returns {unknown}
 */
function redactReport(value) {
  if (typeof value === "string") {
    return value
      .replace(/\/\/[^/\s@]*:[^/\s@]*@/g, "//****:****@")
      .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "[REDACTED_MONGO_URI]");
  }
  if (Array.isArray(value)) return value.map(redactReport);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/password|secret|token|uri|connectionstring|database_url/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactReport(v);
      }
    }
    return out;
  }
  return value;
}

module.exports = {
  CANONICAL_COLLECTIONS,
  GRIDFS_FILES,
  GRIDFS_CHUNKS,
  sha256,
  buildBackupManifest,
  verifyBackupDirectory,
  redactReport,
};
