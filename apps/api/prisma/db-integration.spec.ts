/**
 * PostgreSQL integration tests against a dedicated TEST database only.
 *
 * Requires:
 *   DATABASE_URL pointing at nelna_fg_test (see docker-compose.test.yml)
 *   RUN_DB_INTEGRATION=1
 *
 * Skips automatically when the flag/DB is unavailable — never targets
 * development or production data.
 */
import { PrismaClient, RecordStatus, TemplateStatus } from "../generated/prisma-client";

const shouldRun =
  process.env.RUN_DB_INTEGRATION === "1" &&
  Boolean(process.env.DATABASE_URL?.includes("nelna_fg_test"));

const describeIntegration = shouldRun ? describe : describe.skip;

describeIntegration("PostgreSQL integration (nelna_fg_test only)", () => {
  const prisma = new PrismaClient();
  let dbOk = true;

  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    if (!dbOk) {
      console.warn("Skipping: dedicated test Postgres unreachable");
    }
  });

  it("enforces unique template version numbers for one template", async () => {
    if (!dbOk) return;
    const template = await prisma.checklistTemplate.create({
      data: { code: `INT/TV/${Date.now()}`, title: "Integration template" },
    });
    await prisma.checklistTemplateVersion.create({
      data: { templateId: template.id, versionNumber: 1, status: TemplateStatus.DRAFT },
    });
    await expect(
      prisma.checklistTemplateVersion.create({
        data: { templateId: template.id, versionNumber: 1, status: TemplateStatus.DRAFT },
      }),
    ).rejects.toThrow();
    await prisma.checklistTemplateVersion.deleteMany({
      where: { templateId: template.id },
    });
    await prisma.checklistTemplate.delete({ where: { id: template.id } });
  });

  it("keeps historical template version references (Restrict delete)", async () => {
    if (!dbOk) return;
    const template = await prisma.checklistTemplate.create({
      data: { code: `INT/HIST/${Date.now()}`, title: "Historical ref template" },
    });
    const version = await prisma.checklistTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        status: TemplateStatus.PUBLISHED,
      },
    });
    const user = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    if (!user) {
      console.warn("Skipping historical ref: no seed user");
      await prisma.checklistTemplateVersion.delete({ where: { id: version.id } });
      await prisma.checklistTemplate.delete({ where: { id: template.id } });
      return;
    }
    const record = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: template.code,
        recordDate: new Date("2026-07-14"),
        createdById: user.id,
        status: RecordStatus.DRAFT,
      },
    });
    await expect(
      prisma.checklistTemplateVersion.delete({ where: { id: version.id } }),
    ).rejects.toThrow();
    await prisma.inspectionRecord.delete({ where: { id: record.id } });
    await prisma.checklistTemplateVersion.delete({ where: { id: version.id } });
    await prisma.checklistTemplate.delete({ where: { id: template.id } });
  });

  it("rolls back transactions leaving no orphan record", async () => {
    if (!dbOk) return;
    const before = await prisma.inspectionRecord.count();
    try {
      await prisma.$transaction(async (tx) => {
        const template = await tx.checklistTemplate.create({
          data: { code: `INT/TX/${Date.now()}`, title: "TX template" },
        });
        const version = await tx.checklistTemplateVersion.create({
          data: {
            templateId: template.id,
            versionNumber: 1,
            status: TemplateStatus.DRAFT,
          },
        });
        const user = await tx.user.findFirst({ where: { status: "ACTIVE" } });
        if (!user) throw new Error("no user for tx test");
        await tx.inspectionRecord.create({
          data: {
            templateVersionId: version.id,
            documentCode: template.code,
            recordDate: new Date("2026-07-14"),
            createdById: user.id,
          },
        });
        throw new Error("force-rollback");
      });
    } catch {
      // expected
    }
    const after = await prisma.inspectionRecord.count();
    expect(after).toBe(before);
  });

  it("archives records without hard delete", async () => {
    if (!dbOk) return;
    const user = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    const version = await prisma.checklistTemplateVersion.findFirst({
      where: { status: TemplateStatus.PUBLISHED },
    });
    if (!user || !version) {
      console.warn("Skipping archive test: seed incomplete");
      return;
    }
    const record = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: "NMS/PPU/CL/24",
        recordDate: new Date("2026-07-01"),
        createdById: user.id,
        status: RecordStatus.VERIFIED,
      },
    });
    const archived = await prisma.inspectionRecord.update({
      where: { id: record.id },
      data: { status: RecordStatus.ARCHIVED, archivedAt: new Date() },
    });
    expect(archived.status).toBe(RecordStatus.ARCHIVED);
    const stillThere = await prisma.inspectionRecord.findUnique({
      where: { id: record.id },
    });
    expect(stillThere).not.toBeNull();
    await prisma.inspectionRecord.delete({ where: { id: record.id } });
  });

  it("prevents duplicate vehicle numbers", async () => {
    if (!dbOk) return;
    const number = `TST-${Date.now()}`;
    await prisma.vehicle.create({
      data: { vehicleNumber: number, freezerTruckNumber: `F-${number}` },
    });
    await expect(
      prisma.vehicle.create({
        data: { vehicleNumber: number, freezerTruckNumber: `F2-${number}` },
      }),
    ).rejects.toThrow();
    await prisma.vehicle.deleteMany({ where: { vehicleNumber: number } });
  });

  it("links corrective actions to records and optional results", async () => {
    if (!dbOk) return;
    const user = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    const version = await prisma.checklistTemplateVersion.findFirst({
      where: { status: TemplateStatus.PUBLISHED },
    });
    if (!user || !version) return;
    const record = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: "NMS/PPU/CL/24",
        recordDate: new Date("2026-07-02"),
        createdById: user.id,
      },
    });
    const ca = await prisma.correctiveAction.create({
      data: {
        recordId: record.id,
        title: "Integration CA",
        description: "Created by db-integration.spec",
        status: "OPEN",
        priority: "MEDIUM",
        createdById: user.id,
      },
    });
    expect(ca.recordId).toBe(record.id);
    await prisma.correctiveAction.delete({ where: { id: ca.id } });
    await prisma.inspectionRecord.delete({ where: { id: record.id } });
  });

  it("supports re-inspection chain via reinspectionOfId", async () => {
    if (!dbOk) return;
    const user = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    const version = await prisma.checklistTemplateVersion.findFirst({
      where: { status: TemplateStatus.PUBLISHED },
      include: { template: true },
    });
    if (!user || !version) return;
    const previous = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: version.template.code,
        recordDate: new Date("2026-07-03"),
        createdById: user.id,
        status: RecordStatus.VERIFIED,
      },
    });
    const reinsp = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: version.template.code,
        recordDate: new Date("2026-07-04"),
        createdById: user.id,
        reinspectionOfId: previous.id,
      },
    });
    expect(reinsp.reinspectionOfId).toBe(previous.id);
    await prisma.inspectionRecord.delete({ where: { id: reinsp.id } });
    await prisma.inspectionRecord.delete({ where: { id: previous.id } });
  });
});
