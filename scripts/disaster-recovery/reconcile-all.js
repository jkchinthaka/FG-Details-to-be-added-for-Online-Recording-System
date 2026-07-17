#!/usr/bin/env node
/**
 * FG-DR-001 — live MongoDB + GridFS reconciliation (read-only by default).
 *
 * Requires DATABASE_URL pointing at an isolated DB for exercises
 * (fg_online_test / fg_online_restore_test / fg_dr_restore_*).
 * Refuses production fg_online unless --allow-production-read=YES
 * (read-only inventory only — still never restores).
 *
 * Usage:
 *   node scripts/disaster-recovery/reconcile-all.js
 *   node scripts/disaster-recovery/reconcile-all.js --compare-manifest=.local-backups/.../MANIFEST.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const requireFromApi = createRequire(path.join(__dirname, "../../apps/api/package.json"));
const { MongoClient, GridFSBucket, ObjectId } = requireFromApi("mongodb");

const {
  databaseNameFromUrl,
  isProductionDatabaseName,
  redactCredentials,
  isAllowedRestoreTargetName,
} = require("./lib/database-url");
const { CANONICAL_COLLECTIONS, redactReport, sha256 } = require("./lib/backup-manifest");
const {
  reconcileCollections,
  sampleIdHash,
  simplifyIndexManifest,
} = require("./lib/collection-reconcile");
const { reconcileGridFs, hashBuffer } = require("./lib/gridfs-reconcile");
const { checkInvariants } = require("./lib/invariant-checks");

function parseArgs(argv) {
  const out = {
    compareManifest: null,
    allowProductionRead: false,
    sampleDownloads: 3,
  };
  for (const arg of argv) {
    if (arg.startsWith("--compare-manifest=")) out.compareManifest = arg.slice(20);
    else if (arg === "--allow-production-read=YES") out.allowProductionRead = true;
    else if (arg.startsWith("--sample-downloads=")) {
      out.sampleDownloads = Number(arg.split("=")[1]) || 0;
    }
  }
  return out;
}

async function loadCollectionDocs(db, name, limit = 200) {
  return db.collection(name).find({}).limit(limit).toArray();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const dbName = databaseNameFromUrl(url);
  if (!dbName) {
    console.error("Could not parse database name");
    process.exit(1);
  }
  if (isProductionDatabaseName(dbName) && !args.allowProductionRead) {
    console.error(
      JSON.stringify({
        status: "REFUSED",
        error: "production fg_online read requires --allow-production-read=YES",
      }),
    );
    process.exit(1);
  }
  if (!isProductionDatabaseName(dbName) && !isAllowedRestoreTargetName(dbName)) {
    console.error(
      JSON.stringify({
        status: "REFUSED",
        error: `database ${dbName} is not an allowed isolated target`,
      }),
    );
    process.exit(1);
  }

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db(dbName);

    const counts = {};
    const indexes = {};
    const samples = {};
    const snap = {
      records: [],
      templateVersions: [],
      attachments: [],
      approvals: [],
      results: [],
      correctiveActions: [],
      users: [],
      userRoles: [],
      roles: [],
      templates: [],
      auditLogs: [],
    };

    for (const name of CANONICAL_COLLECTIONS) {
      const col = db.collection(name);
      counts[name] = await col.countDocuments();
      indexes[name] = simplifyIndexManifest(await col.indexes());
      const docs = await loadCollectionDocs(db, name, 100);
      samples[name] = sampleIdHash(docs);

      if (name === "inspection_records") {
        snap.records = docs.map((d) => ({
          id: String(d._id),
          templateVersionId: d.templateVersionId ? String(d.templateVersionId) : null,
        }));
      } else if (name === "checklist_template_versions") {
        snap.templateVersions = docs.map((d) => ({ id: String(d._id) }));
      } else if (name === "inspection_attachments") {
        snap.attachments = docs.map((d) => ({
          id: String(d._id),
          recordId: d.recordId ? String(d.recordId) : null,
          gridFsFileId: d.gridFsFileId ? String(d.gridFsFileId) : null,
        }));
      } else if (name === "approval_records") {
        snap.approvals = docs.map((d) => ({
          id: String(d._id),
          recordId: d.recordId ? String(d.recordId) : null,
        }));
      } else if (name === "inspection_results") {
        snap.results = docs.map((d) => ({
          id: String(d._id),
          recordId: d.recordId ? String(d.recordId) : null,
        }));
      } else if (name === "corrective_actions") {
        snap.correctiveActions = docs.map((d) => ({
          id: String(d._id),
          recordId: d.recordId ? String(d.recordId) : null,
          resultId: d.resultId ? String(d.resultId) : null,
        }));
      } else if (name === "users") {
        snap.users = docs.map((d) => ({ id: String(d._id) }));
      } else if (name === "roles") {
        snap.roles = docs.map((d) => ({ id: String(d._id) }));
      } else if (name === "user_roles") {
        snap.userRoles = docs.map((d) => ({
          userId: String(d.userId),
          roleId: String(d.roleId),
        }));
      } else if (name === "checklist_templates") {
        snap.templates = docs.map((d) => ({
          id: String(d._id),
          currentVersionId: d.currentVersionId ? String(d.currentVersionId) : null,
        }));
      } else if (name === "audit_logs") {
        snap.auditLogs = docs.map((d) => ({
          id: String(d._id),
          entityId: d.entityId ? String(d.entityId) : null,
        }));
      }
    }

    const files = await db
      .collection("fgEvidence.files")
      .find({}, { projection: { _id: 1, length: 1 } })
      .toArray();
    const chunks = await db
      .collection("fgEvidence.chunks")
      .find({}, { projection: { files_id: 1 } })
      .limit(5000)
      .toArray();
    const caEvidence = await db
      .collection("corrective_action_evidence")
      .find({}, { projection: { _id: 1, gridFsFileId: 1 } })
      .toArray();

    counts["fgEvidence.files"] = files.length;
    counts["fgEvidence.chunks"] = await db.collection("fgEvidence.chunks").countDocuments();

    const sampledDownloads = [];
    const expectedSampleHashes = {};
    if (args.sampleDownloads > 0 && files.length > 0) {
      const bucket = new GridFSBucket(db, { bucketName: "fgEvidence" });
      for (const file of files.slice(0, args.sampleDownloads)) {
        const id = String(file._id);
        const chunksBuf = [];
        await new Promise((resolve, reject) => {
          bucket
            .openDownloadStream(new ObjectId(id))
            .on("data", (c) => chunksBuf.push(c))
            .on("error", reject)
            .on("end", resolve);
        });
        const digest = hashBuffer(Buffer.concat(chunksBuf));
        sampledDownloads.push({ id, sha256: digest });
        expectedSampleHashes[id] = digest;
      }
    }

    const gridfs = reconcileGridFs({
      files: files.map((f) => ({ id: String(f._id), length: f.length })),
      chunks: chunks.map((c) => ({ files_id: String(c.files_id) })),
      attachments: snap.attachments,
      correctiveEvidence: caEvidence.map((d) => ({
        id: String(d._id),
        gridFsFileId: d.gridFsFileId ? String(d.gridFsFileId) : null,
      })),
      sampledDownloads,
      expectedSampleHashes,
    });

    const invariants = checkInvariants(snap);

    let collectionCompare = null;
    if (args.compareManifest) {
      const manifest = JSON.parse(fs.readFileSync(path.resolve(args.compareManifest), "utf8"));
      collectionCompare = reconcileCollections({
        sourceCounts: manifest.counts || {},
        targetCounts: counts,
        sourceIndexes: {},
        targetIndexes: indexes,
        sourceSamples: {},
        targetSamples: samples,
      });
    }

    const report = redactReport({
      status:
        gridfs.ok && invariants.ok && (!collectionCompare || collectionCompare.ok)
          ? "RECONCILE_PASS"
          : "RECONCILE_FAIL",
      databaseName: dbName,
      counts,
      gridfs: {
        ok: gridfs.ok,
        filesCount: gridfs.filesCount,
        chunksCount: gridfs.chunksCount,
        orphanBinaryCount: gridfs.orphanBinaries.length,
        missingBinaryCount: gridfs.missingBinaries.length,
        orphanBinaries: gridfs.orphanBinaries.slice(0, 20),
        missingBinaries: gridfs.missingBinaries.slice(0, 20),
      },
      invariants: {
        ok: invariants.ok,
        failureCount: invariants.failures.length,
        failures: invariants.failures.slice(0, 50),
      },
      collectionCompare,
      indexManifestSample: Object.fromEntries(
        Object.entries(indexes).slice(0, 5).map(([k, v]) => [k, v]),
      ),
      sampleHashNote: "sampled id hashes computed; binary content not logged",
      contentHashProbe: sampledDownloads.map((s) => ({
        id: s.id,
        sha256: s.sha256,
      })),
    });

    console.log(JSON.stringify(report, null, 2));
    process.exit(report.status === "RECONCILE_PASS" ? 0 : 2);
  } catch (err) {
    console.error(
      JSON.stringify({
        status: "RECONCILE_ERROR",
        error: redactCredentials(err instanceof Error ? err.message : String(err)),
      }),
    );
    process.exit(1);
  } finally {
    await client.close().catch(() => undefined);
  }
}

main();
