# Test Summary — Nelna FG Digital Recording System v1.0.0

**Gate date:** 2026-07-14  
**Command:** `pnpm test` (+ package reaffirmation for shared/ui counts)

## Automated results

| Package | Framework | Passed | Failed | Notes |
|---------|-----------|-------:|-------:|-------|
| `@nelna/shared` | Vitest | 93 | 0 | Domain / checklist / coverage |
| `@nelna/ui` | Vitest | 31 | 0 | Design-system components |
| `@nelna/api` | Jest | 164 | 0 | Auth, records, templates, health, env validation |
| `@nelna/web` | Vitest | 95 | 0 | Dashboard, cleaning, truck forms |
| **Total** | | **383** | **0** | |

## Other verification

| Check | Result |
|-------|--------|
| Lint | Pass |
| Typecheck | Pass |
| Production build | Pass |
| Prisma validate | Pass |
| Playwright / Cypress e2e | Not in repo |
| Live DB constraint suite | Soft-skipped (Postgres unreachable) |
| Formal multi-role UAT | Not executed (see `docs/uat/`) |
| Format check (`prettier --check`) | Fail — 133-file drift (pre-existing) |

## Failed tests

None in automated suite.
