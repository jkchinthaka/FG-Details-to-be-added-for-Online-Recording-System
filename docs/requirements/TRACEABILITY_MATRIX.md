# Traceability matrix — audit verification checklist

Evidence-based answers to the Prompt 17 verification questions.

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every source field implemented, deferred or N/A | **Pass (documented)** | `requirement-coverage.ts` + tests; no silent omissions |
| 2 | Correction ≠ Corrective Action | **Pass** | Separate DB columns, API fields, UI labels (`Correction (immediate)` vs `Corrective action`); `correctionConceptsAreDistinct()` test |
| 3 | Recorded / Checked / Verified By are users | **Partial** | Recorded By = `createdBy` relation. Checked/Verified = relations + header display; transition APIs deferred (OPEN_BUSINESS_DECISIONS) |
| 4 | Document code + revision stored | **Pass** | `InspectionRecord.documentCode` + `templateVersionId` → `ChecklistTemplateVersion.versionNumber`; UI shows `code · v#` |
| 5 | Historical checklist versions immutable | **Pass (API)** | Publish locks draft-only mutations; records keep version FK with `onDelete: Restrict` |
| 6 | Verified records not physically deleted | **Pass (application)** | No delete endpoint; `ARCHIVED` lifecycle. No DB trigger — remaining risk noted |
| 7 | Failed conditions leave exception evidence | **Pass** | `issueReason`, `correction`, `correctiveAction`, `notes`, attachments; CA entities when configured |
| 8 | Critical truck failures block loading | **Pass** | `computeRecommendedLoadingDecision` + `isOverrideToApprovedAllowed` + API/UI enforcement + tests |
| 9 | Re-inspections preserve previous inspection | **Partial** | `reinspectionOfId` on create; UI picker for linking still limited (known follow-up) |
| 10 | Workflow status has owner + next action | **Partial** | Dashboard + `nextResponsibleRoleForStatus`; Check/Verify transitions deferred |
| 11 | Reports/PDFs use same record data | **Pass (Prompt 31)** | `GET /reports/record-pdf/:id` builds from InspectionRecord + template version; CSV from same aggregates |
| 12 | Sri Lankan date/time consistency | **Pass (implemented this phase)** | `Asia/Colombo` helpers; record date + truck Time; shift hour via Colombo |
| 13 | Unconfirmed Nelna decisions listed honestly | **Pass** | `OPEN_BUSINESS_DECISIONS.md` |

## Architecture confirmations

| Topic | Result |
| --- | --- |
| Future third document via checklist engine | Yes for template authoring/preview/render/validate of status-type items |
| Persistence of future non-status item answers | Needs InspectionResult generalisation before full E2E |
| No invented third-document content | Confirmed |
