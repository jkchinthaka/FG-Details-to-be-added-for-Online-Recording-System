/**
 * FG-DB-001 — draft deduplication concurrency against fg_online_test only.
 *
 * Requires RUN_DB_INTEGRATION=1 and DATABASE_URL → fg_online_test.
 */
import { PrismaClient, RecordStatus, TemplateStatus } from "../generated/prisma-client";
import { buildOperationalDraftDeduplicationKey } from "@nelna/shared";

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

describeIntegration("FG-DB-001 draft dedup (fg_online_test)", () => {
  jest.setTimeout(90_000);
  const prisma = new PrismaClient();
  let actorId: string;
  let dbOk = false;

  beforeAll(async () => {
    try {
      await prisma.$connect();
      let user = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            employeeCode: `DB001-${Date.now()}`,
            fullName: "Draft Dedup Test",
            passwordHash: "not-a-real-hash",
            status: "ACTIVE",
          },
        });
      }
      actorId = user.id;
      dbOk = true;
    } catch (error) {
      dbOk = false;
      // eslint-disable-next-line no-console
      console.error("FG-DB-001 beforeAll failed:", error);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedTemplate(code: string) {
    const template = await prisma.checklistTemplate.create({
      data: { code, title: code },
    });
    const version = await prisma.checklistTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        status: TemplateStatus.PUBLISHED,
      },
    });
    return { template, version };
  }

  async function cleanup(key: string, templateId: string, versionId: string) {
    await prisma.inspectionRecord.deleteMany({ where: { deduplicationKey: key } });
    await prisma.checklistTemplateVersion
      .delete({ where: { id: versionId } })
      .catch(() => undefined);
    await prisma.checklistTemplate
      .delete({ where: { id: templateId } })
      .catch(() => undefined);
  }

  it("20 simultaneous cleaning draft creates leave exactly one canonical row", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable");
    const stamp = `${Date.now()}-cl`;
    const { template, version } = await seedTemplate(`DB001/CL/${stamp}`);
    const key = buildOperationalDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/24",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: `AREA-${stamp}`,
    });

    const creates = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        prisma.inspectionRecord.create({
          data: {
            templateVersionId: version.id,
            documentCode: "NMS/PPU/CL/24",
            recordDate: new Date("2026-07-16"),
            createdById: actorId,
            status: RecordStatus.DRAFT,
            areaLabel: `AREA-${stamp}`,
            deduplicationKey: key,
          },
        }),
      ),
    );

    const fulfilled = creates.filter((c) => c.status === "fulfilled").length;
    const rejected = creates.filter((c) => c.status === "rejected").length;
    expect(fulfilled).toBe(1);
    expect(rejected).toBe(19);
    expect(
      await prisma.inspectionRecord.count({ where: { deduplicationKey: key } }),
    ).toBe(1);

    await cleanup(key, template.id, version.id);
  });

  it("20 simultaneous truck draft creates leave exactly one canonical row", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable");
    const stamp = `${Date.now()}-tr`;
    const { template, version } = await seedTemplate(`DB001/TR/${stamp}`);
    const key = buildOperationalDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/30",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: "BAY",
      vehicleNumber: `V-${stamp}`,
    });

    const creates = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        prisma.inspectionRecord.create({
          data: {
            templateVersionId: version.id,
            documentCode: "NMS/PPU/CL/30",
            recordDate: new Date("2026-07-16"),
            createdById: actorId,
            status: RecordStatus.DRAFT,
            areaLabel: "BAY",
            deduplicationKey: key,
          },
        }),
      ),
    );

    expect(creates.filter((c) => c.status === "fulfilled").length).toBe(1);
    expect(creates.filter((c) => c.status === "rejected").length).toBe(19);
    expect(
      await prisma.inspectionRecord.count({ where: { deduplicationKey: key } }),
    ).toBe(1);

    await cleanup(key, template.id, version.id);
  });

  it("exact client retry against the same key is idempotent at the index layer", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable");
    const stamp = `${Date.now()}-retry`;
    const { template, version } = await seedTemplate(`DB001/RT/${stamp}`);
    const key = buildOperationalDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/24",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: `RETRY-${stamp}`,
    });

    const first = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: "NMS/PPU/CL/24",
        recordDate: new Date("2026-07-16"),
        createdById: actorId,
        status: RecordStatus.DRAFT,
        deduplicationKey: key,
      },
    });
    await expect(
      prisma.inspectionRecord.create({
        data: {
          templateVersionId: version.id,
          documentCode: "NMS/PPU/CL/24",
          recordDate: new Date("2026-07-16"),
          createdById: actorId,
          status: RecordStatus.DRAFT,
          deduplicationKey: key,
        },
      }),
    ).rejects.toThrow();

    expect(
      await prisma.inspectionRecord.count({ where: { deduplicationKey: key } }),
    ).toBe(1);
    expect(first.id).toBeTruthy();
    await cleanup(key, template.id, version.id);
  });

  it("different shift/date/area/vehicle keys do not collide", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable");
    const stamp = `${Date.now()}-diff`;
    const { template, version } = await seedTemplate(`DB001/DF/${stamp}`);
    const keys = [
      buildOperationalDraftDeduplicationKey({
        documentCode: "NMS/PPU/CL/24",
        recordDateIso: "2026-07-16",
        shiftCode: "DAY",
        areaLabel: `A-${stamp}`,
      }),
      buildOperationalDraftDeduplicationKey({
        documentCode: "NMS/PPU/CL/24",
        recordDateIso: "2026-07-16",
        shiftCode: "NIGHT",
        areaLabel: `A-${stamp}`,
      }),
      buildOperationalDraftDeduplicationKey({
        documentCode: "NMS/PPU/CL/24",
        recordDateIso: "2026-07-17",
        shiftCode: "DAY",
        areaLabel: `A-${stamp}`,
      }),
      buildOperationalDraftDeduplicationKey({
        documentCode: "NMS/PPU/CL/24",
        recordDateIso: "2026-07-16",
        shiftCode: "DAY",
        areaLabel: `B-${stamp}`,
      }),
      buildOperationalDraftDeduplicationKey({
        documentCode: "NMS/PPU/CL/30",
        recordDateIso: "2026-07-16",
        shiftCode: "DAY",
        areaLabel: `A-${stamp}`,
        vehicleNumber: `V1-${stamp}`,
      }),
      buildOperationalDraftDeduplicationKey({
        documentCode: "NMS/PPU/CL/30",
        recordDateIso: "2026-07-16",
        shiftCode: "DAY",
        areaLabel: `A-${stamp}`,
        vehicleNumber: `V2-${stamp}`,
      }),
    ];

    for (const key of keys) {
      await prisma.inspectionRecord.create({
        data: {
          templateVersionId: version.id,
          documentCode: key.startsWith("NMS/PPU/CL/30")
            ? "NMS/PPU/CL/30"
            : "NMS/PPU/CL/24",
          recordDate: new Date("2026-07-16"),
          createdById: actorId,
          status: RecordStatus.DRAFT,
          deduplicationKey: key,
        },
      });
    }

    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(
        await prisma.inspectionRecord.count({ where: { deduplicationKey: key } }),
      ).toBe(1);
    }

    await prisma.inspectionRecord.deleteMany({
      where: { deduplicationKey: { in: keys } },
    });
    await prisma.checklistTemplateVersion.delete({ where: { id: version.id } });
    await prisma.checklistTemplate.delete({ where: { id: template.id } });
  });

  it("archived policy allow_new_draft: clearing key frees the scope", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable");
    const stamp = `${Date.now()}-arc`;
    const { template, version } = await seedTemplate(`DB001/AR/${stamp}`);
    const key = buildOperationalDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/24",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: `ARC-${stamp}`,
    });

    const archived = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: "NMS/PPU/CL/24",
        recordDate: new Date("2026-07-16"),
        createdById: actorId,
        status: RecordStatus.ARCHIVED,
        deduplicationKey: key,
      },
    });
    await prisma.inspectionRecord.update({
      where: { id: archived.id },
      data: { deduplicationKey: null },
    });

    const next = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: "NMS/PPU/CL/24",
        recordDate: new Date("2026-07-16"),
        createdById: actorId,
        status: RecordStatus.DRAFT,
        deduplicationKey: key,
      },
    });
    expect(next.id).not.toBe(archived.id);

    await prisma.inspectionRecord.deleteMany({
      where: { id: { in: [archived.id, next.id] } },
    });
    await prisma.checklistTemplateVersion.delete({ where: { id: version.id } });
    await prisma.checklistTemplate.delete({ where: { id: template.id } });
  });

  it("rejected policy resume: retained key blocks a second draft", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable");
    const stamp = `${Date.now()}-rej`;
    const { template, version } = await seedTemplate(`DB001/RJ/${stamp}`);
    const key = buildOperationalDraftDeduplicationKey({
      documentCode: "NMS/PPU/CL/24",
      recordDateIso: "2026-07-16",
      shiftCode: "DAY",
      areaLabel: `REJ-${stamp}`,
    });

    await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: "NMS/PPU/CL/24",
        recordDate: new Date("2026-07-16"),
        createdById: actorId,
        status: RecordStatus.REJECTED,
        deduplicationKey: key,
      },
    });
    await expect(
      prisma.inspectionRecord.create({
        data: {
          templateVersionId: version.id,
          documentCode: "NMS/PPU/CL/24",
          recordDate: new Date("2026-07-16"),
          createdById: actorId,
          status: RecordStatus.DRAFT,
          deduplicationKey: key,
        },
      }),
    ).rejects.toThrow();

    await cleanup(key, template.id, version.id);
  });
});
