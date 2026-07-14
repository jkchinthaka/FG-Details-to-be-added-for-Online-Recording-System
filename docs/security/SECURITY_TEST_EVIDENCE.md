# Security Test Evidence

**Review date:** 2026-07-14  
**Baseline:** `develop` at `ac87130` after `git fetch --all --prune`; no commit or push was performed.

## Static review evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Authentication | Pass by code review | `AuthService` uses bcrypt comparison, generic invalid credentials, lockout counters, active-user checks, hashed refresh-token persistence, rotation, and logout revocation. |
| Authorization | Pass by code review | `JwtAuthGuard`, `RolesGuard`, and `PermissionsGuard` are global guards. Inspection records additionally enforce owner and role visibility checks. |
| Cookie settings | Pass by unit test added | `cookies.spec.ts` asserts `HttpOnly`, `Secure`, `SameSite=Lax`, path, and access/refresh max ages. Production config now rejects missing/false `COOKIE_SECURE`. |
| Evidence validation | Pass by unit test added | Shared schema tests accept a small PNG data URL and reject non-image and oversized inputs. Schema limits attachment count, types, decoded size, IDs, filenames, and timestamps. |
| Browser/API headers | Pass by code inspection | Nest adds baseline API headers. Next config adds CSP, anti-framing, `nosniff`, referrer, and permissions policy headers. |
| Tracked-file secret scan | Pass with reviewed matches | `git grep -nI -E "password[[:space:]]*=|api[_-]?key|BEGIN (RSA |EC |OPENSSH )?PRIVATE|secret[[:space:]]*="` found only password variable handling in `apps/api/prisma/seed-data.ts`; no embedded credential/private-key match was found. |

## Dependency audit

Command: `pnpm audit --prod`

Result: failed with 8 findings: 6 high and 2 moderate.

- `tar@6.2.1`, via `bcrypt@5.1.1` → `@mapbox/node-pre-gyp`, has six high/moderate advisories. The reported patched tar versions require newer major releases in several cases.
- `postcss@8.4.31`, via Next, has one moderate XSS advisory with a patched version `>=8.5.10`.

No automated dependency change was made: a direct tar major-version override could break bcrypt's native dependency/install path. The appropriate remediation is a tested upgrade of bcrypt/node-pre-gyp and Next or their supported dependency chains.

## Verification run

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed. The web lint command emitted Next's deprecation notice for `next lint`; no lint warnings/errors were reported. |
| `pnpm typecheck` | Passed after correcting explicit middleware parameter types. |
| `pnpm test` | Passed: shared 93 tests, UI 31 tests, API 155 tests, web 91 tests. Database constraint tests emitted expected skip warnings because PostgreSQL was not reachable. |
| Package builds | Passed: `@nelna/shared`, `@nelna/ui`, `@nelna/api`, and `@nelna/web` built successfully. |

Prisma generation was intentionally skipped because this review did not change the schema; the package builds used the existing generated client.
