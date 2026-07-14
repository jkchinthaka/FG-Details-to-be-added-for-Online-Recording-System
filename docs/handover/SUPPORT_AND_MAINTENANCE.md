# Support and Maintenance — Nelna FG Digital Recording System

## Support tiers (recommended)

| Tier | Scope | Typical owner |
|------|-------|---------------|
| L1 | Password resets (via IT process), “can’t open page”, browser issues | Site IT helpdesk |
| L2 | Role assignment, vehicle master data (until admin UI), env config | Application admin / IT |
| L3 | Bugs, migrations, performance, security incidents | Developer / vendor (Chinthaka Jayaweera) + IT Manager |

## Routine maintenance

| Cadence | Activity |
|---------|----------|
| Daily | Backup job success; uptime checks |
| Weekly | Review error logs; disk/storage |
| Monthly | Dependency advisories (`pnpm audit`); user access review |
| Quarterly | Restore test + reconciliation; access recertification |

## Change control

All production changes require: ticket/change request (`CHANGE_REQUEST_TEMPLATE.md`), Test verification, backup, deployment checklist, rollback owner.

## Incidents

Follow `docs/security/INCIDENT_RESPONSE.md`. Preserve audit logs and dumps for investigation.

## Contacts

Maintain a private IT contact list outside the repository (phones/emails change; do not commit personal numbers).
