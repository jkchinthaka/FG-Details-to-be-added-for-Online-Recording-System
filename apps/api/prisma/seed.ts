/**
 * Idempotent database seed for the Nelna FG Digital Recording System.
 *
 * Safe to run repeatedly: every write is an upsert keyed on a natural unique
 * field (code/name/employeeCode/etc). Sample user accounts are only created
 * when their env-controlled email + password are both present — see
 * seed-data.ts / .env.example. No real credentials are ever hard-coded here.
 *
 * Run with: pnpm --filter @nelna/api exec prisma db seed
 */
import bcrypt from "bcrypt";
import {
  PrismaClient,
  TemplateStatus,
  type ChecklistItemType,
} from "../generated/prisma-client";
import {
  CHECKLIST_TEMPLATE_SEEDS,
  DEPARTMENT_SEEDS,
  DRIVER_SEEDS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  SHIFT_SEEDS,
  TRANSPORTER_SEEDS,
  VEHICLE_SEEDS,
  buildTodaysTaskAssignmentSeeds,
  resolveAllSeedUsers,
  type ChecklistTemplateSeed,
} from "./seed-data";

const prisma = new PrismaClient();
const BCRYPT_SALT_ROUNDS = 12;

async function seedPermissions() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key },
      update: {},
    });
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions`);
}

async function seedRoles() {
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      create: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
      update: {
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
    });

    for (const permissionKey of roleDef.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }
  console.log(`Seeded ${ROLE_DEFINITIONS.length} roles`);
}

async function seedOrganization() {
  for (const dept of DEPARTMENT_SEEDS) {
    const department = await prisma.department.upsert({
      where: { code: dept.code },
      create: { code: dept.code, name: dept.name, description: dept.description },
      update: { name: dept.name, description: dept.description },
    });

    for (const section of dept.sections) {
      await prisma.section.upsert({
        where: { code: section.code },
        create: {
          code: section.code,
          name: section.name,
          departmentId: department.id,
        },
        update: { name: section.name, departmentId: department.id },
      });
    }
  }

  for (const shift of SHIFT_SEEDS) {
    await prisma.shift.upsert({
      where: { code: shift.code },
      create: shift,
      update: shift,
    });
  }
  console.log(
    `Seeded ${DEPARTMENT_SEEDS.length} departments and ${SHIFT_SEEDS.length} shifts`,
  );
}

async function seedChecklistTemplate(template: ChecklistTemplateSeed) {
  const existing = await prisma.checklistTemplate.findUnique({
    where: { code: template.code },
    include: { currentVersion: true },
  });

  if (existing?.currentVersion?.status === TemplateStatus.PUBLISHED) {
    // Already seeded and published — versions are immutable once published,
    // so re-running the seed must not touch sections/items again.
    console.log(`Checklist template ${template.code} already published, skipping`);
    return;
  }

  const checklistTemplate = await prisma.checklistTemplate.upsert({
    where: { code: template.code },
    create: {
      code: template.code,
      title: template.title,
      description: template.description,
    },
    update: {
      title: template.title,
      description: template.description,
    },
  });

  const version = await prisma.checklistTemplateVersion.create({
    data: {
      templateId: checklistTemplate.id,
      versionNumber: 1,
      status: TemplateStatus.PUBLISHED,
      publishedAt: new Date(),
      sections: {
        create: template.sections.map((section, sectionIndex) => ({
          name: section.name,
          sortOrder: sectionIndex,
          items: {
            create: section.items.map((item, itemIndex) => ({
              label: item.label,
              helpText: item.helpText,
              sortOrder: itemIndex,
              itemType: (item.itemType ??
                "ACCEPTABLE_UNACCEPTABLE_NA") as ChecklistItemType,
              allowNotApplicable: item.allowNotApplicable ?? false,
              requiresEvidenceOnFail: item.requiresEvidenceOnFail ?? false,
              isCriticalFailure: item.isCriticalFailure ?? false,
              remarkRequiredOnFail: item.remarkRequiredOnFail ?? false,
              correctiveActionRequiredOnFail:
                item.correctiveActionRequiredOnFail ?? false,
              minValue: item.minValue,
              maxValue: item.maxValue,
            })),
          },
        })),
      },
    },
  });

  await prisma.checklistTemplate.update({
    where: { id: checklistTemplate.id },
    data: { currentVersionId: version.id },
  });

  console.log(`Seeded checklist template ${template.code} v1 (published)`);
}

async function seedChecklistTemplates() {
  for (const template of CHECKLIST_TEMPLATE_SEEDS) {
    await seedChecklistTemplate(template);
  }
}

async function seedFleet() {
  for (const transporter of TRANSPORTER_SEEDS) {
    await prisma.transporter.upsert({
      where: { name: transporter.name },
      create: { name: transporter.name, contactPhone: transporter.contactPhone },
      update: { contactPhone: transporter.contactPhone },
    });
  }

  for (const vehicle of VEHICLE_SEEDS) {
    const transporter = await prisma.transporter.findUnique({
      where: { name: vehicle.transporterName },
    });
    await prisma.vehicle.upsert({
      where: { vehicleNumber: vehicle.vehicleNumber },
      create: {
        vehicleNumber: vehicle.vehicleNumber,
        freezerTruckNumber: vehicle.freezerTruckNumber,
        qrIdentifier: `QR-${vehicle.vehicleNumber}`,
        transporterId: transporter?.id,
      },
      update: {
        freezerTruckNumber: vehicle.freezerTruckNumber,
        qrIdentifier: `QR-${vehicle.vehicleNumber}`,
        transporterId: transporter?.id,
      },
    });
  }

  for (const driver of DRIVER_SEEDS) {
    const transporter = await prisma.transporter.findUnique({
      where: { name: driver.transporterName },
    });
    await prisma.driver.upsert({
      where: { licenseNumber: driver.licenseNumber },
      create: {
        fullName: driver.fullName,
        licenseNumber: driver.licenseNumber,
        transporterId: transporter?.id,
      },
      update: {
        fullName: driver.fullName,
        transporterId: transporter?.id,
      },
    });
  }

  console.log(
    `Seeded ${TRANSPORTER_SEEDS.length} transporters, ${VEHICLE_SEEDS.length} vehicles and ${DRIVER_SEEDS.length} drivers`,
  );
}

async function seedSampleUsers() {
  const users = resolveAllSeedUsers(process.env);

  if (users.length === 0) {
    console.log(
      "No SEED_*_EMAIL / SEED_*_PASSWORD pairs configured — skipping sample user creation. " +
        "See apps/api/.env.example for the variables that enable this.",
    );
    return;
  }

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, BCRYPT_SALT_ROUNDS);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: user.role } });

    const dbUser = await prisma.user.upsert({
      where: { employeeCode: user.employeeCode },
      create: {
        employeeCode: user.employeeCode,
        email: user.email,
        fullName: user.fullName,
        passwordHash,
      },
      update: {
        email: user.email,
        fullName: user.fullName,
        passwordHash,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: dbUser.id, roleId: role.id } },
      create: { userId: dbUser.id, roleId: role.id },
      update: {},
    });

    console.log(`Seeded sample user ${user.employeeCode} (${user.role})`);
  }
}

/**
 * Sample "Today's Tasks" for every seeded FG Operator — env-controlled (only
 * runs for the operators seedSampleUsers() actually created) and idempotent:
 * upserts on the (assignedToId, templateCode, dueDate) unique constraint, so
 * re-running the seed on the same day never duplicates or resets progress
 * an operator has already made on today's assignments.
 */
async function seedTaskAssignments() {
  const users = resolveAllSeedUsers(process.env);
  const operatorCodes = users
    .filter((user) => user.role === "FG_OPERATOR")
    .map((user) => user.employeeCode);

  if (operatorCodes.length === 0) {
    console.log(
      "No seeded FG Operator accounts — skipping Today's Tasks sample assignments",
    );
    return;
  }

  const assignmentSeeds = buildTodaysTaskAssignmentSeeds(new Date());
  let created = 0;

  for (const employeeCode of operatorCodes) {
    const operator = await prisma.user.findUnique({ where: { employeeCode } });
    if (!operator) continue;

    for (const assignment of assignmentSeeds) {
      const shift = await prisma.shift.findUnique({
        where: { code: assignment.shiftCode },
      });

      await prisma.taskAssignment.upsert({
        where: {
          assignedToId_templateCode_dueDate: {
            assignedToId: operator.id,
            templateCode: assignment.templateCode,
            dueDate: assignment.dueDate,
          },
        },
        create: {
          assignedToId: operator.id,
          templateCode: assignment.templateCode,
          areaLabel: assignment.areaLabel,
          shiftId: shift?.id,
          dueDate: assignment.dueDate,
        },
        // Never overwrite status/progress on a rerun — only backfills area/shift metadata.
        update: {
          areaLabel: assignment.areaLabel,
          shiftId: shift?.id,
        },
      });
      created += 1;
    }
  }

  console.log(
    `Seeded ${created} Today's Tasks assignment(s) for ${operatorCodes.length} operator(s)`,
  );
}

async function main() {
  const demoEnabled = process.env.ENABLE_DEMO_SEED === "true";
  if (demoEnabled && process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing ENABLE_DEMO_SEED=true when NODE_ENV=production — demo operational data is not allowed in production",
    );
  }

  // REFERENCE_CONFIGURATION — always safe for production
  await seedPermissions();
  await seedRoles();
  await seedOrganization();
  await seedChecklistTemplates();

  // SAMPLE_OPERATIONAL_DATA — opt-in local/demo only
  if (!demoEnabled) {
    console.log(
      "Demo operational seed skipped (fleet/users/tasks). Set ENABLE_DEMO_SEED=true for local demo data only.",
    );
    return;
  }

  console.log("ENABLE_DEMO_SEED=true — seeding demo fleet, users, and sample tasks");
  await seedFleet();
  await seedSampleUsers();
  await seedTaskAssignments();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
