/**
 * FG-CONC-001 — concurrent atomic workflow claims against fg_online_test only.
 *
 * Requires:
 *   RUN_DB_INTEGRATION=1
 *   DATABASE_URL pointing at database name exactly `fg_online_test`
 *
 * Never targets production `fg_online`.
 *
 * Claim races use updateMany (atomic without multi-doc txn). Side-effects
 * (approval/audit) run only after a successful claim so concurrent losers
 * never write duplicates. Production services still wrap claim+side-effects
 * in $transaction where the cluster supports it.
 */
import {
  ApprovalType,
  CorrectiveActionStatus,
  LoadingDecisionStatus,
  PrismaClient,
  RecordStatus,
  TemplateStatus,
} from "../generated/prisma-client";

/** Local claim helper — mirrors src assertSingleClaim without crossing prisma rootDir. */
function assertSingleClaim(result: { count: number }): void {
  if (result.count !== 1) {
    const error = new Error("STALE_STATE") as Error & {
      code: string;
      retryable: false;
      status: number;
    };
    error.code = "STALE_STATE";
    error.retryable = false;
    error.status = 409;
    throw error;
  }
}

function isStaleState(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "STALE_STATE"
  );
}

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

async function raceTwoClaims(
  claim: () => Promise<{ count: number }>,
): Promise<{ wins: number; staleThrows: number }> {
  const settled = await Promise.allSettled([claim(), claim()]);
  let wins = 0;
  let staleThrows = 0;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      if (result.value.count === 1) wins += 1;
      else throw new Error(`unexpected count=${result.value.count}`);
    } else if (isStaleState(result.reason)) {
      staleThrows += 1;
    } else {
      throw result.reason;
    }
  }
  return { wins, staleThrows };
}

