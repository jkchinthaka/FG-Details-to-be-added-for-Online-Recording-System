# Capacity assumptions and validation boundaries

## Explicit assumptions

- A factory shift has a bounded number of active operators and a small,
  human-completed checklist per record.
- Each inspection result is unique by `(recordId, itemId)`, and each result can
  have at most one corrective action.
- Record listings are intentionally short (`Recent records` defaults to 5 and
  caps at 20).
- File evidence is represented in the current record flow but upload transport,
  object-storage limits, and image size budgets must be validated separately.

## Schema support

The database has indexes for record document/date, record status, task
assignee/date, result item/status, attachment record/result, corrective-action
status/assignee, and audit entity/time. The submit workflow additionally uses a
unique `CorrectiveAction.resultId` constraint to preserve idempotency.

These indexes are design assumptions, not verified query-plan results. Index
selectivity, lock contention, connection-pool behaviour, and N+1 query counts
are **not measured in CI/sandbox**.

## Capacity limits that must be measured

Do not set operator, request-per-second, attachment-size, or storage-retention
limits from this audit. Establish them with a production-like PostgreSQL
environment and representative devices. At minimum, exercise:

- simultaneous start/save/submit activity at the expected peak shift handover;
- dashboard and recent-record reads while submissions are occurring;
- duplicate submit races;
- representative evidence image upload size and retry behaviour; and
- sustained audit-log and corrective-action growth.

Record database version, instance sizing, connection-pool settings, dataset
size, scenario, sample count, and p50/p95/p99 for every capacity decision.
