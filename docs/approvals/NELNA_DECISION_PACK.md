# Nelna Decision Pack — FG Digital Recording System

**Audience:** IT Manager, QA Executive, Food Safety Team Leader  
**Prepared by:** Chinthaka Jayaweera  
**Date:** 2026-07-14 (Prompt 27)  
**Status:** Awaiting management / QA / Food Safety confirmation  

**Rules:** Do not invent Nelna policy. Every **Approved answer** below remains blank until recorded in `APPROVED_BUSINESS_DECISIONS.md` with status **APPROVED**.  
**Recommended safe option** = engineering suggestion only — **not** an approval.

Related files:

- [`APPROVED_BUSINESS_DECISIONS.md`](./APPROVED_BUSINESS_DECISIONS.md)  
- [`REQUIREMENT_SIGNOFF.md`](./REQUIREMENT_SIGNOFF.md)  
- [`DECISION_IMPACT_MATRIX.md`](./DECISION_IMPACT_MATRIX.md)  
- [`business-decisions.example.json`](./business-decisions.example.json)  
- Open engineering list: [`../requirements/OPEN_BUSINESS_DECISIONS.md`](../requirements/OPEN_BUSINESS_DECISIONS.md)  

---

## How to use this pack

1. Review each Decision ID (BD-01 … BD-25).  
2. Choose Approve / Reject / Defer with written answer.  
3. Update `APPROVED_BUSINESS_DECISIONS.md` (status **APPROVED** + date + reference).  
4. Engineering may then hard-code or activate production-specific policy for that ID only.  
5. Until APPROVED, software may offer **configurable** capabilities only.

---

## BD-01 — Record frequency for NMS/PPU/CL/24

| Field | Content |
|-------|---------|
| Decision ID | BD-01 |
| Question | Is NMS/PPU/CL/24 completed once per day, once per shift, or at multiple processing stages? |
| Recommended safe option | Once per **shift** per assigned area (supports plant cadence; configurable). |
| Alternative options | Once per calendar day; multiple stages per shift; area-only without shift. |
| Business impact | Determines required throughput and duplicate prevention. |
| Technical impact | Task assignment uniqueness keys; duplicate draft rules; reporting aggregates. |
| Risk if not confirmed | Wrong mandatory record counts; audit mismatch with paper practice. |
| Decision owner | Food Safety Team Leader + QA Executive |
| Approved answer | _blank — see APPROVED_BUSINESS_DECISIONS_ |
| Approval date | |
| Signature / approval reference | |

---

## BD-02 — Who records the form

| Field | Content |
|-------|---------|
| Decision ID | BD-02 |
| Question | Which user role records the form (CL/24 and CL/30)? |
| Recommended safe option | **FG Operator** records; other roles may be granted record permission if needed. |
| Alternative options | Supervisor records; shared workstation with named operator field only. |
| Business impact | Accountability on Recorded By. |
| Technical impact | Permission `records:create` / role mapping; UI entry points. |
| Risk if not confirmed | Wrong person identity on audits. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-03 — Checked By role

| Field | Content |
|-------|---------|
| Decision ID | BD-03 |
| Question | Which role performs Checked By? |
| Recommended safe option | **FG Supervisor** (matches existing role model intention). |
| Alternative options | QA Executive checks; Food Safety Team Leader checks; multi-role permission. |
| Business impact | First-line review accountability. |
| Technical impact | Check transition permission; queues; SoD rules. |
| Risk if not confirmed | Workflow cannot be activated for production paper-equivalence. |
| Decision owner | QA Executive + Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-04 — Verified By role

| Field | Content |
|-------|---------|
| Decision ID | BD-04 |
| Question | Which role performs Verified By? |
| Recommended safe option | **QA Executive** verifies. |
| Alternative options | Food Safety Team Leader verifies; dual QA+Food Safety. |
| Business impact | Final quality sign-off. |
| Technical impact | Verify permission; Pending Verification queue; immutable verified state. |
| Risk if not confirmed | Cannot close paper-equivalent verification chain. |
| Decision owner | QA Executive + Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-05 — Creator self-check

| Field | Content |
|-------|---------|
| Decision ID | BD-05 |
| Question | Can the creator check their own record? |
| Recommended safe option | **No** — segregation of duty. |
| Alternative options | Yes; Yes only if Supervisor absence with secondary approver. |
| Business impact | Independence of check. |
| Technical impact | Backend SoD rule on check transition. |
| Risk if not confirmed | Unsafe default if “yes” invented; blocked workflow if “no” without alternative coverage. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-06 — Checker self-verify

| Field | Content |
|-------|---------|
| Decision ID | BD-06 |
| Question | Can the checker verify the same record? |
| Recommended safe option | **No** — separate checker and verifier. |
| Alternative options | Yes; Yes under two-person exemption log. |
| Business impact | Dual control. |
| Technical impact | Backend SoD on verify vs checkedBy. |
| Risk if not confirmed | Same as BD-05. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-07 — Mandatory Correction

