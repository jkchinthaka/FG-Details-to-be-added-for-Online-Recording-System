# P0 Integrity Hardening — Remediation Report

| Field | Value |
| --- | --- |
| Starting SHA | `49fc5f4d682681a8f29727d4912ccf26f2d55f18` |
| Ending SHA | *(set after commits)* |
| Branch | `cursor/p0-integrity-hardening-20260716-2229` |
| Backup | `backup/p0-integrity-hardening-20260716-2229` |
| Technical decision | `P0_TECHNICAL_CONDITIONAL_PASS` |

## Implemented

1. **Atomic workflow transitions** — `workflowVersion` + `updateMany` claims for inspection check/verify/return/reject/void/submit, loading decision, CA transitions, template publish/archive. Competing claims → HTTP 409 `STALE_STATE`.
2. **Draft deduplication** — `deduplicationKey` + sparse unique index script; race-safe create with conflict resume/409 `DUPLICATE_RECORD`.
3. **Approval uniqueness** — `ApprovalRecord.workflowCycle` + `@@unique([recordId, approvalType, workflowCycle])`.
4. **Streaming evidence upload** — `POST /evidence/upload` multipart → GridFS; magic MIME + extension checks; orphan compensation on metadata failure.
5. **Refresh token families** — `familyId`/`sessionId`, atomic consume, reuse → family revoke + `authVersion` bump + audit (no raw tokens logged).
6. **Release alignment** — manifest writer + SHA verifier scripts; health exposes `commitSha`/`buildId`.
7. **CI** — Node `22.16.0`; E2E `continue-on-error` removed; OpenNext build + release manifest in quality job.
8. **Docs** — Mongo backup/restore; business decision gates marked `HUMAN_DECISION_REQUIRED`.

## Test results (this window)

| Suite | Result |
| --- | --- |
| `@nelna/shared` unit | 124 passed |
| `@nelna/api` typecheck | passed |
| `@nelna/api` unit | 283 passed (12 skipped = integration without `RUN_DB_INTEGRATION`) |
| Mongo concurrency integration | Requires `RUN_DB_INTEGRATION=1` + `fg_online_test` (CI job) |
| Live release SHA compare | Not run against production pair |
| Restore drill | `BLOCKED_EXTERNAL_RESTORE_TARGET` |
| Deploy | Not performed (P0 gates incomplete until CI green) |

## Human decisions required

See `docs/hci/BUSINESS_DECISION_GATES.md` — all uniqueness/retention/SOD policy rows remain **HUMAN_DECISION_REQUIRED**.

## Residual risks

- Existing refresh tokens without `familyId` need rotation/login after schema deploy.
- Sparse dedup index must be applied via `db:indexes:sync` (never production `prisma db push` as sole cutover).
- Full 20-way concurrency proof depends on CI Mongo job evidence.
- E2E canary on GitHub Actions not executed in this session.

Never claim production GO from local unit tests alone.
