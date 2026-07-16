# Business decision gates — P0

Status for every unsigned rule: **HUMAN_DECISION_REQUIRED**

Do not invent production policy. Technical defaults used in code are called out explicitly.

| Topic | Technical implementation | Policy status |
| --- | --- | --- |
| Cleaning record uniqueness scope | `deduplicationKey` = DOC\|DATE\|SHIFT\|AREA | HUMAN_DECISION_REQUIRED |
| Truck inspection uniqueness scope | Key includes vehicle number | HUMAN_DECISION_REQUIRED |
| REJECTED/ARCHIVED draft key reuse | Key cleared when leaving active draft set | HUMAN_DECISION_REQUIRED |
| Segregation of duties | Existing DEFAULT_WORKFLOW_POLICY in shared | HUMAN_DECISION_REQUIRED for changes |
| Approval authority | Role/permission guards unchanged | HUMAN_DECISION_REQUIRED |
| Critical truck failure override | Still blocked in code | HUMAN_DECISION_REQUIRED for exceptions |
| Reinspection rules | Optional `reinspectionOfId` retained | HUMAN_DECISION_REQUIRED |
| Amendment/void rules | VOID via workflow claim | HUMAN_DECISION_REQUIRED |
| Offline timestamp ownership | Unchanged | HUMAN_DECISION_REQUIRED |
| Record retention | Unchanged | HUMAN_DECISION_REQUIRED |
| Evidence retention | GridFS + attachment rows; orphan cleanup tooling pending ops run | HUMAN_DECISION_REQUIRED |
| Workflow cycle meaning | `workflowCycle` = post-claim `workflowVersion` for approval uniqueness | HUMAN_DECISION_REQUIRED |

Sign-off table: leave blank until business/QA/IT approve.
