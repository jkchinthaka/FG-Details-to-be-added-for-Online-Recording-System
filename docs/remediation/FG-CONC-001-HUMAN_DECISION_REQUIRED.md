# FG-CONC-001 — HUMAN_DECISION_REQUIRED

Items intentionally left for business/policy owners (technical defaults applied):

1. **`records:complete` permission** — COMPLETE transition is wired under interim
   `records:verify`. Confirm whether a dedicated permission/role is required.
2. **`workflowCycle` business meaning** — technical uniqueness uses
   `recordId + approvalType + workflowCycle` where cycle is derived from
   post-claim `workflowVersion`. Confirm whether cycle should reset on return/
   resubmit independently of version.
3. **Draft deduplication after REJECTED/ARCHIVED** — whether a new draft may
   reuse the same operational scope key is unsettled; keys are cleared when
   leaving DRAFT / RETURNED_FOR_CORRECTION.
