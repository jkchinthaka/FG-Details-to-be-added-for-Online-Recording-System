/**
 * Sample/demo operational data cleanup for MongoDB Atlas fg_online.
 *
 * Default: dry-run. Deletion requires --execute.
 *
 * Usage:
 *   node scripts/database/cleanup-sample-data.js --dry-run --database=fg_online --report=.local-backups/sample-cleanup-dry-run.json
 *   node scripts/database/cleanup-sample-data.js --execute --database=fg_online --report=.local-backups/sample-cleanup-executed.json --backup=<dir>
 */
const fs = require("fs");
const path = require("path");
const rootPaths = [path.join(__dirname, "../../apps/api"), path.join(__dirname, "../..")];
const bcrypt = require(require.resolve("bcrypt", { paths: rootPaths }));
const { MongoClient, GridFSBucket, ObjectId } = require(
  require.resolve("mongodb", { paths: rootPaths }),
);
const { PrismaClient } = require("../../apps/api/generated/prisma-client");

const SCRIPT_VERSION = "1.0.0";

const CONFIRMED_SAMPLE_EMAILS = new Set([
  "admin@example.local",
  "operator@example.local",
  "qa@example.local",
  "supervisor@example.local",
]);

const CONFIRMED_SAMPLE_EMPLOYEE_CODES = new Set([
  "EMP-ADMIN-001",
  "EMP-OPERATOR-001",
  "EMP-QA-001",
  "EMP-SUPERVISOR-001",
]);

const CONFIRMED_SAMPLE_VEHICLE_NUMBERS = new Set([
  "WP CAB-1234",
  "WP CAC-5678",
  "WP KL-9012",
]);

const CONFIRMED_SAMPLE_DRIVER_LICENSES = new Set(["B1234567", "B7654321"]);

const CONFIRMED_SAMPLE_TRANSPORTER_NAMES = new Set([
  "Lanka Cold Logistics",
  "Nelna Fleet Services",
]);

const DEMO_EMAIL_SUFFIXES = [
  "@example.local",
  "@test.local",
  "@demo.local",
  "@test.nelna.local",
];

function parseArgs(argv) {
  const args = {
    dryRun: true,
    execute: false,
    database: "fg_online",
    report: ".local-backups/sample-cleanup-report.json",
    backup: null,
  };
  for (const raw of argv) {
    if (raw === "--execute") {
      args.execute = true;
      args.dryRun = false;
    } else if (raw === "--dry-run") {
      args.dryRun = true;
      args.execute = false;
    } else if (raw.startsWith("--database=")) {
      args.database = raw.slice("--database=".length);
    } else if (raw.startsWith("--report=")) {
      args.report = raw.slice("--report=".length);
    } else if (raw.startsWith("--backup=")) {
      args.backup = raw.slice("--backup=".length);
    }
  }
  return args;
}

function databaseNameFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/([^/?]+)(?:\?|$)/);
  return match ? match[1] : null;
}

