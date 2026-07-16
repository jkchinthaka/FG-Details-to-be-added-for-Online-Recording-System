/**
 * P0 concurrency primitives against fg_online_test only.
 * Requires RUN_DB_INTEGRATION=1 and DATABASE_URL containing fg_online_test.
 */
import { PrismaClient, RecordStatus } from "../generated/prisma-client";
import { buildDraftDeduplicationKey } from "@nelna/shared";

function databaseNameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/([^/?]+)(?:\?|$)/);
  return match?.[1] ?? null;
}

const dbName = databaseNameFromUrl(process.env.DATABASE_URL);
const shouldRun =
  process.env.RUN_DB_INTEGRATION === "1" &&
  dbName === "fg_online_test" &&
  Boolean(process.env.DATABASE_URL?.includes("fg_online_test"));

const describeIntegration = shouldRun ? describe : describe.skip;

describeIntegration("P0 concurrency (fg_online_test)", () => {
  const prisma = new PrismaClient();
  let dbOk = true;

  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$runCommandRaw({ ping: 1 });
    } catch {
      dbOk = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("claims exactly one of two concurrent workflowVersion updates", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable for P0 concurrency test");
    const user = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    if (!user) throw new Error("Seed user required — do not skip silently");

    const template = await prisma.checklistTemplate.create({
      data: { code: `P0/WF/${Date.now()}`, title: "P0 workflow" },
    });
    const version = await prisma.checklistTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        status: "PUBLISHED",
        workflowVersion: 0,
      },
    });
    const record = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: template.code,
        recordDate: new Date("2026-07-16"),
        createdById: user.id,
        status: RecordStatus.PENDING_CHECK,
        workflowVersion: 0,
      },
    });

    const results = await Promise.all(
      [0, 1].map(() =>
        prisma.inspectionRecord.updateMany({
          where: {
            id: record.id,
            status: RecordStatus.PENDING_CHECK,
            workflowVersion: 0,
          },
          data: {
            status: RecordStatus.PENDING_VERIFICATION,
            workflowVersion: { increment: 1 },
          },
        }),
      ),
    );

    const wins = results.filter((r) => r.count === 1).length;
    const losses = results.filter((r) => r.count === 0).length;
    expect(wins).toBe(1);
    expect(losses).toBe(1);

    await prisma.inspectionRecord.delete({ where: { id: record.id } });
    await prisma.checklistTemplateVersion.delete({ where: { id: version.id } });
    await prisma.checklistTemplate.delete({ where: { id: template.id } });
  });

  it("deduplicationKey unique sparse index rejects duplicate active drafts", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable for P0 concurrency test");
    const user = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    if (!user) throw new Error("Seed user required — do not skip silently");

    const key = buildDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/24",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: `P0-DEDUP-${Date.now()}`,
    });

    const template = await prisma.checklistTemplate.create({
      data: { code: `P0/DD/${Date.now()}`, title: "P0 dedup" },
    });
    const version = await prisma.checklistTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        status: "PUBLISHED",
      },
    });

    const first = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: "NMS/PPU/CL/24",
        recordDate: new Date("2026-07-16"),
        createdById: user.id,
        status: RecordStatus.DRAFT,
        deduplicationKey: key,
        areaLabel: key,
      },
    });

    const creates = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        prisma.inspectionRecord.create({
          data: {
            templateVersionId: version.id,
            documentCode: "NMS/PPU/CL/24",
            recordDate: new Date("2026-07-16"),
            createdById: user.id,
            status: RecordStatus.DRAFT,
            deduplicationKey: key,
            areaLabel: key,
          },
        }),
      ),
    );

    const fulfilled = creates.filter((c) => c.status === "fulfilled").length;
    const rejected = creates.filter((c) => c.status === "rejected").length;
    expect(fulfilled).toBe(0);
    expect(rejected).toBe(20);

    await prisma.inspectionRecord.deleteMany({ where: { deduplicationKey: key } });
    await prisma.inspectionRecord.delete({ where: { id: first.id } }).catch(() => undefined);
    await prisma.checklistTemplateVersion.delete({ where: { id: version.id } });
    await prisma.checklistTemplate.delete({ where: { id: template.id } });
  });
});
