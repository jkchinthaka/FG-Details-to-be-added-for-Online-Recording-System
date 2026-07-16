# Security & audit coverage matrix (FG-SEC-001 / FG-AUD-001 / FG-ERR-001 / FG-SEC-002)

| Control | Status | Notes |
| --- | --- | --- |
| Request ID middleware | Implemented | Accept/generate `x-request-id`; Worker proxy forwards |
| Stable error envelope | Implemented | `statusCode`, `code`, `message`, `fieldErrors`, `requestId`, `retryable` |
| Global exception filter | Implemented | No stacks/DB internals in production responses |
| Structured JSON access logs | Implemented | Redacted; includes requestId, route, method, status, duration, userId, buildId |
| Log redaction | Implemented | passwords, tokens, cookies, DATABASE_URL |
| Rate limiting | Implemented | Global + stricter login/refresh/upload/export (in-memory; Redis when multi-instance) |
| Mutation / CSRF | Implemented | Origin + Sec-Fetch-Site; Worker forwards metadata |
| Helmet / HSTS / frame / nosniff / referrer | Implemented | CSP left to Next/Worker HTML surface |
| Swagger in production | Blocked | Mounted only when `NODE_ENV !== production` |
| `/health/database-config` | Restricted | Auth + admin/`audit:read` in production |
| Central audit service | Implemented | Append-only `AuditService.append` |

## Audit event coverage

| Event | Action constant | Writer |
| --- | --- | --- |
| Login success/failure | `AUTH_LOGIN_*` | `AuthService` via `AuditService` |
| Logout | `AUTH_LOGOUT` | `AuthService` |
| Password change | `AUTH_PASSWORD_CHANGE` | `AuthService` |
| Refresh reuse | `REFRESH_TOKEN_REUSE_DETECTED` | `refresh-token-family` (existing) |
| User/role changes | `USER_*` / `USER_ROLE_CHANGE` | Users service (existing + matrix) |
| Template publish/archive | `TEMPLATE_*` | Checklist templates (existing) |
| Record workflow | `RECORD_*` | Inspection records (existing) |
| Corrective actions | `CORRECTIVE_ACTION` | CA service (existing) |
| Evidence / reports | `EVIDENCE_*` / `REPORT_EXPORT` | Constants reserved; wire at call sites as features emit |

Never store secrets in `AuditLog.metadata`.
