/**
 * FG-FILE-001 — GridFS evidence orphan reconciliation.
 *
 * Cross-checks the `fgEvidence` GridFS bucket against `inspection_attachments`
 * metadata and reports (or, with an explicit flag, cleans up):
 *
 *   - ORPHAN BINARIES  : files stored in GridFS that no attachment references.
 *   - MISSING BINARIES : attachments whose GridFS object is gone (never touched
 *                        automatically — surfaced for human review).
 *   - PENDING QUEUE    : reconciliation events queued by the app (e.g. an old
 *                        binary whose delete failed after a successful swap).
 *
 * SAFETY:
 *   - READ-ONLY BY DEFAULT. Nothing is deleted unless `--cleanup` is passed.
 *   - This is a manual maintenance command; it is NOT wired into API startup
 *     and never runs during normal production boot.
 *   - Cleanup only removes orphan binaries older than a grace window so it can
 *     never race an in-flight upload.
 *   - Never prints binary data or filenames; only ids, sizes and counts.
 *
 * Usage:
 *   node scripts/database/reconcile-evidence-orphans.js            # report only
 *   node scripts/database/reconcile-evidence-orphans.js --cleanup  # delete orphans
 *   node scripts/database/reconcile-evidence-orphans.js --cleanup --grace-minutes=30
 */
const path = require("path");
const { createRequire } = require("module");
const requireFromApi = createRequire(path.join(__dirname, "../../apps/api/package.json"));
const { MongoClient, GridFSBucket, ObjectId } = requireFromApi("mongodb");

const BUCKET = "fgEvidence";
const DEFAULT_GRACE_MINUTES = 15;

function parseArgs(argv) {
  const args = { cleanup: false, graceMinutes: DEFAULT_GRACE_MINUTES };
  for (const arg of argv) {
    if (arg === "--cleanup") args.cleanup = true;
    else if (arg.startsWith("--grace-minutes=")) {
      const n = Number(arg.split("=")[1]);
      if (Number.isFinite(n) && n >= 0) args.graceMinutes = n;
    }
  }
  return args;
}

function redactCredentials(message) {
  return String(message).replace(/\/\/[^@]*@/g, "//****:****@");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    const filesCol = db.collection(`${BUCKET}.files`);
    const attachmentsCol = db.collection("inspection_attachments");
    const reconCol = db.collection(`${BUCKET}_reconciliation`);

    // Referenced GridFS ids (attachments are the source of truth for "in use").
    const referenced = new Set();
    const attachmentCursor = attachmentsCol.find(
      { gridFsFileId: { $ne: null } },
      { projection: { gridFsFileId: 1 } },
    );
    for await (const doc of attachmentCursor) {
      if (doc.gridFsFileId) referenced.add(String(doc.gridFsFileId));
    }

    const graceCutoff = new Date(Date.now() - args.graceMinutes * 60_000);
    const orphanBinaries = [];
    const filesCursor = filesCol.find(
      {},
      { projection: { _id: 1, length: 1, uploadDate: 1 } },
    );
    for await (const file of filesCursor) {
      if (!referenced.has(String(file._id))) {
        orphanBinaries.push({
          id: String(file._id),
          length: typeof file.length === "number" ? file.length : 0,
          uploadDate: file.uploadDate instanceof Date ? file.uploadDate : null,
          agedOut: file.uploadDate instanceof Date && file.uploadDate < graceCutoff,
        });
      }
    }

    // Attachments whose binary is missing (human review only — never deleted).
    const missingBinaries = [];
    const refCursor = attachmentsCol.find(
      { gridFsFileId: { $ne: null } },
      { projection: { _id: 1, gridFsFileId: 1 } },
    );
    for await (const doc of refCursor) {
      const exists = await filesCol.findOne(
        { _id: new ObjectId(String(doc.gridFsFileId)) },
        { projection: { _id: 1 } },
      );
      if (!exists) {
        missingBinaries.push({
          attachmentId: String(doc._id),
          gridFsFileId: String(doc.gridFsFileId),
        });
      }
    }

    const pending = await reconCol.find({ resolved: false }).toArray();

    console.log("=== FG-FILE-001 evidence reconciliation ===");
    console.log(`database                : ${db.databaseName}`);
    console.log(`mode                    : ${args.cleanup ? "CLEANUP" : "READ-ONLY"}`);
    console.log(`grace window (minutes)  : ${args.graceMinutes}`);
    console.log(`referenced binaries     : ${referenced.size}`);
    console.log(`orphan binaries         : ${orphanBinaries.length}`);
    console.log(
      `  eligible for cleanup  : ${orphanBinaries.filter((o) => o.agedOut).length}`,
    );
    console.log(`missing binaries        : ${missingBinaries.length}`);
    console.log(`pending recon events    : ${pending.length}`);

    if (missingBinaries.length > 0) {
      console.log("\n[ATTENTION] attachments with missing binaries (manual review):");
      for (const m of missingBinaries) {
        console.log(`  attachment=${m.attachmentId} gridFsFileId=${m.gridFsFileId}`);
      }
    }

    if (!args.cleanup) {
      console.log(
        "\nRead-only run complete. Re-run with --cleanup to delete aged-out orphan binaries.",
      );
      return;
    }

    const bucket = new GridFSBucket(db, { bucketName: BUCKET });
    let deleted = 0;
    for (const orphan of orphanBinaries) {
      if (!orphan.agedOut) continue; // never race an in-flight upload
      try {
        await bucket.delete(new ObjectId(orphan.id));
        await reconCol.updateMany(
          { gridFsFileId: orphan.id, resolved: false },
          { $set: { resolved: true, resolvedAt: new Date() } },
        );
        deleted += 1;
      } catch (error) {
        console.error(
          `  failed to delete orphan ${orphan.id}: ${redactCredentials(
            error instanceof Error ? error.message : String(error),
          )}`,
        );
      }
    }
    console.log(`\nCleanup complete. Deleted ${deleted} orphan binaries.`);
  } catch (error) {
    console.error(
      redactCredentials(error instanceof Error ? error.message : String(error)),
    );
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => undefined);
  }
}

main();
