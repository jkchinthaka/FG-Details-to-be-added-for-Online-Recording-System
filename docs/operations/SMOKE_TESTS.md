# Smoke Tests — Nelna FG Digital Recording System

Run after every Test/UAT or production deploy. Record pass/fail with timestamp and `buildId` from `/health`.

## Technical smoke

| # | Step | Pass criteria |
|---|------|---------------|
| T1 | `GET /health/live` | `status: ok` |
| T2 | `GET /health/ready` | `status: ready` (HTTP 200) |
| T3 | `GET /health` | `version` / `buildId` match release notes |
| T4 | API docs (non-prod) or OpenAPI optional | Reachable if enabled |
| T5 | Web root loads over HTTPS | 200, brand shell visible |

## Auth smoke

| # | Step | Pass criteria |
|---|------|---------------|
| A1 | Valid login | Lands on app; session cookies present |
| A2 | `/auth/me` | Returns ACTIVE user |
| A3 | Logout | Cookies cleared; protected API 401 |

## Business smoke

| # | Step | Pass criteria |
|---|------|---------------|
| B1 | Today’s Tasks | List loads or empty state (no 5xx) |
| B2 | Open daily cleaning | Draft workspace loads |
| B3 | Open freezer truck | Form loads; vehicle search responds |
| B4 | Unauthorized API | Operator denied admin-only action (403) |

## Negative / resilience (optional per release)

| # | Step | Pass criteria |
|---|------|---------------|
| N1 | Stop DB briefly in **non-prod** | Readiness 503; liveness still ok |
| N2 | Invalid login | Error; lockout eventually |

## Evidence log template

```
Date:
Environment:
APP_VERSION:
APP_BUILD_ID:
Executor:
T1-T5:
A1-A3:
B1-B4:
Notes:
```

Plant full UAT remains separate (`docs/uat/`).
