# Known Limitations — Nelna FG Digital Recording System v1.0.0

1. **Checked By / Verified By / Return workflow** — APIs + pending queues delivered in Prompt 28; formal plant UAT and BD-05/06 APPROVED role policy still outstanding.  
2. **Self-check / self-verify** — Interim backend SoD defaults active; awaiting BD-05/06 APPROVED confirmation.  
3. **CA assignment, evidence, overdue, closure UI/API** — Incomplete (DEF-006)  
4. **Truck re-inspection picker / full chain UI** — Incomplete (DEF-002)  
5. **Reports / PDF / CSV** — Delivered (Prompt 31). Limitations: in-memory page slice for some aggregations (5k row take / 50 CSV pages); PDF layout is audit pack not paper facsimile (BD-25 PENDING).  
6. **Admin user & vehicle CRUD** — Delivered (Prompt 32): `/admin/users`, `/admin/master-data/*`, `/admin/vehicles`, `/admin/drivers`, `/admin/transporters` APIs + minimal web admin pages. Limitations: users list returns only the first page unless the UI is extended with paging controls; no bulk import; loading-decision-policy content is admin-supplied only (no built-in Nelna policy); master-data rows are soft-deactivated, never hard-deleted (DEF-008 closed as product-delivered, see `DEFECT_REGISTER.md`).  
7. **Offline sync (service worker)** — Delivered (Prompt 34). Residual: CA queue sync limited; IndexedDB not encrypted; plant UAT unsigned.  
8. **Web route guards** — Verified session via `/auth/me` (Prompt 33). Residual: short-lived access token after logout until TTL; middleware requires API availability.  
9. **Void / amendment UX polish** — Void API present; amendment workflow thin (DEF-005 partial)  
10. **Database restore** — Not proven (DEF-011)  
11. **Formal multi-role plant UAT** — Unsigned (DEF-012)  
12. **Prettier format:check** — Cleared in Prompt 35 (`pnpm format`).  
13. **Dependency advisories** — Reviewed; see `docs/engineering/DEPENDENCY_REVIEW.md` (no unsafe bulk upgrades).  
14. Open BD-01–BD-25 remain PENDING in `docs/approvals/APPROVED_BUSINESS_DECISIONS.md` 

These limitations bound the CONDITIONAL GO — see `GO_LIVE_DECISION.md`.
