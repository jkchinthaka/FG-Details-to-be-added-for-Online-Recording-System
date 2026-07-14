# Master Defect Register (enterprise pass)

See also `docs/uat/DEFECT_REGISTER.md` for historical IDs.

| Bug ID | Title | Module | Severity | Status | Fix evidence |
|--------|-------|--------|----------|--------|--------------|
| DEF-002 | Re-inspection picker missing | CL/30 | HIGH | READY_FOR_QA | `GET /inspection-records/reinspection-candidates` + FreezerTruckForm picker |
| DEF-006 | CA lifecycle missing | Corrective Actions | HIGH | READY_FOR_QA | `CorrectiveActionsModule` + `/corrective-actions` UI |
| DEF-005 | Amendment thin | Records | MEDIUM | OPEN | Void only |
| DEF-011 | Restore unproven | Ops | HIGH | OPEN | — |
| DEF-012 | Plant UAT unsigned | Process | HIGH | OPEN | — |
| DEF-SAMPLE-ADMIN | Sample admin retained | Security | MEDIUM | OPEN | Needs BOOTSTRAP_ADMIN_* |

Retest required before CLOSED. Do not close on code-only change.
