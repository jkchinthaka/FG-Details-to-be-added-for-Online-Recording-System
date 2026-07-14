const { PrismaClient } = require("../../apps/api/generated/prisma-client");
const prisma = new PrismaClient();

(async () => {
  const counts = {
    user: await prisma.user.count(),
    role: await prisma.role.count(),
    permission: await prisma.permission.count(),
    department: await prisma.department.count(),
    section: await prisma.section.count(),
    shift: await prisma.shift.count(),
    checklistTemplate: await prisma.checklistTemplate.count(),
    checklistTemplateVersion: await prisma.checklistTemplateVersion.count(),
    checklistItem: await prisma.checklistItem.count(),
    vehicle: await prisma.vehicle.count(),
    driver: await prisma.driver.count(),
    transporter: await prisma.transporter.count(),
    taskAssignment: await prisma.taskAssignment.count(),
    inspectionRecord: await prisma.inspectionRecord.count(),
    inspectionResult: await prisma.inspectionResult.count(),
    approvalRecord: await prisma.approvalRecord.count(),
    correctiveAction: await prisma.correctiveAction.count(),
    notification: await prisma.notification.count(),
    auditLog: await prisma.auditLog.count(),
  };
  console.log(JSON.stringify({ database: "fg_online", counts }, null, 2));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(String(e.message).slice(0, 300));
  await prisma.$disconnect();
  process.exit(1);
});