describeIntegration("FG-CONC-001 concurrency (fg_online_test)", () => {
  jest.setTimeout(60_000);

  const prisma = new PrismaClient({
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  });
  let dbOk = true;
  let actorId: string;

  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$runCommandRaw({ ping: 1 });
      let user = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            employeeCode: `CONC-${Date.now()}`,
            email: `conc-${Date.now()}@example.local`,
            fullName: "Concurrency Test User",
            passwordHash: "not-a-real-hash-integration-only",
            status: "ACTIVE",
          },
        });
      }
      actorId = user.id;
      dbOk = true;
    } catch (error) {
      dbOk = false;
      // eslint-disable-next-line no-console
      console.error("FG-CONC-001 beforeAll failed:", error);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedRecord(status: RecordStatus, workflowVersion = 0) {
    if (!dbOk) throw new Error("MongoDB unavailable for FG-CONC-001 test");
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const template = await prisma.checklistTemplate.create({
      data: { code: `CONC/IR/${stamp}`, title: "CONC record" },
    });
    const version = await prisma.checklistTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        status: TemplateStatus.PUBLISHED,
        workflowVersion: 0,
      },
    });
    const record = await prisma.inspectionRecord.create({
      data: {
        templateVersionId: version.id,
        documentCode: template.code,
        recordDate: new Date("2026-07-16"),
        createdById: actorId,
        status,
        workflowVersion,
      },
    });
    return { template, version, record };
  }

  async function cleanupRecord(ids: {
    recordId: string;
    versionId: string;
    templateId: string;
  }) {
    await prisma.approvalRecord.deleteMany({ where: { recordId: ids.recordId } });
    await prisma.auditLog.deleteMany({
      where: { entityId: ids.recordId, entityType: "InspectionRecord" },
    });
    await prisma.truckInspectionDetail
      .deleteMany({ where: { recordId: ids.recordId } })
      .catch(() => undefined);
    await prisma.inspectionRecord
      .delete({ where: { id: ids.recordId } })
      .catch(() => undefined);
    await prisma.checklistTemplateVersion
      .delete({ where: { id: ids.versionId } })
      .catch(() => undefined);
    await prisma.checklistTemplate
      .delete({ where: { id: ids.templateId } })
      .catch(() => undefined);
  }

  function claimInspection(
    recordId: string,
    from: RecordStatus,
    to: RecordStatus,
    expectedVersion: number,
  ) {
    return async () => {
      const claimed = await prisma.inspectionRecord.updateMany({
        where: {
          id: recordId,
          status: from,
          workflowVersion: expectedVersion,
        },
        data: {
          status: to,
          workflowVersion: { increment: 1 },
        },
      });
      assertSingleClaim(claimed);
      return claimed;
    };
  }

  it.each([
    ["submit", RecordStatus.DRAFT, RecordStatus.PENDING_CHECK],
    ["check", RecordStatus.PENDING_CHECK, RecordStatus.PENDING_VERIFICATION],
    ["verify", RecordStatus.PENDING_VERIFICATION, RecordStatus.VERIFIED],
    ["return", RecordStatus.PENDING_CHECK, RecordStatus.RETURNED_FOR_CORRECTION],
    ["reject", RecordStatus.PENDING_VERIFICATION, RecordStatus.REJECTED],
    ["complete", RecordStatus.VERIFIED, RecordStatus.COMPLETED],
    ["void", RecordStatus.VERIFIED, RecordStatus.ARCHIVED],
  ] as const)(
    "inspection %s: exactly one of two concurrent claims wins",
    async (_label, from, to) => {
      const { template, version, record } = await seedRecord(from, 0);
      const race = await raceTwoClaims(claimInspection(record.id, from, to, 0));
      expect(race.wins).toBe(1);
      expect(race.staleThrows).toBe(1);

      const fresh = await prisma.inspectionRecord.findUniqueOrThrow({
        where: { id: record.id },
      });
      expect(fresh.status).toBe(to);
      expect(fresh.workflowVersion).toBe(1);

      await cleanupRecord({
        recordId: record.id,
        versionId: version.id,
        templateId: template.id,
      });
    },
  );

  it("inspection check: approval + audit stay unique under concurrent claim+side-effects", async () => {
    const { template, version, record } = await seedRecord(RecordStatus.PENDING_CHECK, 0);

    const run = async () => {
      const claimed = await prisma.inspectionRecord.updateMany({
        where: {
          id: record.id,
          status: RecordStatus.PENDING_CHECK,
          workflowVersion: 0,
        },
        data: {
          status: RecordStatus.PENDING_VERIFICATION,
          workflowVersion: { increment: 1 },
        },
      });
      assertSingleClaim(claimed);
      await prisma.approvalRecord.create({
        data: {
          recordId: record.id,
          approvalType: ApprovalType.CHECK,
          workflowCycle: 1,
          decision: "APPROVED",
          decidedById: actorId,
          decidedAt: new Date(),
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId,
          action: "RECORD_CHECKED",
          entityType: "InspectionRecord",
          entityId: record.id,
          metadata: { workflowCycle: 1 },
        },
      });
    };

    const settled = await Promise.allSettled([run(), run()]);
    const fulfilled = settled.filter((s) => s.status === "fulfilled").length;
    const stale = settled.filter(
      (s) => s.status === "rejected" && isStaleState(s.reason),
    ).length;
    expect(fulfilled).toBe(1);
    expect(stale).toBe(1);

    expect(
      await prisma.approvalRecord.count({
        where: { recordId: record.id, approvalType: ApprovalType.CHECK },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { entityId: record.id, action: "RECORD_CHECKED" },
      }),
    ).toBe(1);

    await cleanupRecord({
      recordId: record.id,
      versionId: version.id,
      templateId: template.id,
    });
  });

  it("lost successful response retry: second claim with same version gets STALE_STATE", async () => {
    const { template, version, record } = await seedRecord(RecordStatus.PENDING_CHECK, 0);
    const first = await claimInspection(
      record.id,
      RecordStatus.PENDING_CHECK,
      RecordStatus.PENDING_VERIFICATION,
      0,
    )();
    expect(first.count).toBe(1);

    await expect(
      claimInspection(
        record.id,
        RecordStatus.PENDING_CHECK,
        RecordStatus.PENDING_VERIFICATION,
        0,
      )(),
    ).rejects.toMatchObject({ code: "STALE_STATE", retryable: false });

    const fresh = await prisma.inspectionRecord.findUniqueOrThrow({
      where: { id: record.id },
    });
    expect(fresh.workflowVersion).toBe(1);

    await cleanupRecord({
      recordId: record.id,
      versionId: version.id,
      templateId: template.id,
    });
  });

  it("loading decision: exactly one concurrent claim wins", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable for FG-CONC-001 test");
    const { template, version, record } = await seedRecord(RecordStatus.PENDING_CHECK, 0);
    const detail = await prisma.truckInspectionDetail.create({
      data: {
        recordId: record.id,
        freezerTruckNumber: `FT-${Date.now()}`,
        vehicleNumber: `V-${Date.now()}`,
        loadingDecision: LoadingDecisionStatus.PENDING,
        workflowVersion: 0,
      },
    });

    const claim = async () => {
      const claimed = await prisma.truckInspectionDetail.updateMany({
        where: {
          id: detail.id,
          workflowVersion: 0,
          loadingDecision: LoadingDecisionStatus.PENDING,
        },
        data: {
          loadingDecision: LoadingDecisionStatus.APPROVED_FOR_LOADING,
          workflowVersion: { increment: 1 },
          decidedById: actorId,
          decidedAt: new Date(),
        },
      });
      assertSingleClaim(claimed);
      return claimed;
    };

    const race = await raceTwoClaims(claim);
    expect(race.wins).toBe(1);
    expect(race.staleThrows).toBe(1);

    const fresh = await prisma.truckInspectionDetail.findUniqueOrThrow({
      where: { id: detail.id },
    });
    expect(fresh.workflowVersion).toBe(1);
    expect(fresh.loadingDecision).toBe(LoadingDecisionStatus.APPROVED_FOR_LOADING);

    await cleanupRecord({
      recordId: record.id,
      versionId: version.id,
      templateId: template.id,
    });
  });

  it.each([
    ["assign", CorrectiveActionStatus.OPEN, CorrectiveActionStatus.ASSIGNED],
    ["start", CorrectiveActionStatus.ASSIGNED, CorrectiveActionStatus.IN_PROGRESS],
    [
      "complete",
      CorrectiveActionStatus.IN_PROGRESS,
      CorrectiveActionStatus.PENDING_VERIFICATION,
    ],
    [
      "verify",
      CorrectiveActionStatus.PENDING_VERIFICATION,
      CorrectiveActionStatus.CLOSED,
    ],
    [
      "reject",
      CorrectiveActionStatus.PENDING_VERIFICATION,
      CorrectiveActionStatus.REJECTED,
    ],
    ["reopen", CorrectiveActionStatus.REJECTED, CorrectiveActionStatus.REOPENED],
    ["cancel", CorrectiveActionStatus.OPEN, CorrectiveActionStatus.CANCELLED_WITH_REASON],
  ] as const)(
    "corrective-action %s: exactly one concurrent claim wins with one audit",
    async (label, from, to) => {
      if (!dbOk) throw new Error("MongoDB unavailable for FG-CONC-001 test");
      const stamp = `${Date.now()}-${label}-${Math.random().toString(36).slice(2, 6)}`;
      const ca = await prisma.correctiveAction.create({
        data: {
          actionNumber: `CONC-${stamp}`,
          title: `CONC CA ${stamp}`,
          description: "concurrency",
          status: from,
          workflowVersion: 0,
          createdById: actorId,
          assignedToId: actorId,
        },
      });

      const run = async () => {
        const claimed = await prisma.correctiveAction.updateMany({
          where: {
            id: ca.id,
            status: from,
            workflowVersion: 0,
          },
          data: {
            status: to,
            workflowVersion: { increment: 1 },
          },
        });
        assertSingleClaim(claimed);
        await prisma.auditLog.create({
          data: {
            actorId,
            action: `CA_${label.toUpperCase()}`,
            entityType: "CorrectiveAction",
            entityId: ca.id,
            metadata: {},
          },
        });
      };

      const settled = await Promise.allSettled([run(), run()]);
      expect(settled.filter((s) => s.status === "fulfilled").length).toBe(1);
      expect(
        settled.filter((s) => s.status === "rejected" && isStaleState(s.reason)).length,
      ).toBe(1);

      const fresh = await prisma.correctiveAction.findUniqueOrThrow({
        where: { id: ca.id },
      });
      expect(fresh.status).toBe(to);
      expect(fresh.workflowVersion).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityId: ca.id, entityType: "CorrectiveAction" },
        }),
      ).toBe(1);

      await prisma.auditLog.deleteMany({
        where: { entityId: ca.id, entityType: "CorrectiveAction" },
      });
      await prisma.correctiveAction.delete({ where: { id: ca.id } });
    },
  );

  it("template publish: exactly one concurrent claim wins with one audit", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable for FG-CONC-001 test");
    const stamp = `${Date.now()}-pub`;
    const template = await prisma.checklistTemplate.create({
      data: { code: `CONC/PUB/${stamp}`, title: "publish race" },
    });
    const version = await prisma.checklistTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        status: TemplateStatus.DRAFT,
        workflowVersion: 0,
      },
    });

    const run = async () => {
      const claimed = await prisma.checklistTemplateVersion.updateMany({
        where: {
          id: version.id,
          status: TemplateStatus.DRAFT,
          workflowVersion: 0,
        },
        data: {
          status: TemplateStatus.PUBLISHED,
          workflowVersion: { increment: 1 },
          publishedAt: new Date(),
          publishedById: actorId,
        },
      });
      assertSingleClaim(claimed);
      await prisma.auditLog.create({
        data: {
          actorId,
          action: "TEMPLATE_PUBLISHED",
          entityType: "ChecklistTemplateVersion",
          entityId: version.id,
          metadata: {},
        },
      });
    };

    const settled = await Promise.allSettled([run(), run()]);
    expect(settled.filter((s) => s.status === "fulfilled").length).toBe(1);
    expect(
      settled.filter((s) => s.status === "rejected" && isStaleState(s.reason)).length,
    ).toBe(1);

    const fresh = await prisma.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: version.id },
    });
    expect(fresh.status).toBe(TemplateStatus.PUBLISHED);
    expect(fresh.workflowVersion).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { entityId: version.id, action: "TEMPLATE_PUBLISHED" },
      }),
    ).toBe(1);

    await prisma.auditLog.deleteMany({ where: { entityId: version.id } });
    await prisma.checklistTemplateVersion.delete({ where: { id: version.id } });
    await prisma.checklistTemplate.delete({ where: { id: template.id } });
  });

  it("template archive: exactly one concurrent claim wins with one audit", async () => {
    if (!dbOk) throw new Error("MongoDB unavailable for FG-CONC-001 test");
    const stamp = `${Date.now()}-arc`;
    const template = await prisma.checklistTemplate.create({
      data: { code: `CONC/ARC/${stamp}`, title: "archive race" },
    });
    const version = await prisma.checklistTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        status: TemplateStatus.PUBLISHED,
        workflowVersion: 0,
      },
    });

    const run = async () => {
      const claimed = await prisma.checklistTemplateVersion.updateMany({
        where: {
          id: version.id,
          status: TemplateStatus.PUBLISHED,
          workflowVersion: 0,
        },
        data: {
          status: TemplateStatus.ARCHIVED,
          workflowVersion: { increment: 1 },
        },
      });
      assertSingleClaim(claimed);
      await prisma.auditLog.create({
        data: {
          actorId,
          action: "TEMPLATE_ARCHIVED",
          entityType: "ChecklistTemplateVersion",
          entityId: version.id,
          metadata: {},
        },
      });
    };

    const settled = await Promise.allSettled([run(), run()]);
    expect(settled.filter((s) => s.status === "fulfilled").length).toBe(1);
    expect(
      settled.filter((s) => s.status === "rejected" && isStaleState(s.reason)).length,
    ).toBe(1);

    const fresh = await prisma.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: version.id },
    });
    expect(fresh.status).toBe(TemplateStatus.ARCHIVED);
    expect(fresh.workflowVersion).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { entityId: version.id, action: "TEMPLATE_ARCHIVED" },
      }),
    ).toBe(1);

    await prisma.auditLog.deleteMany({ where: { entityId: version.id } });
    await prisma.checklistTemplateVersion.delete({ where: { id: version.id } });
    await prisma.checklistTemplate.delete({ where: { id: template.id } });
  });
});
