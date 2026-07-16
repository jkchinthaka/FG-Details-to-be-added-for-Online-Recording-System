import {
  assertProductionDatabaseName,
  redactDatabaseErrorMessage,
  summarizeDatabaseUrl,
} from "./diagnose-database-rules";

describe("diagnose-database-rules", () => {
  it("summarizes SRV URLs without exposing credentials", () => {
    const summary = summarizeDatabaseUrl(
      "mongodb+srv://user:secret@cluster0.example.mongodb.net/fg_online?retryWrites=true",
    );
    expect(summary).toEqual({
      provider: "mongodb",
      usesSrv: true,
      databaseName: "fg_online",
      isProductionDatabase: true,
    });
  });

  it("rejects missing DATABASE_URL", () => {
    expect(() => summarizeDatabaseUrl(undefined)).toThrow(/DATABASE_URL/);
  });

  it("asserts production database name", () => {
    expect(() => assertProductionDatabaseName("fg_online")).not.toThrow();
    expect(() => assertProductionDatabaseName("fg_online_test")).toThrow(/fg_online/);
  });

  it("redacts credentials and hosts from error messages", () => {
    const raw =
      "MongoServerError mongodb+srv://user:SuperSecret99@cluster0.abc.mongodb.net/fg_online password=leak";
    const safe = redactDatabaseErrorMessage(raw);
    expect(safe).not.toContain("SuperSecret99");
    expect(safe).not.toContain("password=leak");
    expect(safe).not.toContain("cluster0.abc.mongodb.net");
    expect(safe).toMatch(/\[redacted/);
  });
});
