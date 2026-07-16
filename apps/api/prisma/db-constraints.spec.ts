/**
 * Live-database constraint tests. Skipped automatically when DATABASE_URL
 * isn't set or MongoDB isn't reachable — run against fg_online_test (never
 * fg_online) locally/CI to exercise them for real.
 */
import { PrismaClient } from "../generated/prisma-client";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const runLiveDbConstraints = process.env.RUN_DB_CONSTRAINT_TESTS === "true";
const describeIfDb = hasDatabaseUrl && runLiveDbConstraints ? describe : describe.skip;

describeIfDb("checklist template version constraints (requires DATABASE_URL)", () => {
  const prisma = new PrismaClient();
  let dbReachable = true;
  let templateId: string;

  beforeAll(async () => {
    try {
      await prisma.$connect();
    } catch {
      dbReachable = false;
      return;
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        code: `TEST/DB-CONSTRAINTS/${Date.now()}`,
        title: "Constraint test template",
      },
    });
    templateId = template.id;
    // Occupy currentVersionId immediately so parallel suites can create other
    // draft templates under MongoDB's default non-sparse unique semantics.
    const placeholder = await prisma.checklistTemplateVersion.create({
      data: { templateId, versionNumber: 100, status: "DRAFT" },
    });
    await prisma.checklistTemplate.update({
      where: { id: templateId },
      data: { currentVersionId: placeholder.id },
    });
  });

  afterAll(async () => {
    if (dbReachable && templateId) {
      await prisma.checklistTemplate
        .update({
          where: { id: templateId },
          data: { currentVersionId: null },
        })
        .catch(() => undefined);
      await prisma.checklistTemplateVersion
        .deleteMany({ where: { templateId } })
        .catch(() => undefined);
      await prisma.checklistTemplate
        .delete({ where: { id: templateId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("rejects a duplicate version number for the same template", async () => {
    if (!dbReachable) {
      console.warn("Skipping: MongoDB not reachable at DATABASE_URL");
      return;
    }

    await prisma.checklistTemplateVersion.create({
      data: { templateId, versionNumber: 1 },
    });

    await expect(
      prisma.checklistTemplateVersion.create({
        data: { templateId, versionNumber: 1 },
      }),
    ).rejects.toThrow();
  });

  it("allows sequential version numbers for the same template", async () => {
    if (!dbReachable) {
      console.warn("Skipping: MongoDB not reachable at DATABASE_URL");
      return;
    }

    await expect(
      prisma.checklistTemplateVersion.create({
        data: { templateId, versionNumber: 2 },
      }),
    ).resolves.toMatchObject({ versionNumber: 2 });
  });
});