function isDemoEmail(email) {
  const lower = String(email || "").toLowerCase();
  if (CONFIRMED_SAMPLE_EMAILS.has(lower)) return true;
  return DEMO_EMAIL_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isConfirmedSampleUser(user) {
  const email = String(user.email || "").toLowerCase();
  const code = String(user.employeeCode || "");
  if (CONFIRMED_SAMPLE_EMAILS.has(email) || CONFIRMED_SAMPLE_EMPLOYEE_CODES.has(code)) {
    return true;
  }
  if (isDemoEmail(email) && /^EMP-|SEED-|TST-/.test(code)) {
    return true;
  }
  return false;
}

function findLatestBackupDir() {
  const root = path.join(process.cwd(), ".local-backups");
  if (!fs.existsSync(root)) return null;
  const dirs = fs
    .readdirSync(root)
    .filter((name) => name.startsWith("fg-online-before-sample-cleanup-"))
    .map((name) => path.join(root, name))
    .filter((dir) => fs.existsSync(path.join(dir, "MANIFEST.json")));
  if (dirs.length === 0) return null;
  dirs.sort();
  return dirs[dirs.length - 1];
}

function verifyBackup(backupDir) {
  if (!backupDir || !fs.existsSync(backupDir)) {
    return { ok: false, reason: "backup directory missing" };
  }
  const manifesto = path.join(backupDir, "MANIFEST.json");
  if (!fs.existsSync(manifesto)) {
    return { ok: false, reason: "MANIFEST.json missing" };
  }
  const manifest = JSON.parse(fs.readFileSync(manifesto, "utf8"));
  if (manifest.database !== "fg_online") {
    return { ok: false, reason: "manifest database is not fg_online" };
  }
  const usersFile = path.join(backupDir, "users.json");
  if (!fs.existsSync(usersFile) || fs.statSync(usersFile).size === 0) {
    return { ok: false, reason: "users.json missing or empty" };
  }
  return { ok: true, manifest };
}

async function countAll(prisma) {
  return {
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    user_roles: await prisma.userRole.count(),
    role_permissions: await prisma.rolePermission.count(),
    refresh_tokens: await prisma.refreshToken.count(),
    departments: await prisma.department.count(),
    sections: await prisma.section.count(),
    shifts: await prisma.shift.count(),
    checklist_templates: await prisma.checklistTemplate.count(),
    checklist_template_versions: await prisma.checklistTemplateVersion.count(),
    checklist_sections: await prisma.checklistSection.count(),
    checklist_items: await prisma.checklistItem.count(),
    checklist_item_options: await prisma.checklistItemOption.count(),
    task_assignments: await prisma.taskAssignment.count(),
    inspection_records: await prisma.inspectionRecord.count(),
    inspection_results: await prisma.inspectionResult.count(),
    inspection_attachments: await prisma.inspectionAttachment.count(),
    approval_records: await prisma.approvalRecord.count(),
    corrective_actions: await prisma.correctiveAction.count(),
    corrective_action_evidence: await prisma.correctiveActionEvidence.count(),
    vehicles: await prisma.vehicle.count(),
    drivers: await prisma.driver.count(),
    transporters: await prisma.transporter.count(),
    truck_inspection_details: await prisma.truckInspectionDetail.count(),
    notifications: await prisma.notification.count(),
    audit_logs: await prisma.auditLog.count(),
    failure_reasons: await prisma.failureReason.count(),
    corrective_action_categories: await prisma.correctiveActionCategory.count(),
    temperature_profiles: await prisma.temperatureProfile.count(),
    loading_decision_policies: await prisma.loadingDecisionPolicy.count(),
  };
}

async function maybeCreateBootstrapAdmin(prisma) {
  const code = process.env.BOOTSTRAP_ADMIN_EMPLOYEE_CODE;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const fullName = process.env.BOOTSTRAP_ADMIN_FULL_NAME;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!code || !email || !fullName || !password) {
    return { created: false, reason: "BOOTSTRAP_ADMIN_* env vars not set" };
  }
  if (password.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters");
  }
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { employeeCode: code }] },
  });
  if (existing && !isConfirmedSampleUser(existing)) {
    return { created: false, reason: "bootstrap identity already exists as real user" };
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const role = await prisma.role.findUniqueOrThrow({
    where: { name: "SYSTEM_ADMINISTRATOR" },
  });
  const user = await prisma.user.upsert({
    where: { employeeCode: code },
    create: { employeeCode: code, email, fullName, passwordHash, status: "ACTIVE" },
    update: { email, fullName, passwordHash, status: "ACTIVE" },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });
  return { created: true, employeeCode: code };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbName = databaseNameFromUrl(process.env.DATABASE_URL);

  if (args.database !== "fg_online") {
    throw new Error(`Refuse: --database must be fg_online (got ${args.database})`);
  }
  if (dbName !== "fg_online") {
    throw new Error(
      `Refuse: DATABASE_URL must target fg_online (got ${dbName ?? "none"})`,
    );
  }

  const backupDir = args.backup || findLatestBackupDir();
  const backupCheck = verifyBackup(backupDir);
  if (!backupCheck.ok) {
    throw new Error(`Refuse: backup verification failed (${backupCheck.reason})`);
  }

  const prisma = new PrismaClient();
  const mongo = new MongoClient(process.env.DATABASE_URL);
  const planned = {
    users: [],
    protectedAdmin: null,
    task_assignments: [],
    inspection_records: [],
    inspection_results: [],
    inspection_attachments: [],
    approval_records: [],
    corrective_actions: [],
    corrective_action_evidence: [],
    truck_inspection_details: [],
    notifications: [],
    refresh_tokens: [],
    audit_logs: [],
    user_roles: [],
    vehicles: [],
    drivers: [],
    transporters: [],
    gridFsFiles: [],
    retainedDueToRealRefs: [],
    ambiguous: [],
  };
  const deletions = {};

  try {
    await prisma.$connect();
    await mongo.connect();
    const db = mongo.db("fg_online");
    const before = await countAll(prisma);
    const gridFsFileCount = await db.collection("fgEvidence.files").countDocuments();
    const gridFsChunkCount = await db.collection("fgEvidence.chunks").countDocuments();

    const users = await prisma.user.findMany({
      include: { userRoles: { include: { role: true } } },
    });
    const confirmedUsers = users.filter(isConfirmedSampleUser);
    const realOrUnknownUsers = users.filter((u) => !isConfirmedSampleUser(u));

    const adminRoleUsers = users.filter((u) =>
      u.userRoles.some((r) => r.role.name === "SYSTEM_ADMINISTRATOR"),
    );
    const realAdmins = adminRoleUsers.filter((u) => !isConfirmedSampleUser(u));
    let adminSafety = {
      realAdminCount: realAdmins.length,
      sampleAdminCount: adminRoleUsers.filter(isConfirmedSampleUser).length,
      status: "OK",
      detail: "",
    };

    let usersToDelete = [...confirmedUsers];
    if (realAdmins.length === 0) {
      const bootstrap = args.execute
        ? await maybeCreateBootstrapAdmin(prisma)
        : {
            created: false,
            reason: process.env.BOOTSTRAP_ADMIN_EMAIL
              ? "would create bootstrap admin on --execute"
              : "BOOTSTRAP_ADMIN_* env vars not set",
          };
      if (bootstrap.created) {
        adminSafety = {
          ...adminSafety,
          status: "BOOTSTRAP_ADMIN_CREATED",
          detail: "Real administrator created from BOOTSTRAP_ADMIN_*",
        };
      } else {
        const sampleAdmins = confirmedUsers.filter((u) =>
          u.userRoles.some((r) => r.role.name === "SYSTEM_ADMINISTRATOR"),
        );
        if (sampleAdmins.length > 0) {
          const keep = sampleAdmins[0];
          planned.protectedAdmin = {
            employeeCode: keep.employeeCode,
            email: keep.email,
            reason: "Final sample administrator retained — ADMIN_REPLACEMENT_BLOCKED",
          };
          usersToDelete = usersToDelete.filter((u) => u.id !== keep.id);
          adminSafety = {
            ...adminSafety,
            status: "ADMIN_REPLACEMENT_BLOCKED",
            detail: bootstrap.reason || "No real admin; preserving final sample admin",
          };
        } else {
          throw new Error("Refuse: no administrator would remain after cleanup");
        }
      }
    }

    planned.users = usersToDelete.map((u) => ({
      id: u.id,
      employeeCode: u.employeeCode,
      email: u.email,
    }));

    const deleteUserIds = new Set(usersToDelete.map((u) => u.id));
    const protectedAdminId = planned.protectedAdmin
      ? users.find((u) => u.employeeCode === planned.protectedAdmin.employeeCode)?.id
      : null;
    const allConfirmedSampleIds = new Set(confirmedUsers.map((u) => u.id));

    // Tasks for sample users
    const tasks = await prisma.taskAssignment.findMany();
    planned.task_assignments = tasks
      .filter((t) => allConfirmedSampleIds.has(t.assignedToId))
      .map((t) => ({ id: t.id }));

    // Inspection trees for confirmed sample creators (none today expected)
    const records = await prisma.inspectionRecord.findMany();
    const sampleRecords = records.filter(
      (r) =>
        allConfirmedSampleIds.has(r.createdById) &&
        (!r.checkedById || allConfirmedSampleIds.has(r.checkedById)) &&
        (!r.verifiedById || allConfirmedSampleIds.has(r.verifiedById)),
    );
    // If a record was created by sample user but checked/verified by real user → ambiguous
    for (const r of records) {
      const createdBySample = allConfirmedSampleIds.has(r.createdById);
      const touchedByReal =
        (r.checkedById && !allConfirmedSampleIds.has(r.checkedById)) ||
        (r.verifiedById && !allConfirmedSampleIds.has(r.verifiedById));
      if (createdBySample && touchedByReal) {
        planned.ambiguous.push({
          type: "inspection_record",
          id: r.id,
          reason: "Sample creator but real checker/verifier — retained",
        });
      }
    }
    planned.inspection_records = sampleRecords.map((r) => ({ id: r.id }));
    const sampleRecordIds = new Set(sampleRecords.map((r) => r.id));

    const results = await prisma.inspectionResult.findMany();
    planned.inspection_results = results
      .filter((r) => sampleRecordIds.has(r.recordId))
      .map((r) => ({ id: r.id }));

    const attachments = await prisma.inspectionAttachment.findMany();
    planned.inspection_attachments = attachments
      .filter((a) => sampleRecordIds.has(a.recordId))
      .map((a) => ({ id: a.id, gridFsFileId: a.gridFsFileId }));

    const approvals = await prisma.approvalRecord.findMany();
    planned.approval_records = approvals
      .filter((a) => sampleRecordIds.has(a.recordId))
      .map((a) => ({ id: a.id }));

    const cas = await prisma.correctiveAction.findMany();
    planned.corrective_actions = cas
      .filter(
        (c) =>
          sampleRecordIds.has(c.recordId) || allConfirmedSampleIds.has(c.createdById),
      )
      .map((c) => ({ id: c.id }));
    const sampleCaIds = new Set(planned.corrective_actions.map((c) => c.id));

    const caEvidence = await prisma.correctiveActionEvidence.findMany();
    planned.corrective_action_evidence = caEvidence
      .filter((e) => sampleCaIds.has(e.correctiveActionId))
      .map((e) => ({ id: e.id, gridFsFileId: e.gridFsFileId }));

    const truckDetails = await prisma.truckInspectionDetail.findMany();
    planned.truck_inspection_details = truckDetails
      .filter((t) => sampleRecordIds.has(t.recordId))
      .map((t) => ({ id: t.id }));

    const notifications = await prisma.notification.findMany();
    planned.notifications = notifications
      .filter((n) => allConfirmedSampleIds.has(n.userId))
      .map((n) => ({ id: n.id }));

    const refreshTokens = await prisma.refreshToken.findMany();
    planned.refresh_tokens = refreshTokens
      .filter((t) => deleteUserIds.has(t.userId) || allConfirmedSampleIds.has(t.userId))
      .filter(
        (t) =>
          !protectedAdminId ||
          t.userId !== protectedAdminId ||
          deleteUserIds.has(t.userId),
      )
      .map((t) => ({ id: t.id }));
    // Only delete tokens for users being deleted
    planned.refresh_tokens = refreshTokens
      .filter((t) => deleteUserIds.has(t.userId))
      .map((t) => ({ id: t.id }));

    const audits = await prisma.auditLog.findMany();
    planned.audit_logs = audits
      .filter(
        (a) =>
          a.actorId &&
          allConfirmedSampleIds.has(a.actorId) &&
          (!protectedAdminId ||
            a.actorId !== protectedAdminId ||
            deleteUserIds.has(a.actorId)),
      )
      .filter(
        (a) =>
          !a.actorId || deleteUserIds.has(a.actorId) || sampleRecordIds.has(a.entityId),
      )
      .map((a) => ({ id: a.id }));
    // Safer: only audits whose actor is a deleted sample user
    planned.audit_logs = audits
      .filter((a) => a.actorId && deleteUserIds.has(a.actorId))
      .map((a) => ({ id: a.id }));

    const userRoles = await prisma.userRole.findMany();
    planned.user_roles = userRoles
      .filter((ur) => deleteUserIds.has(ur.userId))
      .map((ur) => ({ id: ur.id }));

    // Fleet sample seeds — retain if referenced by real records
    const vehicles = await prisma.vehicle.findMany();
    const drivers = await prisma.driver.findMany();
    const transporters = await prisma.transporter.findMany();

    for (const v of vehicles) {
      if (!CONFIRMED_SAMPLE_VEHICLE_NUMBERS.has(v.vehicleNumber)) {
        planned.ambiguous.push({
          type: "vehicle",
          id: v.id,
          reason: "Not a known seed vehicle number — retained",
        });
        continue;
      }
      const refs = await prisma.truckInspectionDetail.count({
        where: { vehicleId: v.id },
      });
      // Also check if any inspection mention — truck details is main FK
      if (refs > 0) {
        // if all referencing records are sample, still ok to keep until records gone;
        // if any real record refs exist, retain
        const realRef = await prisma.truckInspectionDetail.findFirst({
          where: {
            vehicleId: v.id,
            recordId: { notIn: [...sampleRecordIds] },
          },
        });
        if (realRef) {
          planned.retainedDueToRealRefs.push({
            type: "vehicle",
            vehicleNumber: v.vehicleNumber,
            reason: "Referenced by non-sample truck inspection detail",
          });
          continue;
        }
      }
      planned.vehicles.push({ id: v.id, vehicleNumber: v.vehicleNumber });
    }

    for (const d of drivers) {
      if (!CONFIRMED_SAMPLE_DRIVER_LICENSES.has(d.licenseNumber)) {
        planned.ambiguous.push({
          type: "driver",
          id: d.id,
          reason: "Not a known seed driver license — retained",
        });
        continue;
      }
      const realRef = await prisma.truckInspectionDetail.findFirst({
        where: {
          driverId: d.id,
          recordId: { notIn: [...sampleRecordIds] },
        },
      });
      if (realRef) {
        planned.retainedDueToRealRefs.push({
          type: "driver",
          licenseNumber: d.licenseNumber,
          reason: "Referenced by non-sample truck inspection detail",
        });
        continue;
      }
      planned.drivers.push({ id: d.id, licenseNumber: d.licenseNumber });
    }

    for (const t of transporters) {
      if (!CONFIRMED_SAMPLE_TRANSPORTER_NAMES.has(t.name)) {
        planned.ambiguous.push({
          type: "transporter",
          id: t.id,
          reason: "Not a known seed transporter — retained",
        });
        continue;
      }
      const vehicleRefs = await prisma.vehicle.count({
        where: {
          transporterId: t.id,
          id: { notIn: planned.vehicles.map((v) => v.id) },
        },
      });
      const driverRefs = await prisma.driver.count({
        where: {
          transporterId: t.id,
          id: { notIn: planned.drivers.map((d) => d.id) },
        },
      });
      const realTruck = await prisma.truckInspectionDetail.findFirst({
        where: {
          transporterId: t.id,
          recordId: { notIn: [...sampleRecordIds] },
        },
      });
      if (realTruck || vehicleRefs > 0 || driverRefs > 0) {
        planned.retainedDueToRealRefs.push({
          type: "transporter",
          name: t.name,
          reason: "Still referenced by retained fleet or real records",
        });
        continue;
      }
      planned.transporters.push({ id: t.id, name: t.name });
    }

    // GridFS files linked only to sample attachments/evidence
    const sampleGridIds = new Set(
      [...planned.inspection_attachments, ...planned.corrective_action_evidence]
        .map((x) => x.gridFsFileId)
        .filter(Boolean),
    );
    for (const gid of sampleGridIds) {
      planned.gridFsFiles.push({ id: gid });
    }

    // Safety refusals
    if (before.roles === 0 || before.permissions === 0) {
      throw new Error("Refuse: essential roles/permissions missing before cleanup");
    }
    if (before.checklist_templates < 2) {
      throw new Error("Refuse: required checklist templates missing");
    }
    // Never plan deletion of roles/permissions/templates
    const safety = {
      backupOk: true,
      backupDir: path.relative(process.cwd(), backupDir),
      adminSafety,
      wouldDeleteAllUsers: planned.users.length >= before.users && before.users > 0,
      configurationPreserved: true,
    };
    if (
      safety.wouldDeleteAllUsers &&
      !planned.protectedAdmin &&
      realAdmins.length === 0
    ) {
      throw new Error("Refuse: would delete all users without admin replacement");
    }

    const report = {
      scriptVersion: SCRIPT_VERSION,
      mode: args.execute ? "execute" : "dry-run",
      database: dbName,
      generatedAt: new Date().toISOString(),
      before: {
        ...before,
        "fgEvidence.files": gridFsFileCount,
        "fgEvidence.chunks": gridFsChunkCount,
      },
      confirmedSampleUsers: confirmedUsers.map((u) => ({
        employeeCode: u.employeeCode,
        email: u.email,
      })),
      realOrUnknownUsers: realOrUnknownUsers.map((u) => ({
        employeeCode: u.employeeCode,
        emailDomain: String(u.email).split("@")[1] || null,
      })),
      plannedDeletionCounts: Object.fromEntries(
        Object.entries(planned).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.length : v ? 1 : 0,
        ]),
      ),
      planned,
      safety,
      deletions: null,
      after: null,
    };

    if (!args.execute) {
      fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
      fs.writeFileSync(args.report, JSON.stringify(report, null, 2));
      console.log(
        JSON.stringify(
          {
            status: "DRY_RUN_OK",
            database: dbName,
            report: args.report,
            plannedDeletionCounts: report.plannedDeletionCounts,
            adminSafety: adminSafety.status,
            protectedAdmin: planned.protectedAdmin,
          },
          null,
          2,
        ),
      );
      return;
    }

    // EXECUTE — dependency-safe order
    const bucket = new GridFSBucket(db, { bucketName: "fgEvidence" });

    for (const f of planned.gridFsFiles) {
      try {
        await bucket.delete(new ObjectId(f.id));
        deletions.gridFsFiles = (deletions.gridFsFiles || 0) + 1;
      } catch (err) {
        if (!String(err.message || "").includes("FileNotFound")) throw err;
      }
    }

    if (planned.corrective_action_evidence.length) {
      const r = await prisma.correctiveActionEvidence.deleteMany({
        where: { id: { in: planned.corrective_action_evidence.map((x) => x.id) } },
      });
      deletions.corrective_action_evidence = r.count;
    }
    if (planned.corrective_actions.length) {
      const r = await prisma.correctiveAction.deleteMany({
        where: { id: { in: planned.corrective_actions.map((x) => x.id) } },
      });
      deletions.corrective_actions = r.count;
    }
    if (planned.approval_records.length) {
      const r = await prisma.approvalRecord.deleteMany({
        where: { id: { in: planned.approval_records.map((x) => x.id) } },
      });
      deletions.approval_records = r.count;
    }
    if (planned.inspection_attachments.length) {
      const r = await prisma.inspectionAttachment.deleteMany({
        where: { id: { in: planned.inspection_attachments.map((x) => x.id) } },
      });
      deletions.inspection_attachments = r.count;
    }
    if (planned.inspection_results.length) {
      const r = await prisma.inspectionResult.deleteMany({
        where: { id: { in: planned.inspection_results.map((x) => x.id) } },
      });
      deletions.inspection_results = r.count;
    }
    if (planned.truck_inspection_details.length) {
      const r = await prisma.truckInspectionDetail.deleteMany({
        where: { id: { in: planned.truck_inspection_details.map((x) => x.id) } },
      });
      deletions.truck_inspection_details = r.count;
    }
    if (planned.task_assignments.length) {
      const r = await prisma.taskAssignment.deleteMany({
        where: { id: { in: planned.task_assignments.map((x) => x.id) } },
      });
      deletions.task_assignments = r.count;
    }
    if (planned.inspection_records.length) {
      const r = await prisma.inspectionRecord.deleteMany({
        where: { id: { in: planned.inspection_records.map((x) => x.id) } },
      });
      deletions.inspection_records = r.count;
    }
    if (planned.notifications.length) {
      const r = await prisma.notification.deleteMany({
        where: { id: { in: planned.notifications.map((x) => x.id) } },
      });
      deletions.notifications = r.count;
    }
    if (planned.refresh_tokens.length) {
      const r = await prisma.refreshToken.deleteMany({
        where: { id: { in: planned.refresh_tokens.map((x) => x.id) } },
      });
      deletions.refresh_tokens = r.count;
    }
    if (planned.audit_logs.length) {
      const r = await prisma.auditLog.deleteMany({
        where: { id: { in: planned.audit_logs.map((x) => x.id) } },
      });
      deletions.audit_logs = r.count;
    }
    if (planned.user_roles.length) {
      const r = await prisma.userRole.deleteMany({
        where: { id: { in: planned.user_roles.map((x) => x.id) } },
      });
      deletions.user_roles = r.count;
    }
    if (planned.users.length) {
      const r = await prisma.user.deleteMany({
        where: { id: { in: planned.users.map((x) => x.id) } },
      });
      deletions.users = r.count;
    }
    if (planned.vehicles.length) {
      const r = await prisma.vehicle.deleteMany({
        where: { id: { in: planned.vehicles.map((x) => x.id) } },
      });
      deletions.vehicles = r.count;
    }
    if (planned.drivers.length) {
      const r = await prisma.driver.deleteMany({
        where: { id: { in: planned.drivers.map((x) => x.id) } },
      });
      deletions.drivers = r.count;
    }
    if (planned.transporters.length) {
      const r = await prisma.transporter.deleteMany({
        where: { id: { in: planned.transporters.map((x) => x.id) } },
      });
      deletions.transporters = r.count;
    }

    const after = await countAll(prisma);
    const afterFiles = await db.collection("fgEvidence.files").countDocuments();
    const afterChunks = await db.collection("fgEvidence.chunks").countDocuments();

    // Verify remaining users are not confirmed samples (except protected admin)
    const remainingUsers = await prisma.user.findMany();
    const remainingConfirmed = remainingUsers.filter(isConfirmedSampleUser);
    const unexpected = remainingConfirmed.filter(
      (u) =>
        !planned.protectedAdmin || u.employeeCode !== planned.protectedAdmin.employeeCode,
    );

    report.deletions = deletions;
    report.after = {
      ...after,
      "fgEvidence.files": afterFiles,
      "fgEvidence.chunks": afterChunks,
    };
    report.remainingConfirmedSampleUsers = remainingConfirmed.map((u) => ({
      employeeCode: u.employeeCode,
      email: u.email,
      protected: Boolean(
        planned.protectedAdmin && u.employeeCode === planned.protectedAdmin.employeeCode,
      ),
    }));
    report.verification = {
      unexpectedSampleUsers: unexpected.length,
      rolesPreserved: after.roles === before.roles,
      permissionsPreserved: after.permissions === before.permissions,
      templatesPreserved: after.checklist_templates === before.checklist_templates,
      itemsPreserved: after.checklist_items === before.checklist_items,
      adminRemains: after.users > 0,
    };

    fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
    fs.writeFileSync(args.report, JSON.stringify(report, null, 2));

    if (unexpected.length > 0) {
      throw new Error("Verification failed: unexpected confirmed sample users remain");
    }
    if (!report.verification.rolesPreserved || !report.verification.templatesPreserved) {
      throw new Error("Verification failed: configuration was altered");
    }

    console.log(
      JSON.stringify(
        {
          status:
            adminSafety.status === "ADMIN_REPLACEMENT_BLOCKED"
              ? "EXECUTED_ADMIN_PROTECTED"
              : "EXECUTED_OK",
          database: dbName,
          deletions,
          after: report.after,
          adminSafety: adminSafety.status,
          protectedAdmin: planned.protectedAdmin,
          report: args.report,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
    await mongo.close();
  }
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err).slice(0, 600));
  process.exit(1);
});
