# Authentication, authorization & session strategy

## Overview

Email + password sign-in, backed by a short-lived JWT access token and a
longer-lived, rotating JWT refresh token. Both tokens travel as **httpOnly**
cookies — the browser never exposes either token to JavaScript, which rules
out token theft via XSS reading `localStorage`/`sessionStorage`.

| Token         | Cookie                | Lifetime (default) | Storage                                            |
| ------------- | --------------------- | ------------------- | --------------------------------------------------- |
| Access token  | `nelna_access_token`  | 15 minutes (`ACCESS_TOKEN_TTL`)  | Stateless JWT only — never persisted server-side.    |
| Refresh token | `nelna_refresh_token` | 7 days (`REFRESH_TOKEN_TTL`)     | JWT, **hashed (SHA-256)** in the `RefreshToken` table so it can be looked up, revoked and rotated. |

Cookies are `httpOnly`, `SameSite=Lax`, `path=/`, and `Secure` once
`COOKIE_SECURE=true` (required in any real HTTPS deploy; must stay `false`
for local `http://localhost` dev). `COOKIE_DOMAIN` is only needed once the
web app and API are deployed on different subdomains of one parent domain.

## Endpoints (`apps/api/src/auth`)

| Method | Path            | Auth required | Purpose                                                            |
| ------ | --------------- | -------------- | ------------------------------------------------------------------- |
| POST   | `/auth/login`   | No             | Verify email + password, set both cookies, return the current user. |
| GET    | `/auth/me`      | Yes            | Return the authenticated user's profile, roles and permissions.     |
| POST   | `/auth/refresh` | No (needs refresh cookie) | Rotate the refresh token, issue a new access token.   |
| POST   | `/auth/logout`  | No             | Revoke the presented refresh token, clear both cookies.             |

All four are documented in Swagger at `/api/docs`. Every other route
requires a valid access token by default (see Guards below); `@Public()`
opts a route out (used by `/health` and the four auth endpoints above).

## Password hashing

`bcrypt`, 12 salt rounds (matches `prisma/seed.ts`). Passwords are never
returned in any API response, ever — `CurrentUser`/`CurrentUserDto` simply
have no field for it.

## Failed-login protection — chosen policy

**Attempt counter + timed lockout** (not progressive delay): after
`LOGIN_MAX_ATTEMPTS` (default **5**) consecutive wrong passwords, the
account is locked for `LOGIN_LOCKOUT_MINUTES` (default **15**). The counter
and `lockedUntil` timestamp live on `User` and reset to zero the moment a
correct password is supplied again (even on an inactive/locked account —
proving you hold the password shouldn't leave you artificially locked out
once the timer would otherwise allow it, and it prevents the counter from
creeping on repeated legitimate logins after a couple of fat-fingered
attempts).

This was chosen over progressive delay because it's simpler to reason about
and test, and a factory-floor shared-terminal environment benefits more from
a hard, visible "come back in N minutes" than from silently-lengthening
response times.

## Enumeration-safety policy (documented trade-off)

- **Unknown email** and **wrong password** return the *exact same*
  `INVALID_CREDENTIALS` error, with the same message — a caller cannot tell
  which occurred. The unknown-email path also runs a dummy `bcrypt.compare`
  against a fixed placeholder hash so both paths do roughly the same amount
  of work, narrowing (not eliminating) the timing side channel.
- **`ACCOUNT_INACTIVE`** and **`ACCOUNT_LOCKED`** are only ever returned
  *after* the supplied password has already matched the stored hash — never
  for a wrong password — so a failed guess can't be used to fish for account
  state.
