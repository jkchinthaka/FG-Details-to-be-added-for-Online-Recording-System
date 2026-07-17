# High-Risk Remediation Verification

**Decision:** `HIGH_RISK_REMEDIATION_CONDITIONAL_PASS`

## Baseline

| Field | Value |
| --- | --- |
| Working branch | `cursor/high-risk-remediation-verification-20260717-1313` |
| Starting SHA | `1e433245f9d3fddacaadc2d0a826b5f540c73425` |
| Source tip | `cursor/full-remediation-20260716-2241` |
| Uncommitted 34-file state at gate start | **Not present** (working tree clean; remediation already committed) |
| Emergency backups | `../fg-remediation-uncommitted-backup.patch` (empty), `../fg-remediation-staged-backup.patch` (empty), `../fg-remediation-HEAD-commit-backup.patch` |

## Safeguard note

The gate brief assumed ~34 uncommitted files. On this machine the completed remediation was already committed on `cursor/full-remediation-20260716-2241`. Verification proceeded from that tip on a dedicated verification branch without discarding work.

Local `apps/api/.env` targets Atlas host / database name `fg_online`. **All verification commands forced** `DATABASE_URL=mongodb://127.0.0.1:27027/fg_online_test?replicaSet=rs0&directConnection=true` and refused Atlas / production names. No production push, seed, repair, deploy, or merge was performed.

## Isolated MongoDB

| Check | Result |
| --- | --- |
| TEST_DATABASE_ENVIRONMENT | ISOLATED |
| TRANSACTIONS_SUPPORTED | YES |
| PRODUCTION_DATABASE_USED | NO |
| Tooling | Docker `mongo:7` `--replSet rs0` on host port **27027** (27017 occupied by non-RS local mongod) |
| Database name | `fg_online_test` only |

## Previously skipped DB suites (now executed)

| Suite | Previously skipped when | Result this gate |
| --- | --- | --- |
| `prisma/db-integration.spec.ts` | `RUN_DB_INTEGRATION≠1` or DB≠`fg_online_test` | PASS |
| `prisma/db-constraints.spec.ts` | `RUN_DB_CONSTRAINT_TESTS≠true` | PASS |
| `prisma/fg-conc-001-concurrency.spec.ts` | same as integration | PASS (19) |
| `prisma/fg-db-001-draft-dedup.spec.ts` | same | PASS (6) |
| `src/auth/fg-auth-001-refresh-rotation.spec.ts` | same | PASS (3) after fix |

**Critical DB tests skipped this gate:** 0 (when `RUN_DB_INTEGRATION=1` against isolated RS).

## Defect found and fixed during verification

**FG-006 refresh claim failure on MongoDB:** Prisma MongoDB does not match *unset* optional fields with `field: null`. `claimRefreshTokenForRotation` used `consumedAt: null` / `revokedAt: null`, so every refresh claim returned `count=0` and both concurrent refresh attempts failed with `SessionExpiredException`.

Fix: match `null` **or** `{ isSet: false }`, set explicit nulls on token create, and align revoke queries / tests.

## Gate results (sanitized)

| Gate | Result |
| --- | --- |
| DB integration + constraints + concurrency + draft dedup + refresh | **38 passed / 0 failed / 0 skipped** |
| API unit (excl. DB-gated suites) | **323 passed** |
| Evidence unit specs | **17 passed** |
| Shared unit | **175 passed** |
| UI unit | **33 passed** |
| Web unit (incl. AppShell nested regression) | **147 passed** |
| API typecheck / build | PASS |
| Shared / UI build | PASS |
| Web typecheck | PASS |
| `pnpm format:check` (repo-wide) | **FAIL** — 159 pre-existing Prettier warnings (not introduced by this verification fix) |
| OpenNext Cloudflare build | Not re-executed in this verification window (prior remediation branch claimed PASS; residual risk) |

Approximate unique unit/integration total counted in this window: **~733** (shared 175 + UI 33 + web 147 + API unit 323 + DB gate 38; evidence 17 already inside API unit).

## Finding → coverage matrix (summary)

| Finding | Intended behavior | Risk | Covered by | Required |
| --- | --- | --- | --- | --- |
| FG-001 / FG-005 / FG-013 evidence | Multipart + failure-safe replace + compensation | High | evidence.service.spec, gridfs-evidence.service.spec, shared evidence-upload | Yes |
| FG-002 concurrency | Exactly one claim wins; losers 409/STALE | High | fg-conc-001 | Yes |
| FG-003 arbitrary URLs | Reject non-managed evidence URLs | High | shared evidence-upload + inspection reconcile | Yes |
| FG-004 draft dedup | One canonical draft under concurrent create | High | fg-db-001 | Yes |
| FG-006 refresh reuse | Atomic claim; family revoke; authVersion bump | High | fg-auth-001 (+ Mongo null fix) | Yes |
| FG-007 admin SoD | Technical admin vs food-safety approval | Policy | seed still grants admin **all** permissions | **HUMAN_DECISION_REQUIRED** |
| FG-008 cache/logout | No protected auth cache leakage | Medium | sw.js still caches navigations | Residual |
| FG-009 nested AppShell | Single chrome in root layout | Medium | AppShell.nested.test | Yes |
| FG-010 blocking CI | No continue-on-error; Node 22.16; Playwright job | Medium | `.github/workflows/ci.yml` | Yes |
| FG-016 zoom | No maximumScale clamp | Low | layout viewport | Yes |
| FG-018 Swagger | Disabled in production surfaces | Medium | main.ts + production-surfaces | Yes |
| FG-019 Origin/Fetch-Metadata | Mutation protection | Medium | security-controls.spec | Yes |
| FG-021 GridFS readiness | Independent readiness | Medium | health / gridfs paths on remediation | Yes |

## HUMAN_DECISION_REQUIRED

1. **Administrator operational authority** — `SYSTEM_ADMINISTRATOR` seed still receives every permission including `records:check` / `records:verify` / void. Confirm whether food-safety approval must be removed from technical admin.
2. **Emergency override** — none invented; confirm whether a break-glass path is required.
3. **Duplicate draft business-key scope** — confirm date/shift/area/vehicle key dimensions.
4. **Repeated truck visit semantics** — confirm when a new draft is allowed vs resume.
5. **Evidence retention / obsolete GridFS cleanup** — repair requires explicit flags; production cleanup policy unresolved.
6. **Audit retention** — retention window unresolved.

## Residual risks

- Repo-wide Prettier debt (159 files) fails `format:check`.
- Service worker still writes navigation responses into Cache Storage (shared-device risk if authenticated HTML is cached).
- Local `.env` points at Atlas `fg_online` — operators must never run integration tests without overriding `DATABASE_URL`.
- OpenNext build not re-proven in this window.
- HEAD ancestor commit message `okk` is non-descriptive (pre-existing).

## Commits created on verification branch

See `git log` after push — includes Mongo refresh-claim fix and this report.

## Decision rationale

**CONDITIONAL_PASS** because critical isolated MongoDB suites executed and passed (including concurrency, draft dedup, refresh replay), and a real FG-006 production-impacting claim bug was fixed and verified — but repo-wide format gate remains red, SW cache residual remains, and administrator SoD remains a human policy decision.
