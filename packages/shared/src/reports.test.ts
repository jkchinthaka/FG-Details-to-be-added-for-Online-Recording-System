import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsvDocument } from "./csv-escape";
import { REPORT_KINDS, reportFiltersSchema, reportKindsForRoles } from "./reports";

describe("escapeCsvCell", () => {
  it("quotes plain values", () => {
    expect(escapeCsvCell("ok")).toBe('"ok"');
  });

  it("escapes formula-injection prefixes", () => {
    expect(escapeCsvCell("=1+1")).toBe('"\'=1+1"');
    expect(escapeCsvCell("+cmd")).toBe('"\'+cmd"');
    expect(escapeCsvCell("-1")).toBe('"\'-1"');
    expect(escapeCsvCell("@sum")).toBe('"\'@sum"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("toCsvDocument", () => {
  it("builds CRLF rows", () => {
    const csv = toCsvDocument(["a", "b"], [["1", "=x"]]);
    expect(csv).toContain("\r\n");
    expect(csv.split("\r\n")[1]).toContain('"\'=x"');
  });
});

describe("reportFiltersSchema", () => {
  it("rejects inverted date ranges", () => {
    const result = reportFiltersSchema.safeParse({ fromDate: "2026-07-10", toDate: "2026-07-01" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid window", () => {
    const result = reportFiltersSchema.safeParse({ fromDate: "2026-07-01", toDate: "2026-07-14" });
    expect(result.success).toBe(true);
  });

  it("rejects ranges longer than 93 days", () => {
    const result = reportFiltersSchema.safeParse({ fromDate: "2026-01-01", toDate: "2026-04-05" });
    expect(result.success).toBe(false);
  });

  it("accepts an inclusive 93-day window", () => {
    const result = reportFiltersSchema.safeParse({ fromDate: "2026-01-01", toDate: "2026-04-03" });
    expect(result.success).toBe(true);
  });

  it("lists all 16 report kinds", () => {
    expect(REPORT_KINDS).toHaveLength(16);
  });
});

describe("reportKindsForRoles", () => {
  it("gives operators no catalog kinds (PDF-only)", () => {
    expect(reportKindsForRoles(["FG_OPERATOR"])).toEqual([]);
  });

  it("limits supervisors to operational kinds", () => {
    const kinds = reportKindsForRoles(["FG_SUPERVISOR"]);
    expect(kinds).toContain("pending_checks");
    expect(kinds).not.toContain("overdue_corrective_actions");
    expect(kinds).not.toContain("audit_activity_summary");
  });

  it("allows auditors the full catalog", () => {
    expect(reportKindsForRoles(["AUDITOR"])).toHaveLength(16);
  });
});
