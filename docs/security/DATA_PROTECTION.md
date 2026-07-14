# Data Protection Notes

## Data handled

The system processes employee account identifiers, names, email addresses, roles/permissions, login metadata (IP address and user agent), inspection records, corrective actions, approval/audit events, truck/driver/transporter details, and user-provided evidence images. These data categories should be confirmed by the operational data owner before production use.

## Protection implemented in code

- Credentials are stored as bcrypt password hashes; refresh tokens are stored as hashes.
- Access and refresh tokens are sent in HttpOnly cookies with `SameSite=Lax`; production startup requires `Secure`.
- JWT signing secrets are required in production and local `.env` files are ignored.
- Authenticated API access is guarded globally, with role, permission, record-owner, and workflow-state checks in relevant paths.
- Evidence is constrained to base64 JPEG, PNG, and WebP data URLs, up to 5 MiB decoded per attachment and four attachments per response.
- Validation strips/rejects unexpected DTO fields and shared schemas constrain dynamic checklist payloads.
- Browser and API security headers are configured, including CSP and anti-framing controls.

## Local/offline drafts

The web app stores best-effort draft backups in browser `localStorage` under the `nelna-fg-draft:` prefix. These data are not encrypted by the application, may remain after logout or browser restart, and can be read by a person or malware with access to the unlocked browser profile. Successful record submission clears the relevant draft.

Operational guidance:

1. Use managed, individually assigned devices with automatic screen lock and device encryption.
2. Do not use shared/public browser profiles for record entry.
3. Clear browser site data before reassigning or servicing a device.
4. Treat a lost device containing drafts as a potential data incident and follow `INCIDENT_RESPONSE.md`.
5. Do not rely on localStorage as the authoritative record; server autosave/submission is the authoritative path.

## Evidence and uploads

Evidence currently resides in database-backed data URLs rather than object storage. This is appropriate only for constrained early use and has important limitations: database growth, no independent malware scan, no content-disposition download control, and no storage lifecycle or legal-hold implementation. The application does not claim to scan files.

Before large-scale or regulated production use, integrate authenticated object storage with:

- server-enforced size and MIME checks,
- content inspection and malware quarantine before reviewers can access files,
- encryption at rest and in transit,
- least-privilege service credentials,
- retention/deletion lifecycle rules, backups, and restoration tests,
- audit logging for upload, access, download, deletion, and scanner decisions.

## Retention and data subject operations

No retention schedule, export process, deletion workflow, data classification, or jurisdiction-specific legal basis is implemented in this repository. The business must define these policies and assign a data owner. Database backups, logs, analytics, and exported reports must be included in the retention/deletion design.

## Deployment requirements

- Serve web and API traffic only over HTTPS; set `COOKIE_SECURE=true` in production.
- Set distinct, strong JWT secrets through the deployment secret manager; never reuse `.env.example` values.
- Set `API_CORS_ORIGIN` and `NEXT_PUBLIC_API_URL` to the approved web/API origins.
- Restrict database access to the API service and protect backups with equivalent controls.
- Ensure edge/server logs do not record passwords, cookie values, authorization headers, or evidence data URLs.