| Field | Content |
|-------|---------|
| Decision ID | BD-07 |
| Question | Which failures require a mandatory Correction (immediate on-form correction note)? |
| Recommended safe option | Every Unacceptable/Fail item (strict); configurable per item. |
| Alternative options | Critical-only; remark-required seed flags only. |
| Business impact | Operator workload vs evidence completeness. |
| Technical impact | Template rules / validation on submit. |
| Risk if not confirmed | Under/over collection of corrections. |
| Decision owner | QA Executive |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-08 — Formal Corrective Action

| Field | Content |
|-------|---------|
| Decision ID | BD-08 |
| Question | Which failures require a formal Corrective Action? |
| Recommended safe option | Items marked `correctiveActionRequiredOnFail` on the published template (configurable). |
| Alternative options | All fails; critical truck only; supervisor discretion after submit. |
| Business impact | CA volume and Food Safety workload. |
| Technical impact | Auto-create CA on submit; CA module scope. |
| Risk if not confirmed | Conflict with seed vs paper wording. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-09 — Photo evidence

| Field | Content |
|-------|---------|
| Decision ID | BD-09 |
| Question | Which failures require photo evidence? |
| Recommended safe option | Items with `requiresEvidenceOnFail` on template (configurable). |
| Alternative options | All fails; critical only; none for cleaning / truck only. |
| Business impact | Phone storage, time, privacy. |
| Technical impact | Attachment validation; storage capacity. |
| Risk if not confirmed | Insufficient evidence or excessive burden. |
| Decision owner | QA Executive |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-10 — Critical truck items (loading block)

| Field | Content |
|-------|---------|
| Decision ID | BD-10 |
| Question | Which freezer truck checklist items are critical and automatically block loading? |
| Recommended safe option | Explicit named list approved against paper NMS/PPU/CL/30; store as template critical flags. |
| Alternative options | Use current seed list as interim Test-only (not production hard-lock without approval). |
| Business impact | Loading safety vs false blocks. |
| Technical impact | Loading block engine; override denial. |
| Risk if not confirmed | Unsafe load or operational deadlock. |
| Decision owner | Food Safety Team Leader + QA Executive |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-11 — Final loading authorization

| Field | Content |
|-------|---------|
| Decision ID | BD-11 |
| Question | Who may provide the final loading authorization? |
| Recommended safe option | Roles holding `loading_decisions:approve` (typically Supervisor and/or QA — confirm names). |
| Alternative options | QA only; Supervisor only; Food Safety only. |
| Business impact | Who can release a truck to load. |
| Technical impact | Permission gate on decision API. |
| Risk if not confirmed | Unauthorized release or bottlenecks. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-12 — Conditional loading approvals

| Field | Content |
|-------|---------|
| Decision ID | BD-12 |
| Question | Are conditional loading approvals allowed? |
| Recommended safe option | **Yes, with mandatory reason + expiry/condition**; disabled until APPROVED. |
| Alternative options | Never; only Food Safety may conditional-approve. |
| Business impact | Flexibility vs strict block. |
| Technical impact | New decision enum values; validation; audit. |
| Risk if not confirmed | Either unsafe invents or missing plant practice. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-13 — Truck re-inspection process

| Field | Content |
|-------|---------|
| Decision ID | BD-13 |
| Question | What is the truck re-inspection process? |
| Recommended safe option | New record linked to original; original immutable; fresh checklist required; show prior fails. |
| Alternative options | Amend original; supervisor-only re-inspect. |
| Business impact | Traceable recovery after block. |
| Technical impact | Re-inspection picker/API; chain UI (Prompt 30). |
| Risk if not confirmed | Lost history or unsafe edits of original. |
| Decision owner | QA Executive + Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-14 — Truck temperature recording

| Field | Content |
|-------|---------|
| Decision ID | BD-14 |
| Question | Must truck temperature be recorded? |
| Recommended safe option | **Yes** if required by paper CL/30 or plant FSMS — confirm field presence. |
| Alternative options | Optional; not used. |
| Business impact | Cold-chain proof. |
| Technical impact | Template item / dedicated field; validation. |
| Risk if not confirmed | Missing regulatory evidence. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-15 — Acceptable temperature limits

| Field | Content |
|-------|---------|
| Decision ID | BD-15 |
| Question | What are the acceptable temperature limits? |
| Recommended safe option | **None hard-coded** until APPROVED; limits from configuration / template rules only. |
| Alternative options | Single max; range; zone-specific. |
| Business impact | Pass/fail automation. |
| Technical impact | Config schema; boundary tests when approved. |
| Risk if not confirmed | Invented limits → unsafe or false fails. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-16 — Backdated records

| Field | Content |
|-------|---------|
| Decision ID | BD-16 |
| Question | Are backdated records allowed? |
| Recommended safe option | **No** for operators; limited window for authorized role with audit reason. |
| Alternative options | Never; yes within N days for all. |
| Business impact | Fraud vs practical catching-up. |
| Technical impact | Date gate on create/draft. |
| Risk if not confirmed | Compliance exposure. |
| Decision owner | QA Executive + IT Manager (controls) |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-17 — Maximum backdate period

