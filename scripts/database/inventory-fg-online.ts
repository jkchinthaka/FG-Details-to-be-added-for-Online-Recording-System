/**
 * Safe inventory of fg_online for sample-data cleanup planning.
 * Prints classification keys only — no passwords or connection strings.
 */
import { PrismaClient } from "../../apps/api/generated/prisma-client";

function databaseNameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/([^/?]+)(?:\?|$)/);
  return match?.[1] ?? null;
}

async function main() {
  const dbName = databaseNameFromUrl(process.env.DATABASE_URL);
  if (dbName !== "fg_online") {
    throw new Error(`Refuse inventory: expected fg_online, got ${dbName ?? "none"}`);
  }
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        employeeCode: true,
        status: true,
        roles: { include: { role: { select: { name: true } } } },
      },
    });
    const vehicles = await prisma.vehicle.findMany({
      select: { id: true, vehicleNumber: true, freezerTruckNumber: true },
    });
    const drivers = await prisma.driver.findMany({
      select: { id: true, fullName: true, licenseNumber: true },
    });
    const transporters = await prisma.transporter.findMany({
      select: { id: true, name: true },
    });
    const counts = {
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
    console.log(
      JSON.stringify(
        {
          database: dbName,
          users: users.map((u) => ({
            employeeCode: u.employeeCode,
            email: u.email,
            status: u.status,
            roles: u.roles.map((r) => r.role.name),
          })),
          vehicles: vehicles.map((v) => v.vehicleNumber),
          drivers: drivers.map((d) => d.licenseNumber),
          transporters: transporters.map((t) => t.name),
          counts,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 400));
  process.exit(1);
});
