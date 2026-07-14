import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  DOCUMENT_CODES,
  OFFICIAL_RECORD_APPROVAL_DISCLAIMER,
  escapeCsvCell,
  reportFiltersSchema,
  toCsvDocument,
} from "@nelna/shared";
import { ReportsService } from "./reports.service";
import { buildOfficialRecordPdf } from "./record-pdf.builder";

describe("ReportsService helpers and PDF builder", () => {
  it("rejects inverted filters via shared schema", () => {
    expect(
      reportFiltersSchema.safeParse({ fromDate: "2026-07-10", toDate: "2026-07-01" })
        .success,
    ).toBe(false);
  });

  it("escapes CSV injection prefixes", () => {
    expect(escapeCsvCell("=cmd")).toContain("'=");
    const doc = toCsvDocument(["h"], [["+hack"]]);
    expect(doc).toContain("'+hack");
  });

  it("builds a non-empty official PDF buffer with disclaimer", async () => {
    const buffer = await buildOfficialRecordPdf({
      brandProduct: "Nelna FG Digital Recording System",
      documentTitle: "Daily Cleaning",
      documentCode: DOCUMENT_CODES.DAILY_CLEANING,
      revisionNumber: 1,
      recordNumber: "NMS/PPU/CL/24/20260714/ABC123",
      recordDate: "2026-07-14",
      submittedAt: "2026-07-14T10:00:00.000Z",
      sectionName: "Finished Goods",
      shiftName: "Morning",
      status: "VERIFIED",
      recordedBy: "Op (EMP-1)",
      checkedBy: "Sup (EMP-2) at 2026-07-14T11:00:00.000Z",
      verifiedBy: "QA (EMP-3) at 2026-07-14T12:00:00.000Z",
      truck: null,
      results: [
        {
          label: "Floor",
          status: "UNACCEPTABLE",
          issueReason: "Debris",
          correction: "Swept",
          correctiveAction: "Retrain",
          evidenceCount: 1,
          caCount: 1,
        },
      ],
      approvals: [
        {
          type: "VERIFY",
          decision: "APPROVED",
          by: "QA",
          at: "2026-07-14T12:00:00.000Z",
          comments: null,
        },
      ],
      disclaimer: OFFICIAL_RECORD_APPROVAL_DISCLAIMER,
      generatedAt: "2026-07-14T13:00:00.000Z",
      auditReference: "cuid-example",
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(OFFICIAL_RECORD_APPROVAL_DISCLAIMER.toLowerCase()).toContain(
      "not a cryptographic",
    );
  });
});

describe("ReportsService permission gate", () => {
  it("forbids report kinds without reports access", () => {
    const service = new ReportsService({} as never);
    expect(() =>
      service.listKinds({
        id: "u1",
        employeeCode: "E1",
        fullName: "Op",
        roles: ["FG_OPERATOR"],
        permissions: ["records:create", "records:read"],
      }),
    ).toThrow(ForbiddenException);
  });

  it("allows QA with reports:read", () => {
    const service = new ReportsService({} as never);
    const kinds = service.listKinds({
      id: "u2",
      employeeCode: "E2",
      fullName: "QA",
      roles: ["QA_EXECUTIVE"],
      permissions: ["reports:read", "records:read"],
    });
    expect(kinds.length).toBe(15);
    expect(kinds.map((k) => k.kind)).not.toContain("audit_activity_summary");
  });

  it("includes audit summary only with audit:read", () => {
    const service = new ReportsService({} as never);
    const kinds = service.listKinds({
      id: "u3",
      employeeCode: "E3",
      fullName: "Auditor",
      roles: ["AUDITOR"],
      permissions: ["reports:read", "audit:read", "records:read"],
    });
    expect(kinds.map((k) => k.kind)).toContain("audit_activity_summary");
    expect(kinds.length).toBe(16);
  });

  it("limits supervisors to operational kinds", () => {
    const service = new ReportsService({} as never);
    const kinds = service.listKinds({
      id: "u4",
      employeeCode: "E4",
      fullName: "Sup",
      roles: ["FG_SUPERVISOR"],
      permissions: ["reports:read", "records:check", "records:read"],
    });
    expect(kinds.map((k) => k.kind)).toContain("pending_checks");
    expect(kinds.map((k) => k.kind)).not.toContain("overdue_corrective_actions");
  });

  it("rejects unknown report kind", async () => {
    const service = new ReportsService({} as never);
    await expect(
      service.runReport(
        {
          id: "u2",
          employeeCode: "E2",
          fullName: "QA",
          roles: ["QA_EXECUTIVE"],
          permissions: ["reports:read"],
        },
        "not_a_real_report",
        { fromDate: "2026-07-01", toDate: "2026-07-02" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
