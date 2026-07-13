# Roles

| Role | Intended use |
| --- | --- |
| FG Operator | Complete assigned cleaning and freezer truck records |
| FG Supervisor | Assign work, check records, escalate issues |
| QA Executive | QA verification and quality oversight |
| Food Safety Team Leader | Food safety review and corrective action ownership |
| System Administrator | Users, roles, templates, master data |
| Auditor | Read-only history, reports and audit logs |

Role-based (and fine-grained permission-based) access control is enforced on
every API route via `RolesGuard`/`PermissionsGuard` — see
[`docs/AUTHENTICATION.md`](./AUTHENTICATION.md) for the full auth strategy,
endpoint list and the role → navigation mapping used by the web app.
