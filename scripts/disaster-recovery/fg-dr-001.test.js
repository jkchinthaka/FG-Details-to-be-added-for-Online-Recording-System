/**
 * FG-DR-001 — automated fixture tests for disaster-recovery tooling.
 * Run: node --test scripts/disaster-recovery/fg-dr-001.test.js
 */
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { validateIsolatedRestoreTarget } = require("./lib/restore-target-validator");
const {
  databaseNameFromUrl,
  isAllowedRestoreTargetName,
  isProductionDatabaseName,
} = require("./lib/database-url");
const {
  buildBackupManifest,
  verifyBackupDirectory,
  redactReport,
  CANONICAL_COLLECTIONS,
  sha256,
} = require("./lib/backup-manifest");
const { reconcileCollections, simplifyIndexManifest } = require("./lib/collection-reconcile");
const { reconcileGridFs } = require("./lib/gridfs-reconcile");
const { checkInvariants } = require("./lib/invariant-checks");
const { buildRpoRtoRecord } = require("./lib/rpo-rto");

const SOURCE =
  "mongodb://user:secret@127.0.0.1:27017/fg_online?replicaSet=rs0&directConnection=true";
const TARGET_OK =
  "mongodb://user:secret@127.0.0.1:27017/fg_online_restore_test?replicaSet=rs0&directConnection=true";

describe("FG-DR-001 restore target validator", () => {
  it("accepts explicit allow flag with distinct isolated target", () => {
    const result = validateIsolatedRestoreTarget({
      ALLOW_ISOLATED_RESTORE_TEST: "YES",
      BACKUP_SOURCE_DATABASE_URL: SOURCE,
      RESTORE_TEST_DATABASE_URL: TARGET_OK,
    });
    assert.equal(result.ok, true);
    assert.equal(result.sourceDatabase, "fg_online");
    assert.equal(result.targetDatabase, "fg_online_restore_test");
  });

  it("rejects missing allow flag", () => {
    const result = validateIsolatedRestoreTarget({
      ALLOW_ISOLATED_RESTORE_TEST: "no",
      BACKUP_SOURCE_DATABASE_URL: SOURCE,
      RESTORE_TEST_DATABASE_URL: TARGET_OK,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("ALLOW_ISOLATED_RESTORE_TEST")));
  });

  it("rejects identical source and target URLs", () => {
    const result = validateIsolatedRestoreTarget({
      ALLOW_ISOLATED_RESTORE_TEST: "YES",
      BACKUP_SOURCE_DATABASE_URL: TARGET_OK,
      RESTORE_TEST_DATABASE_URL: TARGET_OK,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /identical/i.test(e)));
  });

  it("rejects production fg_online target", () => {
    const result = validateIsolatedRestoreTarget({
      ALLOW_ISOLATED_RESTORE_TEST: "YES",
      BACKUP_SOURCE_DATABASE_URL: TARGET_OK,
      RESTORE_TEST_DATABASE_URL: SOURCE,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /fg_online/.test(e)));
    assert.equal(isProductionDatabaseName("fg_online"), true);
    assert.equal(isAllowedRestoreTargetName("fg_online"), false);
  });

  it("rejects malformed database names", () => {
    const result = validateIsolatedRestoreTarget({
      ALLOW_ISOLATED_RESTORE_TEST: "YES",
      BACKUP_SOURCE_DATABASE_URL:
        "mongodb://user:secret@127.0.0.1:27017/bad-name!@?replicaSet=rs0",
      RESTORE_TEST_DATABASE_URL: TARGET_OK,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /malformed/i.test(e)));
  });

  it("parses database names without exposing credentials", () => {
    assert.equal(databaseNameFromUrl(SOURCE), "fg_online");
    assert.equal(databaseNameFromUrl(TARGET_OK), "fg_online_restore_test");
  });
});

describe("FG-DR-001 backup manifest + verification", () => {
  it("writes and verifies a fixture backup directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fg-dr-backup-"));
    const counts = Object.fromEntries(CANONICAL_COLLECTIONS.map((c) => [c, 0]));
    counts.users = 1;
    counts.inspection_records = 1;
    counts["fgEvidence.files"] = 0;
    counts["fgEvidence.chunks"] = 0;

    const usersPath = path.join(dir, "users.json");
    fs.writeFileSync(usersPath, JSON.stringify([{ id: "u1" }]));
    const sha256ByRelativePath = {
      "users.json": sha256(fs.readFileSync(usersPath)),
    };
    const manifest = buildBackupManifest({
      databaseName: "fg_online_restore_test",
      counts,
      sha256ByRelativePath,
    });
    fs.writeFileSync(path.join(dir, "MANIFEST.json"), JSON.stringify(manifest, null, 2));

    const verified = verifyBackupDirectory(dir);
    assert.equal(verified.ok, true, verified.errors.join("; "));
  });

  it("fails verification on hash mismatch", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fg-dr-backup-bad-"));
    const counts = Object.fromEntries(CANONICAL_COLLECTIONS.map((c) => [c, 0]));
    fs.writeFileSync(path.join(dir, "users.json"), "[]");
    const manifest = buildBackupManifest({
      databaseName: "fg_online_test",
      counts,
      sha256ByRelativePath: { "users.json": "0".repeat(64) },
    });
    fs.writeFileSync(path.join(dir, "MANIFEST.json"), JSON.stringify(manifest));
    const verified = verifyBackupDirectory(dir);
    assert.equal(verified.ok, false);
    assert.ok(verified.errors.some((e) => /hash mismatch/.test(e)));
  });
});