| Field | Content |
|-------|---------|
| Decision ID | BD-17 |
| Question | What is the maximum permitted backdate period? |
| Recommended safe option | Leave **unset** until BD-16 APPROVED; example config key only in example JSON. |
| Alternative options | 0 / 1 / 7 calendar days — **do not select without approval**. |
| Business impact | Same as BD-16. |
| Technical impact | Config numeric day limit. |
| Risk if not confirmed | Guessed window is policy invention. |
| Decision owner | QA Executive |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-18 — Retention years

| Field | Content |
|-------|---------|
| Decision ID | BD-18 |
| Question | How many years must verified records be retained? |
| Recommended safe option | Confirm legal/FSMS minimum; soft-archive until purge policy APPROVED. |
| Alternative options | 1 / 2 / 3 / 5 / 7 years — **not selected here**. |
| Business impact | Storage cost and legal hold. |
| Technical impact | Retention jobs; backup retention. |
| Risk if not confirmed | Premature deletion or unbounded growth. |
| Decision owner | Food Safety Team Leader + IT Manager |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-19 — Electronic approvals vs paper signatures

| Field | Content |
|-------|---------|
| Decision ID | BD-19 |
| Question | Are electronic approvals accepted as replacements for paper signatures? |
| Recommended safe option | **Seek explicit Food Safety / regulatory acceptance** before sole digital mode. |
| Alternative options | Hybrid dual print; e-sign only after trial. |
| Business impact | Ability to retire paper. |
| Technical impact | Approval snapshots; PDF evidence; audit. |
| Risk if not confirmed | Audit rejection of digital-only records. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-20 — Paper fallback during outages

| Field | Content |
|-------|---------|
| Decision ID | BD-20 |
| Question | What is the paper fallback process during outages? |
| Recommended safe option | Pre-printed forms + later controlled digital entry by authorized role with link to paper reference. |
| Alternative options | Stop production recording; supervisor paper only. |
| Business impact | Continuity of production. |
| Technical impact | Backfill permissions; optional paper-reference field. |
| Risk if not confirmed | Chaos during outage; duplicate records. |
| Decision owner | IT Manager + Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-21 — Offline / no-internet duration

| Field | Content |
|-------|---------|
| Decision ID | BD-21 |
| Question | How long must the system operate without internet? |
| Recommended safe option | Define target hours; until APPROVED, only local draft backup (current MVP). |
| Alternative options | 0 (online-only); 4h; 24h; full shift. |
| Business impact | PWA sync investment. |
| Technical impact | Service worker queue; conflict rules (ADR-006). |
| Risk if not confirmed | Over-promised offline capability. |
| Decision owner | IT Manager + Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-22 — Default CA ownership

| Field | Content |
|-------|---------|
| Decision ID | BD-22 |
| Question | Who owns corrective actions by default? |
| Recommended safe option | Assign to responsible department lead / Food Safety queue — **role mapping pending**. |
| Alternative options | Creating operator; Supervisor of area; QA. |
| Business impact | Accountability for closure. |
| Technical impact | Default assignee rules; notifications. |
| Risk if not confirmed | Open CAs with no owner. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-23 — CA SLA and escalation

| Field | Content |
|-------|---------|
| Decision ID | BD-23 |
| Question | What is the corrective-action SLA and escalation process? |
| Recommended safe option | Configurable due days by priority + escalate to Food Safety Team Leader when overdue — values PENDING. |
| Alternative options | Fixed 24h/72h; no automated escalation. |
| Business impact | Overdue management. |
| Technical impact | Due-date calc; OVERDUE status; alerts. |
| Risk if not confirmed | Invented SLAs. |
| Decision owner | Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-24 — ERP vs local master data

| Field | Content |
|-------|---------|
| Decision ID | BD-24 |
| Question | Will users, vehicles and drivers come from ERP or local master data? |
| Recommended safe option | Start local/admin-maintained; plan ERP sync only after APPROVED integration design. |
| Alternative options | ERP authoritative day-one; hybrid. |
| Business impact | Master data ownership. |
| Technical impact | Admin CRUD vs integration adapters. |
| Risk if not confirmed | Duplicate masters; sync chaos. |
| Decision owner | IT Manager |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## BD-25 — PDF layout fidelity

| Field | Content |
|-------|---------|
| Decision ID | BD-25 |
| Question | Must PDF exports match the current paper layout exactly? |
| Recommended safe option | Confirm before building PDF (ADR-009); exact match if auditors require visual parity. |
| Alternative options | Structured digital layout with field parity only; exact facsimile. |
| Business impact | Auditor acceptance. |
| Technical impact | PDF engine complexity. |
| Risk if not confirmed | Rejected reports after build spend. |
| Decision owner | QA Executive + Food Safety Team Leader |
| Approved answer | |
| Approval date | |
| Signature / approval reference | |

---

## Sign-off block (pack review)

| Role | Name | Date | Pack reviewed (Y/N) | Signature / email |
|------|------|------|---------------------|-------------------|
| IT Manager | | | | |
| QA Executive | | | | |
| Food Safety Team Leader | | | | |
| Developer (pack prepared) | Chinthaka Jayaweera | 2026-07-14 | Y | Prepared only — not approving answers |

**Management or QA decisions are still required before production-specific policies are activated.**
