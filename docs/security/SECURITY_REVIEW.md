# Independent Security and Data-Protection Review

**System:** Nelna FG Digital Recording System  
**Review date:** 2026-07-14  
**Scope:** Source and configuration review of the `develop` branch at `ac87130`, plus the changes made during this review. This is not a formal certification, penetration test, or guarantee that vulnerabilities are absent.

## Method

The review inspected authentication, authorization, API and browser controls, data-URL evidence handling, local draft storage, environment handling, and dependency metadata. Static checks and the project test/build commands are recorded in `SECURITY_TEST_EVIDENCE.md`.

## Findings resolved

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| SEC-01 | High | Evidence data URLs had a count limit but no MIME or decoded-size limit before persistence. | The shared request schema now accepts only base64 JPEG, PNG, or WebP data URLs, limits each evidence image to 5 MiB, limits filenames/IDs, and has regression tests. The API's normal body-parser limit remains an additional request-size boundary. |
| SEC-02 | High | A production deployment could configure `COOKIE_SECURE=false`, allowing session cookies over HTTP. | Startup now rejects production configuration unless `COOKIE_SECURE=true`; cookie-option unit coverage verifies `HttpOnly`, `Secure`, `SameSite=Lax`, path, and token lifetimes. |
| SEC-03 | Medium | API and web responses lacked baseline browser security headers. | Added API `nosniff`, anti-framing, referrer, permissions, and cross-origin-opener headers. Added corresponding Next.js headers and a CSP that permits the configured API, data/blob evidence images, and required Next inline scripts/styles. |

## Confirmed controls

- Password verification uses bcrypt; the unknown-user path performs a fixed bcrypt comparison to reduce login enumeration timing differences.
- Invalid email and invalid password share a generic response. Account locked/inactive responses are only reached after a matching password.
- Failed logins are tracked and lock the account after configured attempts. Active status is checked on login, refresh, and current-user lookup.
- Refresh tokens are server-stored as hashes, rotated, and revoked on refresh/logout. Access tokens are short-lived and cryptographically verified.
- Authentication is global by default. Role and permission guards are registered application-wide; controllers declare permission requirements and record services perform owner/role checks.
- Pure FG operators can only view their own records and only record owners can edit an editable draft. Auditors have read visibility through the role/permission model; tests should be added if the role policy changes.
- Nest's global `ValidationPipe` whitelists fields, rejects unknown fields, and transforms DTOs. Dynamic response payloads also pass through shared Zod schemas.
- React's normal JSX escaping is used; no `dangerouslySetInnerHTML` use was found.
- `.gitignore` excludes local environment files and Prisma generated output. The tracked-file secret scan found only variable-handling code, not embedded credentials.

## Deferred risks and required actions

1. **Dependency audit: high/moderate findings remain.** `pnpm audit --prod` reported six high and two moderate findings: `tar@6.2.1` under bcrypt's `@mapbox/node-pre-gyp`, and `postcss@8.4.31` under Next. A forced tar major-version override was not applied because it may break bcrypt native installation; upgrade the parent packages in a compatibility-tested maintenance change.
2. **Evidence is database data, not managed file storage.** Data URLs can increase database size, lack malware scanning, and do not provide object-store lifecycle controls. Before production scale, move uploads to object storage using authenticated, size- and MIME-validated uploads and an asynchronous malware-scanning/quarantine integration. No scanner is claimed or configured here.
3. **No global exception filter is present.** Nest's default HTTP exception responses do not expose a JavaScript stack by default, but operational error behavior has not been integration-tested in production mode. Add an explicit production exception filter with correlation IDs before public deployment.
4. **No endpoint rate limiter is implemented.** Account lockout limits per-account guessing, but login/refresh endpoints remain susceptible to distributed attempts or availability abuse. Add infrastructure or application rate limiting with proxy-aware client IP handling.
5. **No server-side access-token revocation or token-version check is implemented.** Logout invalidates the refresh token and clears cookies; a previously issued access token remains usable until its 15-minute expiry.
6. **CSP uses `unsafe-inline` for Next.js compatibility.** This materially reduces script/style CSP strength. Consider nonce-based CSP once the rendering and deployment model supports it.
7. **Formal data retention, subject/access handling, backups, and disposal processes are outside this repository.** Assign an operational data owner and document them before go-live.

See `THREAT_MODEL.md`, `DATA_PROTECTION.md`, and `INCIDENT_RESPONSE.md` for ownership and operational detail.

## Prompt 33 follow-up (verified web route auth)

| Control | Status |
| --- | --- |
| Cookie HttpOnly / SameSite=Lax / Secure-in-prod | Confirmed in API cookie helpers + config validators |
| Middleware verifies session via API | Implemented (`verifySessionFromCookieHeader`) |
| Open-redirect safe return URLs | `resolvePostLoginPath` hardened |
| CSRF | SameSite=Lax + cookie session; no bearer-in-JS; keep API CORS allowlist tight in deploy |
| Access token after logout | Still valid until TTL (deferred risk #5) |
| Rate limits | Still deferred (#4) |

No plant penetration-test evidence is claimed here.