- Accepted trade-off: once an attacker has the *correct* password for a
  locked/inactive account, `ACCOUNT_LOCKED`/`ACCOUNT_INACTIVE` does confirm
  the account exists and its state. This mirrors common industry practice
  (e.g. GitHub, Google) — the alternative (always saying "invalid
  credentials" even to someone who just proved they know the password) is
  measurably worse UX for a legitimate locked-out user with no real security
  benefit, since they've already demonstrated password knowledge.

Every error response is `{ code, message }`. The frontend must branch on
`code` (a stable enum — see `AUTH_ERROR_CODES` in `@nelna/shared`), never on
`message` text.

## Guards & authorization (`apps/api/src/auth/guards`)

Three global guards run, in this order, on every request (registered as
`APP_GUARD` in `AuthModule`):

1. **`JwtAuthGuard`** — reads the access token cookie, verifies it, and
   attaches `{ id, employeeCode, fullName, roles, permissions }` to
   `request.user`. Routes/controllers marked `@Public()` skip this
   entirely. An expired token throws `SESSION_EXPIRED`; anything else
   missing/invalid throws `NOT_AUTHENTICATED`.
2. **`RolesGuard`** — reads `@Roles(...)` metadata; passes through
   untouched when a route declares no roles.
3. **`PermissionsGuard`** — same idea for `@RequirePermissions(...)`,
   sourced from the canonical `PermissionKey` list in `@nelna/shared`.

**Trade-off, stated once:** roles/permissions are embedded in the access
token at login/refresh time — there is no per-request database lookup. An
admin changing someone's role takes effect the next time that user's access
token is refreshed (at most `ACCESS_TOKEN_TTL`, 15 minutes by default), not
instantly. This keeps authorization checks fast and stateless; `/auth/me`
always reflects the live database row (and rejects a since-deactivated
user), so the *profile* view is always current even when embedded
role/permission claims momentarily lag.

## Frontend (`apps/web`)

- **`middleware.ts`** — lightweight, defense-in-depth check: redirects to
  `/login?next=...` when *neither* auth cookie is present for a protected
  path. It only checks cookie *presence* (httpOnly cookies aren't readable
  from JS, and middleware intentionally avoids re-implementing JWT
  verification) — the API's `JwtAuthGuard` is what actually verifies the
  token on every request.
- **`AuthProvider`/`useAuth`** (`src/lib/auth/auth-context.tsx`) — client-side
  session state. On mount, calls `/auth/me`; on a `SESSION_EXPIRED` /
  `NOT_AUTHENTICATED` response it attempts one silent `/auth/refresh` before
  falling back to "unauthenticated". This is the second layer of defense:
  it catches an access token that expired *during* an active client session
  (middleware only runs on navigation).
- **`AppShell`** — role-aware navigation (`src/lib/auth/nav-config.ts` maps
  each nav destination to the roles allowed to see it), a working sign-out,
  and a loading/redirect gate while the session is being resolved.
- **`/login`** — Nelna-branded, mobile-first, minimal fields (email,
  password with a show/hide toggle), large primary-green submit button,
  distinct banners for invalid credentials / inactive account / locked
  account / expired session.

## Role → navigation mapping

| Role | Visible destinations |
| --- | --- |
| FG Operator | Home, My Tasks, New Record, Records, Profile |
| FG Supervisor | + Corrective Actions |
| QA Executive | Records, Corrective Actions, Reports, Profile (no task creation) |
| Food Safety Team Leader | Records, Corrective Actions, Reports, Profile |
| Auditor | Records, Corrective Actions, Reports — read-only scope, Profile |
| System Administrator | Home, Administration, Reports, Profile only |

## Known limitations / not in scope for this pass

- Users without an `email` (schema allows `email: String?`) cannot sign in —
  login is email + password only, matching the login page's minimal-fields
  requirement. Employee-code login is a reasonable future extension.
- No social login (explicitly out of scope).
- No live Postgres in this sandbox — auth logic is covered by unit/service
  tests against a mocked Prisma client (see `apps/api/src/auth/*.spec.ts`);
  run `docker compose up -d && pnpm --filter @nelna/api prisma:migrate` to
  exercise it against a real database.
