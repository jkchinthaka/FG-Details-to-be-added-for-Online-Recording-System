# Release Notes — Nelna FG Digital Recording System v1.0.0

**Tag:** `v1.0.0`  
**Product:** Nelna FG Digital Recording System MVP  
**Developed by:** Chinthaka Jayaweera  

## Highlights

- Mobile-first PWA shell with Nelna branding and design system  
- Secure authentication (cookies, lockout, RBAC API)  
- Today’s Tasks dashboard  
- Digital **Daily Cleaning** (`NMS/PPU/CL/24`) draft → submit with evidence rules  
- Digital **Freezer Truck** (`NMS/PPU/CL/30`) with critical **loading block** and authorized loading decision  
- Versioned checklist template engine (publish / archive immutability)  
- Corrective-action **auto-creation** on configured failures  
- Audit logging for key decisions  
- Health endpoints: `/health`, `/health/live`, `/health/ready`  
- Production environment fail-closed validation  
- Full documentation packs: requirements, security, performance, database, UAT, operations, handover  

## Not in v1.0.0 (explicit)

Check/Verify transitions, full CA workspace, reports/PDF/CSV, admin CRUD consoles, offline sync, proven restore in this gate, signed plant UAT.

## Upgrade / deploy notes

Follow `docs/operations/DEPLOYMENT_RUNBOOK.md`. Set production secrets before starting API. Take a database backup before `migrate deploy`. Prove restore in your environment before relying on backups.

## Go-live

See `GO_LIVE_DECISION.md` — **CONDITIONAL GO**.
