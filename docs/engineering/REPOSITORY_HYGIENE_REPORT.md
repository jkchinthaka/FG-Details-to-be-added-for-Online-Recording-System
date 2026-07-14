# Repository hygiene report — Prompt 35

**Date:** 2026-07-14  
**Branch:** `develop`

## Checks performed

| Area | Result |
| --- | --- |
| Formatting (`pnpm format` + `format:check`) | Pass after full Prettier write |
| Lint | Pass (`pnpm lint`) |
| Secrets in tracked files | No credential files staged; `.env` remains gitignored |
| Generated Prisma client | Remains gitignored under `apps/api/generated/` |
| Service worker | `apps/web/public/sw.js` now **tracked** (was incorrectly gitignored) |
| Debug / temp files | None added |
| Dead scripts | Root scripts still active (`dev`, `build`, `lint`, `test`, `format`) |
| Large binary assets | Only PWA icons under `public/icons` |

## Cleanup applied

- Removed ignore of intentional `public/sw.js`
- Removed unused `_statuses` parameter in reports service (lint)
- Documented dependency advisories without audit-force

## Known remaining hygiene debt

- Transitive audit findings (see `DEPENDENCY_REVIEW.md`)
- Some placeholder CA UI still thinner than admin (product debt, not formatting)
- Plant UAT / restore / pilot evidence still outside this hygiene pass

## Technical debt register

See `TECHNICAL_DEBT_REGISTER.md` — TD-11/TD-12 updated in prior phases; dependency items tracked in `DEPENDENCY_REVIEW.md`.

## Security summary

Formatting and hygiene did not weaken HttpOnly cookie auth, CSRF posture (SameSite=Lax), or CSRF-related CORS assumptions. Dependency risk remains accepted/deferred as above — not claimed cleared.

## Known limitations

Audit findings remain until parent packages upgrade safely. No production secret rotation performed in this phase.
