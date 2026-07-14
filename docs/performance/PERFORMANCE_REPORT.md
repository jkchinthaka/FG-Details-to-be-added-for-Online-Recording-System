# Performance and reliability audit

Audit scope: factory-mobile workflows for Daily Cleaning and Freezer Truck
Inspection. Source review and automated tests were completed on 2026-07-14.
Browser/device timings, production database query plans, and network bandwidth
were **not measured in CI/sandbox**. No unmeasured duration is presented as an
observed benchmark.

## Practical targets for field validation

- Initial mobile dashboard content: usable feedback within 2 seconds on the
  supported factory network; record actual p50/p95 separately by device class.
- Draft interaction: local backup write must be synchronous from the user's
  perspective; API autosave is debounced by 1.5 seconds.
- API requests: show a recoverable timeout message after 15 seconds rather
  than leaving a spinner indefinitely.
- Submit: one physical double-tap must produce at most one record transition,
  one corrective action per failing result, and one task status transition.
- Recovery: after an autosave failure or refresh, restore a local snapshot only
  when it is newer than the server record.

## Implemented controls

- `apiFetch` aborts requests after 15 seconds and returns a clear
  connection-recovery message.
- The web forms retain a local draft backup on each response change, warn before
  unload while dirty, restore only a newer backup, and display a restoration
  warning.
- Submit buttons have an in-flight ref guard. The API also conditionally claims
  a `DRAFT`/`REJECTED` record inside a Prisma transaction before downstream
  changes occur.
- The database requires at most one `CorrectiveAction` per
  `InspectionResult`, protecting the invariant beyond application retries.
- Dashboard widgets use isolated loading/error/retry state through
  `useAsyncResource`; one failed endpoint does not block other widgets.

## Query and payload observations

- Record detail fetches include a template version and results in bounded,
  explicit queries. The submit path loads results once before validation.
- Corrective-action creation currently performs one existence check per failed
  checklist item. This is acceptable for the small seeded checklists but should
  be profiled before template sizes or failure volumes increase.
- The schema indexes record document/date, result record/item, task assignee/date,
  and common workflow fields. Actual index usage and N+1 behaviour are **not
  measured in CI/sandbox**; validate with production-like PostgreSQL `EXPLAIN
  (ANALYZE, BUFFERS)` before setting capacity claims.

## Required field measurements before rollout

Capture device model, browser, network type/signal, sample size, p50/p95/p99,
failure rate, and payload size for dashboard load, record open, autosave, submit,
and image upload. Repeat under throttled/airplane-mode recovery conditions.
