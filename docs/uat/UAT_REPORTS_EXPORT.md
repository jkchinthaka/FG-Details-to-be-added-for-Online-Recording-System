# UAT cases — Reports, official PDF, CSV export

**Phase:** Prompt 31  
**Plant execution:** Prepared templates only until multi-role plant UAT is scheduled (DEF-012).

| ID | Scenario | Expected | Severity |
| --- | --- | --- | --- |
| RPT-01 | QA runs Daily record completion with date range | Paginated rows; empty range returns zero rows | High |
| RPT-02 | Inclusive date boundary (from=to) | Single-day window accepted | Medium |
| RPT-03 | Date range > 93 days | Validation error | High |
| RPT-04 | Shift / section / status filters | Results respect filters | Medium |
| RPT-05 | Operator opens `/reports` | Forbidden / no kinds (PDF only on own record) | High |
| RPT-06 | Supervisor runs pending checks; cannot run overdue CA if role-limited | Kind list filtered | High |
| RPT-07 | Auditor runs audit activity summary | Rows from audit log aggregation | High |
| RPT-08 | Download official PDF for submitted record | Branding, revision, checklist, approvals, page numbers, disclaimer | High |
| RPT-09 | PDF does not claim cryptographic digital signature | Disclaimer wording present | High |
| RPT-10 | Historical template version on PDF | Revision matches record’s template version | High |
| RPT-11 | CSV cell `=1+1` | Escaped with leading apostrophe inside quotes | High |
| RPT-12 | Large window near row cap | Completes without client OOM; may truncate at export page cap | Medium |
| RPT-13 | Operator PDF for another user’s record | 403 | High |
| RPT-14 | Management aggregate reports | Section-wise / user-wise completion available | Medium |