describe("FG-DR-001 collection reconciliation fixtures", () => {
  it("passes when counts and indexes match", () => {
    const counts = Object.fromEntries(CANONICAL_COLLECTIONS.map((c) => [c, 2]));
    const indexes = {
      users: simplifyIndexManifest([{ name: "_id_", key: { _id: 1 } }]),
    };
    const result = reconcileCollections({
      sourceCounts: counts,
      targetCounts: { ...counts },
      sourceIndexes: indexes,
      targetIndexes: indexes,
    });
    assert.equal(result.ok, true);
  });

  it("flags incorrect index manifests", () => {
    const counts = Object.fromEntries(CANONICAL_COLLECTIONS.map((c) => [c, 1]));
    const result = reconcileCollections({
      sourceCounts: counts,
      targetCounts: counts,
      sourceIndexes: {
        checklist_templates: simplifyIndexManifest([
          {
            name: "checklist_templates_currentVersionId_key",
            key: { currentVersionId: 1 },
            unique: true,
            partialFilterExpression: { currentVersionId: { $type: "string" } },
          },
        ]),
      },
      targetIndexes: {
        checklist_templates: simplifyIndexManifest([
          {
            name: "checklist_templates_currentVersionId_key",
            key: { currentVersionId: 1 },
            unique: false,
          },
        ]),
      },
    });
    assert.equal(result.ok, false);
    assert.ok(result.indexDiffs.length >= 1);
  });
});

describe("FG-DR-001 GridFS reconciliation fixtures", () => {
  it("detects missing GridFS file", () => {
    const result = reconcileGridFs({
      files: [{ id: "file-1" }],
      chunks: [{ files_id: "file-1" }],
      attachments: [{ id: "a1", gridFsFileId: "file-missing" }],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.missingBinaries, ["file-missing"]);
  });

  it("detects orphan GridFS file", () => {
    const result = reconcileGridFs({
      files: [{ id: "orphan-1" }],
      chunks: [{ files_id: "orphan-1" }],
      attachments: [{ id: "a1", gridFsFileId: null }],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.orphanBinaries, ["orphan-1"]);
  });

  it("passes when files, chunks, and metadata align", () => {
    const result = reconcileGridFs({
      files: [{ id: "file-1" }],
      chunks: [{ files_id: "file-1" }],
      attachments: [{ id: "a1", gridFsFileId: "file-1" }],
      sampledDownloads: [{ id: "file-1", sha256: "abc" }],
      expectedSampleHashes: { "file-1": "abc" },
    });
    assert.equal(result.ok, true);
  });
});

describe("FG-DR-001 invariant fixtures", () => {
  it("detects missing relation record → template version", () => {
    const result = checkInvariants({
      records: [{ id: "r1", templateVersionId: "missing-v" }],
      templateVersions: [{ id: "v1" }],
      attachments: [],
      approvals: [],
      results: [],
      correctiveActions: [],
      users: [],
      userRoles: [],
      roles: [],
      templates: [],
      auditLogs: [],
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.failures.some((f) => f.code === "RECORD_TEMPLATE_VERSION_MISSING"),
    );
  });

  it("passes a consistent fixture graph", () => {
    const result = checkInvariants({
      records: [{ id: "r1", templateVersionId: "v1" }],
      templateVersions: [{ id: "v1" }],
      attachments: [{ id: "a1", recordId: "r1", gridFsFileId: "f1" }],
      approvals: [{ id: "ap1", recordId: "r1" }],
      results: [{ id: "res1", recordId: "r1" }],
      correctiveActions: [{ id: "ca1", recordId: "r1", resultId: "res1" }],
      users: [{ id: "u1" }],
      userRoles: [{ userId: "u1", roleId: "role1" }],
      roles: [{ id: "role1" }],
      templates: [{ id: "t1", currentVersionId: "v1" }],
      auditLogs: [{ id: "aud1", entityId: "r1" }],
    });
    assert.equal(result.ok, true);
  });
});

describe("FG-DR-001 report redaction", () => {
  it("redacts connection strings and secret keys", () => {
    const redacted = redactReport({
      DATABASE_URL: SOURCE,
      note: `failed ${SOURCE}`,
      nested: { refreshToken: "super-secret-value" },
    });
    assert.equal(redacted.DATABASE_URL, "[REDACTED]");
    assert.equal(redacted.nested.refreshToken, "[REDACTED]");
    assert.equal(String(redacted.note).includes("secret"), false);
    assert.ok(
      String(redacted.note).includes("REDACTED_MONGO_URI") ||
        String(redacted.note).includes("****"),
    );
  });
});

describe("FG-DR-001 RPO/RTO format", () => {
  it("defaults to NOT_EXECUTED without inventing measurements", () => {
    const record = buildRpoRtoRecord();
    assert.equal(record.status, "NOT_EXECUTED");
    assert.equal(record.measured.rpoMinutes, null);
    assert.equal(record.measured.rtoMinutes, null);
  });

  it("computes RTO when timestamps are provided", () => {
    const record = buildRpoRtoRecord({
      status: "PASS",
      restoreStartedAt: "2026-07-17T00:00:00.000Z",
      appSmokeCompletedAt: "2026-07-17T00:45:00.000Z",
      lastSuccessfulBackupAt: "2026-07-16T12:00:00.000Z",
      incidentDetectedAt: "2026-07-17T00:00:00.000Z",
    });
    assert.equal(record.measured.rtoMinutes, 45);
    assert.equal(record.measured.rpoMinutes, 12 * 60);
  });
});
