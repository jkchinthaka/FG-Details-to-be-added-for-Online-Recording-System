/**
 * Read-only PostgreSQL export for historical cutover.
 * Set POSTGRES_DATABASE_URL to enable. Never mutates the source database.
 * When unset, exits 0 after reporting that source migration is not accessible.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = join(__dirname, "../../.tmp-migration/postgresql-export.json");

async function main() {
  const url = process.env.POSTGRES_DATABASE_URL?.trim();
  if (!url) {
    console.log(
      JSON.stringify({
        status: "SKIPPED",
        reason: "POSTGRES_DATABASE_URL not set — historical export not accessible",
      }),
    );
    return;
  }
  if (!url.startsWith("postgres")) {
    throw new Error("POSTGRES_DATABASE_URL must be a PostgreSQL connection string");
  }

  // Dynamic import keeps mongodb-only environments free of pg unless exporting.
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const tables = [
      "Role",
      "Permission",
      "RolePermission",
      "Department",
      "Section",
      "Shift",
      "User",
      "UserRole",
      "ChecklistTemplate",
      "ChecklistTemplateVersion",
      "ChecklistSection",
      "ChecklistItem",
      "ChecklistItemOption",
      "Vehicle",
      "Driver",
      "Transporter",
      "TaskAssignment",
      "InspectionRecord",
      "InspectionResult",
      "InspectionAttachment",
      "ApprovalRecord",
      "CorrectiveAction",
      "CorrectiveActionEvidence",
      "TruckInspectionDetail",
      "Notification",
      "AuditLog",
    ];
    const exportPayload: Record<string, unknown[]> = {};
    for (const table of tables) {
      try {
        const res = await client.query(`SELECT * FROM "${table}"`);
        exportPayload[table] = res.rows;
      } catch {
        exportPayload[table] = [];
      }
    }
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(
      OUT,
      JSON.stringify({ exportedAt: new Date().toISOString(), tables: exportPayload }),
    );
    console.log(
      JSON.stringify({
        status: "OK",
        path: OUT,
        counts: Object.fromEntries(
          Object.entries(exportPayload).map(([k, v]) => [k, v.length]),
        ),
      }),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 400));
  process.exit(1);
});
