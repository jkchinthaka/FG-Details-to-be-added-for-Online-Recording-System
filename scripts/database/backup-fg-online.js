/**
 * Full logical backup of fg_online (JSON per collection + GridFS files).
 * Refuses any database name other than fg_online.
 * Output goes under .local-backups/ (gitignored). Never prints credentials.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const rootPaths = [path.join(__dirname, "../../apps/api"), path.join(__dirname, "../..")];
const { MongoClient, GridFSBucket } = require(
  require.resolve("mongodb", { paths: rootPaths }),
);
const { PrismaClient } = require("../../apps/api/generated/prisma-client");

function databaseNameFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/([^/?]+)(?:\?|$)/);
  return match ? match[1] : null;
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

async function main() {
  const dbName = databaseNameFromUrl(process.env.DATABASE_URL);
  if (dbName !== "fg_online") {
    throw new Error(`Backup refused: expected fg_online, got ${dbName ?? "none"}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(
    process.cwd(),
    ".local-backups",
    `fg-online-before-sample-cleanup-${stamp}`,
  );
  fs.mkdirSync(outDir, { recursive: true });

  const prisma = new PrismaClient();
  const client = new MongoClient(process.env.DATABASE_URL);
  const hashes = {};
  const counts = {};

  try {
    await prisma.$connect();
    await client.connect();
    const db = client.db(dbName);

    const exporters = {
      users: () => prisma.user.findMany(),
      roles: () => prisma.role.findMany(),
      permissions: () => prisma.permission.findMany(),
      user_roles: () => prisma.userRole.findMany(),
      role_permissions: () => prisma.rolePermission.findMany(),
      refresh_tokens: () => prisma.refreshToken.findMany(),
      departments: () => prisma.department.findMany(),
      sections: () => prisma.section.findMany(),
      shifts: () => prisma.shift.findMany(),
      checklist_templates: () => prisma.checklistTemplate.findMany(),
      checklist_template_versions: () => prisma.checklistTemplateVersion.findMany(),
      checklist_sections: () => prisma.checklistSection.findMany(),
      checklist_items: () => prisma.checklistItem.findMany(),
      checklist_item_options: () => prisma.checklistItemOption.findMany(),
      task_assignments: () => prisma.taskAssignment.findMany(),
      inspection_records: () => prisma.inspectionRecord.findMany(),
      inspection_results: () => prisma.inspectionResult.findMany(),
      inspection_attachments: () => prisma.inspectionAttachment.findMany(),
      approval_records: () => prisma.approvalRecord.findMany(),
      corrective_actions: () => prisma.correctiveAction.findMany(),
      corrective_action_evidence: () => prisma.correctiveActionEvidence.findMany(),
      vehicles: () => prisma.vehicle.findMany(),
      drivers: () => prisma.driver.findMany(),
      transporters: () => prisma.transporter.findMany(),
      truck_inspection_details: () => prisma.truckInspectionDetail.findMany(),
      notifications: () => prisma.notification.findMany(),
      audit_logs: () => prisma.auditLog.findMany(),
      failure_reasons: () => prisma.failureReason.findMany(),
      corrective_action_categories: () => prisma.correctiveActionCategory.findMany(),
      temperature_profiles: () => prisma.temperatureProfile.findMany(),
      loading_decision_policies: () => prisma.loadingDecisionPolicy.findMany(),
    };

    for (const [name, fn] of Object.entries(exporters)) {
      const rows = await fn();
      counts[name] = rows.length;
      const filePath = path.join(outDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows));
      hashes[`${name}.json`] = sha256File(filePath);
    }

    // GridFS fgEvidence
    const bucket = new GridFSBucket(db, { bucketName: "fgEvidence" });
    const files = await db.collection("fgEvidence.files").find({}).toArray();
    const chunks = await db.collection("fgEvidence.chunks").find({}).toArray();
    counts["fgEvidence.files"] = files.length;
    counts["fgEvidence.chunks"] = chunks.length;
    const filesPath = path.join(outDir, "fgEvidence.files.json");
    const chunksPath = path.join(outDir, "fgEvidence.chunks.json");
    fs.writeFileSync(filesPath, JSON.stringify(files));
    fs.writeFileSync(chunksPath, JSON.stringify(chunks));
    hashes["fgEvidence.files.json"] = sha256File(filesPath);
    hashes["fgEvidence.chunks.json"] = sha256File(chunksPath);

    // Also dump raw binary files when present
    const binariesDir = path.join(outDir, "fgEvidence-binaries");
    fs.mkdirSync(binariesDir, { recursive: true });
    for (const file of files) {
      const dest = path.join(binariesDir, `${String(file._id)}.bin`);
      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(dest);
        bucket
          .openDownloadStream(file._id)
          .pipe(ws)
          .on("finish", resolve)
          .on("error", reject);
      });
      hashes[`fgEvidence-binaries/${String(file._id)}.bin`] = sha256File(dest);
    }

    const manifest = {
      database: dbName,
      createdAt: new Date().toISOString(),
      outDir: path.relative(process.cwd(), outDir),
      counts,
      sha256: hashes,
      note: "Backup contains operational data — do not commit",
    };
    const manifestoPath = path.join(outDir, "MANIFEST.json");
    fs.writeFileSync(manifestoPath, JSON.stringify(manifest, null, 2));

    const nonEmpty = Object.entries(hashes).every(([file, hash]) => {
      const full = path.join(outDir, file);
      return fs.existsSync(full) && fs.statSync(full).size >= 0 && hash.length === 64;
    });

    console.log(
      JSON.stringify(
        {
          status: nonEmpty ? "BACKUP_OK" : "BACKUP_INCOMPLETE",
          database: dbName,
          outDir: manifest.outDir,
          totalFiles: Object.keys(hashes).length + 1,
          counts,
        },
        null,
        2,
      ),
    );

    if (!nonEmpty) process.exit(2);
  } finally {
    await prisma.$disconnect();
    await client.close();
  }
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err).slice(0, 500));
  process.exit(1);
});
