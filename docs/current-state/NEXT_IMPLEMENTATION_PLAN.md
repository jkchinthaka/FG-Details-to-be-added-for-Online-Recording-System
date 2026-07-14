# Next Implementation Plan — Nelna FG Digital Recording System

**Phase:** 1 output (planning only)  
**As of:** 2026-07-14  
**Branch:** `develop` @ `9b05434` (audit start)  
**Constraint:** One phase at a time. Commit + `git push origin develop` before starting the next.  
**Production promotion:** Remains **NO-GO** until evidence gates clear.

---

## 1. Sequencing (binding)

| Order | Phase | Title | Commit message (when done) |
|------:|------:|-------|----------------------------|
| 1 | **DONE (this)** | Current-state reconciliation | `docs: reconcile FG implementation and quality status` |
| 2 | Next | Business decision gate | `feat: enforce approved FG business policy configuration` |
| 3 | | Corrective Action lifecycle | `feat: complete corrective action lifecycle` |
| 4 | | Non-conformity decision | Docs only if PENDING → `docs/domain/NON_CONFORMITY_DECISION.md`; implement only if APPROVED |
| 5 | | Truck re-inspection & loading control | `feat: complete truck reinspection and loading control` |
| 6 | | Controlled amendments | `feat: add controlled inspection amendment workflow` |
| 7 | | Recurring task scheduling | `feat: add recurring FG task scheduling` |
| 8 | | Master data & integration readiness | `feat: prepare FG master data and integration contracts` |
| 9 | | Evidence storage hardening | `security: harden inspection evidence storage` |
| 10 | | Notifications & escalation | `feat: add FG notification and escalation engine` |
| 11 | | KPI definitions & executive dashboard | `feat: add governed FG KPIs and executive dashboard` |
| 12 | | Localization & operator UX | `feat: improve FG localization and operator usability` |
| 13 | | Observability & error recovery | `feat: strengthen FG observability and error recovery` |
| 14 | | Integration / E2E quality gate | `test: complete FG integration and end to end quality gate` |
| 15 | | Backup / restore evidence | `test: validate FG backup restore and recovery` |
| 16 | | Formal UAT + controlled pilot | `test: record FG UAT and controlled pilot evidence` |
| — | Final | Release gate | Only with evidence; decision vocabulary: NOT_READY / DEVELOPMENT_READY / UAT_READY / PILOT_READY / PRODUCTION_READY |

---

## 2. Phase 2 scope (next — do not start until Phase 1 pushed)

Read only:

- `docs/approvals/APPROVED_BUSINESS_DECISIONS.md`
- `docs/approvals/NELNA_DECISION_PACK.md`

Deliver:

- Config validation that **blocks production startup** when mandatory **APPROVED** policies are missing  
- Must **not** block local development / automated tests unnecessarily  
- Configurable infrastructure only; keep production policy **disabled/neutral** while BD status is PENDING  
- Never label a recommended option as APPROVED Nelna policy  

---

## 3. Highest product gaps after Phase 2

1. **Corrective Action lifecycle (Phase 3)** — closes DEF-006; largest functional hole vs enterprise target  
2. **Truck re-inspection UI (Phase 5)** — closes DEF-002; API already partial  
3. **Controlled amendments (Phase 6)** — completes DEF-005  
4. **Recurring scheduling (Phase 7)** — extends TaskAssignment safely  

Do **not** invent a NonConformity table before Phase 4 QA/business decision documentation.

---

## 4. Dependency map

```text
Phase 1 audit ──► Phase 2 policy config gate
                      │
                      ├─► Phase 3 CA lifecycle
                      │        └─► (feeds) Phase 5 re-inspect CA links, Phase 10 notifications
                      ├─► Phase 4 NC decision (docs or implement)
                      ├─► Phase 5 truck re-inspect UI (DEF-002)
                      ├─► Phase 6 amendments (DEF-005)
                      └─► Phase 7 scheduling
Phase 8–13 can proceed in order after 3–7 foundations unless a BD blocks specifics
Phase 14–16 remain evidence phases — never fabricate results
```

---

## 5. Explicit non-goals until later gates

- Merge `develop` → `main` for production  
- Tag overwrite of `v1.0.0`  
- Fake ERP calls  
- Claim email/SMS/WhatsApp live  
- Claim formal UAT Pass / restore PASS / pilot metrics  
- Silence dependency advisories without review  

---

## 6. Definition of “Phase 1 complete”

- [x] Working tree audited against code + docs  
- [x] Four current-state artefacts written  
- [x] Defect / baseline / README inconsistencies reconciled at documentation level  
- [ ] Pre-commit quality gate executed for the docs change set  
- [ ] Commit `docs: reconcile FG implementation and quality status`  
- [ ] `git push origin develop`  
- [ ] Local HEAD equals `origin/develop`  

Phase 2 must wait until the unchecked items are done.

---

## 7. Suggested manual verification after push

1. Open `docs/current-state/CURRENT_SYSTEM_AUDIT.md` — confirms NO-GO + domain statuses  
2. Open inventory — CA and reinspect marked PARTIALLY; BD rows BLOCKED  
3. Open reconciliation — DEF statuses use nuanced vocabulary  
4. Confirm remote: `git rev-parse HEAD` == `git rev-parse origin/develop`  
5. Confirm no Phase 2 code landed in the Phase 1 commit  

---

## 8. Safe to start Phase 2?

**Only after** Phase 1 commit is on `origin/develop` with a clean working tree.  
Phase 2 does **not** require APPROVED BDs to start — it builds the enforcement mechanism and documents PENDING decisions.
