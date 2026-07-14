# Recommended Implementation Order

1. **Preserve** auth, inspection workflow, loading block, admin, reports, GridFS, proxy, production seed.
2. **Close product High defects** — Corrective Action lifecycle + re-inspection linking (this pass).
3. **Admin bootstrap** — supply `BOOTSTRAP_ADMIN_*`, finish sample admin removal.
4. **Notification inbox** — list/read APIs + UI.
5. **Controlled amendment** — revision chain for verified records.
6. **Recurring schedules / shift handover**.
7. **Formal UAT + restore drill** (DEF-012, DEF-011) with signed evidence.
8. **Live Cloudflare + Render** smoke with secrets present.
9. **Only then** consider PRODUCTION_READY.
