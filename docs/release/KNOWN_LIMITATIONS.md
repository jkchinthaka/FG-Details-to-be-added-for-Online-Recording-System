# Known Limitations — Nelna FG Digital Recording System v1.0.0

1. **Checked By / Verified By** workflow APIs and UI actions are deferred (OBD-05/06; DEF-003).  
2. **General Return** to force `REJECTED` for cleaning records is missing (DEF-001).  
3. **Self-verification restriction** cannot be enforced until Verify exists (DEF-004).  
4. **Corrective-action** assignment, evidence, overdue, and closure UI/API incomplete (DEF-006).  
5. **Reports / PDF / CSV** not delivered (DEF-007; ADR-009).  
6. **Admin user & vehicle CRUD** UIs/APIs incomplete (DEF-008).  
7. **Truck re-inspection picker** incomplete (DEF-002; OBD-07).  
8. **Offline sync** (service worker queue) not implemented; localStorage drafts only (DEF-009).  
9. **Database restore** not proven in this development environment (DEF-011).  
10. **Formal multi-role plant UAT** unsigned (DEF-012).  
11. **Web route guards** are cookie-presence only (DEF-010).  
12. **Prettier format:check** reports existing drift across many files.  
13. **Transitive dependency advisories** remain open (`pnpm audit`).  
14. Open business decisions OBD-01–OBD-10 may change mandates after Nelna confirmation.  

These limitations bound the CONDITIONAL GO — see `GO_LIVE_DECISION.md`.
