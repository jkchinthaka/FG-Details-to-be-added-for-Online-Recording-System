# Technical Debt Register

**Scope:** audit of `develop` at `49dd986f83472a8d121624786ffd0af4be7dbb06`.

| ID | Priority | Debt | Impact | Suggested next action | Exit evidence |
| --- | --- | --- | --- | --- | --- |
| TD-01 | High | `submit` performs status, corrective-action, task, and truck-decision writes independently. | Partial workflow state after database failure or concurrent submit. | Design a transaction and retry/idempotency policy. | Integration tests inject failures; all-or-nothing state verified. |
| TD-02 | High | Truck final-decision update, approval record, and audit log are independent writes. | Final decision may lack its compliance history. | Transactionalize after TD-01 pattern is established. | Failure test proves no partial decision history. |
| TD-03 | Medium | Dynamic response persistence is per-item and evidence deletion/recreation is not atomic. | Latency grows with template size; partial drafts are possible. | Measure real template sizes/query timings, then batch/transaction if warranted. | Benchmarks plus rollback and idempotency tests. |
| TD-04 | Medium | Web API modules duplicate transport mechanics with divergent errors/cache behaviour. | Fixes to auth/network handling may drift. | Define transport contract and migrate one module at a time with tests. | Module tests preserve errors, 204, credentials, and caching. |
| TD-05 | Medium | `InspectionRecordsService` has too many workflow responsibilities. | Higher regression risk when adding a record type or workflow stage. | Extract one cohesive collaborator only when a new use case needs it. | Existing service tests remain; collaborator has focused tests. |
| TD-06 | Medium | Dashboard/read services replace database failures with empty business data. | Operators can mistake an outage for no assigned work. | Return availability metadata and show a degraded state. | UI test distinguishes empty data from service failure. |
| TD-07 | Medium | Shared status unions and Prisma enums are separately declared. | Runtime/persistence/client drift during future enum changes. | Add parity test or a deliberate mapper near persistence boundaries. | Test fails if enum membership diverges. |
| TD-08 | Medium | Published-template immutability is principally enforced by service paths. | Direct DB access or future endpoints could alter historical definitions. | Restrict production DB writers; consider a database trigger only if operational controls are insufficient. | Access policy and immutability test documented. |
| TD-09 | Medium | Query indexes have not been justified with production plans. | Dashboard and records lists may degrade as data grows. | Capture `EXPLAIN ANALYZE` for status/date/order paths before adding indexes. | Query plan, cardinality, and safe migration reviewed. |
| TD-10 | Low | AppShell account menu needs explicit keyboard escape/focus management verification. | Possible keyboard navigation gap. | Add keyboard-focused interaction tests and manual assistive-technology check. | Test and accessibility review sign-off. |
| TD-11 | Low | PDF shipped as audit pack (ADR-009 Accepted). Paper facsimile still open under BD-25. | Auditors may expect exact paper layout. | Confirm BD-25; iterate template if APPROVED exact match. | BD-25 decision |
| TD-12 | Low | Offline queue shipped (ADR-006 Accepted). CA online submit and at-rest encryption still limited. | Shop-floor CA drafts may remain device-local. | Finish CA submit API; consider WebCrypto for sensitive fields if required. | CA + security follow-up |

## Not debt

- Seed-script `console.log` output is operational feedback, not production debug logging.
- UI date formatting and shared Colombo calendar helpers serve different purposes; combining them would blur the operational/calendar boundary.
- No index migration was added: the audit found bounded queries but no query-plan evidence for a safe hot-path index.
