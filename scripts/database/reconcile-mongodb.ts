/**
 * Reconciles MongoDB fg_online document counts after seed or import.
 * Prints collection counts only — never prints PII or connection strings.
 */
import { PrismaClient } from "../../apps/api/generated/prisma-client";

function databaseNameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/([^/?]+)(?:\?|$)/);
  return match?.[1] ?? null;
}

async function main() {
  const dbName = databaseNameFromUrl(process.env.DATABASE_URL);
  if (dbName !== "fg_online" && dbName !== "fg_online_test") {
    throw new Error("Refuse reconcile: database must be fg_online or fg_online_test");
  }

  const prisma = new PrismaClient();
  try {
    const counts = {
      users: await prisma.user.count(),
      roles: await prisma.role.count(),
      permissions: await prisma.permission.count(),
      user_roles: await prisma.userRole.count(),
      role_permissions: await prisma.rolePermission.count(),
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
      vehicles: await prisma.vehicle.count(),
      drivers: await prisma.driver.count(),
      transporters: await prisma.transporter.count(),
      notifications: await prisma.notification.count(),
      audit_logs: await prisma.auditLog.count(),
    };
    console.log(JSON.stringify({ database: dbName, counts }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 400));
  process.exit(1);
});
