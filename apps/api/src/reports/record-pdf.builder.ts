import PDFDocument from "pdfkit";
import { OFFICIAL_RECORD_APPROVAL_DISCLAIMER } from "@nelna/shared";

export type OfficialRecordPdfInput = {
  brandProduct: string;
  documentTitle: string;
  documentCode: string;
  revisionNumber: number;
  recordNumber: string;
  recordDate: string;
  submittedAt: string | null;
  sectionName: string | null;
  shiftName: string | null;
  status: string;
  recordedBy: string;
  checkedBy: string | null;
  verifiedBy: string | null;
  truck: {
    freezerTruckNumber: string;
    vehicleNumber: string;
    loadingDecision: string;
    decidedBy: string | null;
  } | null;
  results: Array<{
    label: string;
    status: string;
    issueReason: string | null;
    correction: string | null;
    correctiveAction: string | null;
    evidenceCount: number;
    caCount: number;
  }>;
  approvals: Array<{
    type: string;
    decision: string;
    by: string | null;
    at: string | null;
    comments: string | null;
  }>;
  disclaimer: string;
  generatedAt: string;
  auditReference: string;
};

export function buildOfficialRecordPdf(input: OfficialRecordPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#27743A").fontSize(16).text(input.brandProduct, { align: "left" });
    doc.fillColor("#000000").fontSize(12).text(input.documentTitle);
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Document code: ${input.documentCode}`);
    doc.text(`Revision / template version: ${input.revisionNumber}`);
    doc.text(`Record number: ${input.recordNumber}`);
    doc.text(`Record date: ${input.recordDate}`);
    if (input.submittedAt) doc.text(`Submitted at: ${input.submittedAt}`);
    doc.text(`Status: ${input.status}`);
    if (input.sectionName) doc.text(`Section / area: ${input.sectionName}`);
    if (input.shiftName) doc.text(`Shift: ${input.shiftName}`);
    doc.moveDown(0.5);
    doc.text(`Recorded By: ${input.recordedBy}`);
    doc.text(`Checked By: ${input.checkedBy ?? "—"}`);
    doc.text(`Verified By: ${input.verifiedBy ?? "—"}`);

    if (input.truck) {
      doc.moveDown(0.5);
      doc.fontSize(11).text("Vehicle / loading");
      doc.fontSize(10);
      doc.text(`Freezer truck: ${input.truck.freezerTruckNumber}`);
      doc.text(`Vehicle: ${input.truck.vehicleNumber}`);
      doc.text(`Final loading decision: ${input.truck.loadingDecision}`);
      if (input.truck.decidedBy) doc.text(`Decided by: ${input.truck.decidedBy}`);
    }

    doc.moveDown(0.5);
    doc.fontSize(11).text("Checklist results");
    doc.fontSize(9);
    for (const result of input.results) {
      doc.text(`• ${result.label}: ${result.status}`);
      if (result.issueReason) doc.text(`   Issue: ${result.issueReason}`);
      if (result.correction) doc.text(`   Correction: ${result.correction}`);
      if (result.correctiveAction) doc.text(`   Corrective Action: ${result.correctiveAction}`);
      if (result.evidenceCount > 0) doc.text(`   Evidence attachments: ${result.evidenceCount}`);
      if (result.caCount > 0) doc.text(`   Linked CA count: ${result.caCount}`);
    }

    if (input.approvals.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(11).text("Approval history");
      doc.fontSize(9);
      for (const approval of input.approvals) {
        doc.text(
          `• ${approval.type} / ${approval.decision} — ${approval.by ?? "system"} @ ${approval.at ?? "—"}`,
        );
        if (approval.comments) doc.text(`   Comment: ${approval.comments}`);
      }
    }

    doc.moveDown(1);
    doc.fontSize(8).fillColor("#444444").text(input.disclaimer || OFFICIAL_RECORD_APPROVAL_DISCLAIMER);
    doc.text(`Audit-safe record reference: ${input.auditReference}`);
    doc.text(`Generated: ${input.generatedAt}`);

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor("#666666").text(`Page ${i - range.start + 1} of ${range.count}`, 48, doc.page.height - 36, {
        align: "center",
        width: doc.page.width - 96,
      });
    }

    doc.end();
  });
}
