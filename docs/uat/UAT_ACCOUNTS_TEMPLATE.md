# UAT accounts template

**Do not store real passwords in this repository.**

Distribute the filled table via company-approved secret store. Passwords must be unique, ≥12 characters, rotated after UAT.

| Role | Employee code (example) | Email (example) | Password location |
| --- | --- | --- | --- |
| FG Operator | UAT-OP-01 | operator.uat@example.invalid | Secret store |
| FG Supervisor | UAT-SUP-01 | supervisor.uat@example.invalid | Secret store |
| QA Executive | UAT-QA-01 | qa.uat@example.invalid | Secret store |
| Food Safety Team Leader | UAT-FS-01 | foodsafety.uat@example.invalid | Secret store |
| System Administrator | UAT-ADM-01 | admin.uat@example.invalid | Secret store |
| Auditor | UAT-AUD-01 | auditor.uat@example.invalid | Secret store |

## Seed env mapping

Use the `SEED_*` variables documented in `apps/api/.env.test.example` / seed-data (same names, UAT values only).

Also prepare:

- Test sections (FG Store, Changing Room, Dispatch)
- Test shifts (Morning / Afternoon / Night)
- Test vehicles / drivers / transporters
- Published checklist templates CL/24 and CL/30
- Today's task assignments for the pilot window
