/**
 * Unit tests for MongoDB partial unique index ensure rules.
 * Logic lives in scripts/database/mongo-index-ensure-rules.js (shared with ops scripts).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rules = require("../../../../scripts/database/mongo-index-ensure-rules.js") as {
  PRODUCTION_DB_NAME: string;
  CURRENT_VERSION_INDEX_NAME: string;
  USERNAME_PARTIAL_INDEX_NAME: string;
  USERNAME_PRISMA_INDEX_NAME: string;
  DRAFT_DEDUP_INDEX_NAME: string;
  CURRENT_VERSION_PARTIAL: Record<string, unknown>;
  USERNAME_PARTIAL: Record<string, unknown>;
  DRAFT_DEDUP_PARTIAL: Record<string, unknown>;
  extractDbName: (url: string) => string | null;
  redactCredentials: (message: string) => string;
  assertProductionDatabaseName: (name: string | null | undefined) => void;
  assertDatabaseAllowedForDraftDedupIndex: (name: string | null | undefined) => void;
  assertNoDuplicateUsernameGroups: (duplicates: unknown[]) => void;
  isCorrectCurrentVersionPartialIndex: (index: unknown) => boolean;
  isCorrectUsernamePartialIndex: (index: unknown) => boolean;
  isCorrectDraftDedupIndex: (index: unknown) => boolean;
  findIncompatibleUsernameIndexes: (indexes: unknown[]) => Array<{ name: string }>;
  findIncompatibleDraftDedupIndexes: (indexes: unknown[]) => Array<{ name: string }>;
  planCurrentVersionIndexAction: (indexes: unknown[]) => string;
  planUsernameIndexAction: (indexes: unknown[]) => string;
  planDraftDedupIndexAction: (indexes: unknown[]) => string;
};

describe("mongo-index-ensure-rules", () => {
  const correctCurrentVersion = {
    name: rules.CURRENT_VERSION_INDEX_NAME,
    unique: true,
    key: { currentVersionId: 1 },
    partialFilterExpression: rules.CURRENT_VERSION_PARTIAL,
  };

  const normalCurrentVersion = {
    name: rules.CURRENT_VERSION_INDEX_NAME,
    unique: true,
    key: { currentVersionId: 1 },
  };

  const correctUsernamePartial = {
    name: rules.USERNAME_PARTIAL_INDEX_NAME,
    unique: true,
    key: { username: 1 },
    partialFilterExpression: rules.USERNAME_PARTIAL,
  };

  const prismaUsername = {
    name: rules.USERNAME_PRISMA_INDEX_NAME,
    unique: true,
    key: { username: 1 },
  };

  it("extracts database name and rejects wrong production name", () => {
    expect(
      rules.extractDbName(
        "mongodb+srv://user:secret@cluster.mongodb.net/fg_online?retryWrites=true",
      ),
    ).toBe("fg_online");
    expect(() => rules.assertProductionDatabaseName("other_db")).toThrow(
      /Refuse: database must be fg_online/,
    );
    expect(() => rules.assertProductionDatabaseName("fg_online")).not.toThrow();
    expect(() => rules.assertProductionDatabaseName(null)).toThrow(/got none/);
  });

  it("redacts credentials from error messages", () => {
    const redacted = rules.redactCredentials(
      "failed mongodb+srv://admin:p@ss@cluster0.abc.mongodb.net/fg_online password=secret",
    );
    expect(redacted).not.toMatch(/p@ss/);
    expect(redacted).not.toMatch(/password=secret/);
    expect(redacted).toMatch(/mongodb:\/\/\[redacted\]/);
  });

  it("leaves a correct existing partial currentVersionId index unchanged", () => {
    expect(rules.isCorrectCurrentVersionPartialIndex(correctCurrentVersion)).toBe(true);
    expect(rules.planCurrentVersionIndexAction([correctCurrentVersion])).toBe(
      "unchanged",
    );
  });

  it("plans replace when currentVersionId index is a normal unique index", () => {
    expect(rules.isCorrectCurrentVersionPartialIndex(normalCurrentVersion)).toBe(false);
    expect(rules.planCurrentVersionIndexAction([normalCurrentVersion])).toBe("replace");
  });

  it("plans create when currentVersionId index is missing", () => {
    expect(rules.planCurrentVersionIndexAction([{ name: "_id_" }])).toBe("create");
  });

  it("leaves a correct username partial index unchanged", () => {
    expect(rules.isCorrectUsernamePartialIndex(correctUsernamePartial)).toBe(true);
    expect(rules.planUsernameIndexAction([correctUsernamePartial])).toBe("unchanged");
  });

  it("detects Prisma users_username_key as incompatible and plans replace", () => {
    const incompatible = rules.findIncompatibleUsernameIndexes([prismaUsername]);
    expect(incompatible.map((i) => i.name)).toContain(rules.USERNAME_PRISMA_INDEX_NAME);
    expect(rules.planUsernameIndexAction([prismaUsername])).toBe("replace");
  });

  it("plans replace when both Prisma and partial exist so leftovers are dropped", () => {
    expect(rules.planUsernameIndexAction([correctUsernamePartial, prismaUsername])).toBe(
      "replace",
    );
  });

  it("repeated planning with correct indexes stays unchanged (idempotent plan)", () => {
    expect(rules.planCurrentVersionIndexAction([correctCurrentVersion])).toBe(
      "unchanged",
    );
    expect(rules.planCurrentVersionIndexAction([correctCurrentVersion])).toBe(
      "unchanged",
    );
    expect(rules.planUsernameIndexAction([correctUsernamePartial])).toBe("unchanged");
    expect(rules.planUsernameIndexAction([correctUsernamePartial])).toBe("unchanged");
  });

  it("refuses index changes when duplicate usernames exist", () => {
    expect(() =>
      rules.assertNoDuplicateUsernameGroups([{ _id: "dup.user", count: 2 }]),
    ).toThrow(/Refuse: 1 duplicate username group/);
    expect(() => rules.assertNoDuplicateUsernameGroups([])).not.toThrow();
  });

  const correctDraftDedup = {
    name: rules.DRAFT_DEDUP_INDEX_NAME,
    unique: true,
    key: { deduplicationKey: 1 },
    partialFilterExpression: rules.DRAFT_DEDUP_PARTIAL,
  };

  const incorrectDraftDedup = {
    name: rules.DRAFT_DEDUP_INDEX_NAME,
    unique: true,
    sparse: true,
    key: { deduplicationKey: 1 },
  };

  it("verifies correct and incorrect draft dedup index definitions", () => {
    expect(rules.isCorrectDraftDedupIndex(correctDraftDedup)).toBe(true);
    expect(rules.isCorrectDraftDedupIndex(incorrectDraftDedup)).toBe(false);
    expect(rules.planDraftDedupIndexAction([correctDraftDedup])).toBe("unchanged");
    expect(rules.planDraftDedupIndexAction([incorrectDraftDedup])).toBe("replace");
    expect(rules.planDraftDedupIndexAction([])).toBe("create");
  });

  it("allows fg_online and fg_online_test for draft dedup scripts only", () => {
    expect(() =>
      rules.assertDatabaseAllowedForDraftDedupIndex("fg_online"),
    ).not.toThrow();
    expect(() =>
      rules.assertDatabaseAllowedForDraftDedupIndex("fg_online_test"),
    ).not.toThrow();
    expect(() => rules.assertDatabaseAllowedForDraftDedupIndex("other")).toThrow(
      /Refuse/,
    );
  });
});
