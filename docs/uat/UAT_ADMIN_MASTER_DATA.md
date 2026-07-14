# UAT cases — Admin & master-data management

**Phase:** Prompt 32  
**Plant execution:** Prepared templates only until multi-role plant UAT is scheduled (DEF-012).  
**Covers:** `/admin/users`, `/admin/master-data/*`, `/admin/vehicles`, `/admin/drivers`, `/admin/transporters`, checklist template draft cloning.

| ID | Scenario | Expected | Severity |
| --- | --- | --- | --- |
| ADM-01 | System Administrator creates a user with employee code, name, temporary password and roles | User created with `PENDING_ACTIVATION`/`ACTIVE` status; response never includes `passwordHash` | High |
| ADM-02 | Admin creates a user with an employee code or email that already exists | 409 conflict, no partial row created | High |
| ADM-03 | Admin deactivates a user | User `status` becomes `INACTIVE`; audit log entry recorded | High |
| ADM-04 | Admin attempts to deactivate the **last active** `SYSTEM_ADMINISTRATOR` | Request rejected (409/400); at least one active admin always remains | Critical |
| ADM-05 | Admin replaces a user's role set, removing `SYSTEM_ADMINISTRATOR` from the last active admin | Request rejected; roles unchanged | Critical |
| ADM-06 | Admin replaces a user's role set with a valid, non-protected change | Roles updated; `AuditLog` entry with actor, before/after role names | High |
| ADM-07 | Admin resets a user's password | New temporary bcrypt hash stored; lockout counters cleared; response returns the plaintext temporary password **once**, never the hash | High |
| ADM-08 | Admin views a user's access history | Returns `lastLoginAt` + refresh-token session metadata (issued/expires/revoked, user agent, IP) — never token hashes | Medium |
| ADM-09 | Admin assigns a department/section to a user | `departmentId`/`sectionId` updated; clearing sets both to `null` | Medium |
| ADM-10 | Admin creates/deactivates departments, sections, shifts, failure reasons, corrective-action categories, temperature profiles | Row created or `isActive` toggled; duplicate `code` returns 409; no hard delete endpoint exists | High |
| ADM-11 | Admin reads the static `priorities` list | Returns the fixed `Priority` enum values; no create/update/delete available | Low |
| ADM-12 | Admin creates or replaces a loading-decision-policy by key | Stores exactly the `config` JSON the admin posted; system never substitutes or invents Nelna policy content | High |
| ADM-13 | Admin registers a vehicle with a `vehicleNumber` that already exists | 409 conflict identifying the conflicting field (`vehicleNumber` / `freezerTruckNumber` / `qrIdentifier`) | High |
| ADM-14 | Admin sets/changes a vehicle's `qrIdentifier` | Vehicle updated; duplicate identifier across vehicles rejected with 409 | Medium |
| ADM-15 | Admin views a vehicle's inspection history | Returns recent `TruckInspectionDetail` rows (decision, recommended decision, timestamps) for that vehicle | Medium |
| ADM-16 | Admin registers a driver with a `licenseNumber` that already exists | 409 conflict; existing driver untouched | High |
| ADM-17 | Admin activates/deactivates a vehicle, driver or transporter | `status`/`isActive` toggled; existing historical references (inspections, past records) remain intact | Medium |
| ADM-18 | Operator opens `/vehicles` search (non-admin route) | Unaffected by admin changes — same public search contract as before Prompt 32 | High |
| ADM-19 | Template manager creates a new draft version for a template with an existing published version | New draft's sections/items/options are cloned from the highest published version | Medium |
| ADM-20 | Template manager creates a new draft version for a template with **no** published version yet | New draft is created empty (no clone source) | Low |
| ADM-21 | Template manager clones a draft from a specific historical version number | New draft mirrors the specified version's content; the specified version itself remains unmodified (published immutability preserved) | Medium |

## Known limits (honest, as of Prompt 32)

- The web admin **Users** list loads only the first page from the API; no paging/search controls in the UI yet.
- Master-data list tabs load the full active+inactive set; no server-side search/filter in the UI.
- `loading-decision-policies` store whatever JSON an admin posts — the system does not ship or infer Nelna's actual approved loading policy content (see `docs/requirements/OPEN_BUSINESS_DECISIONS.md`).
- All master-data models are soft-lifecycle only (`isActive` / vehicle `status`); there are no hard-delete endpoints by design.
- Web admin pages are functional, not polished — no bulk actions, CSV import, or optimistic UI.
