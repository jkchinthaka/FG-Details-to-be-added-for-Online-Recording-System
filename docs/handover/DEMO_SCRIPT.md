# Demonstration Script — Nelna FG Digital Recording System

**Duration:** ~25–40 minutes  
**Actors:** Facilitator + Operator / Supervisor / QA (or one facilitator switching accounts)  
**Environment:** Test/UAT with seeded users (env-controlled passwords — never read aloud from source control)

---

## Prep

1. Confirm API `/health/ready` and web load.  
2. Two browsers or profiles (Operator vs Supervisor/QA).  
3. Sample photo for fail evidence.  
4. Note open gaps: Check/Verify, reports PDF, CA workspace, re-inspection picker — demo honestly.

---

## Script

| # | Scene | Actions | Say / Show |
|---|-------|---------|------------|
| 1 | Operator login | Valid credentials | Session cookies; role-appropriate nav |
| 2 | Today’s Tasks | Open home/tasks | Assigned cleaning / truck cards |
| 3 | Three-action daily cleaning | Open cleaning → Mark All Acceptable → Review → Submit | Pass path duration |
| 4 | Failed cleaning item | New draft or remaining → mark Unacceptable + remark | Exception path |
| 5 | Photo / evidence | Attach required image → submit | Evidence requirement |
| 6 | Supervisor review | Switch user | **Honest:** Check transition deferred; show submitted lock + header “Pending check” if present |
| 7 | QA verification | Switch user | **Honest:** Verify deferred; show loading-decision capability on truck instead |
| 8 | Truck pass | Freezer truck form → all pass → submit | Pass path |
| 9 | Critical truck failure | Fail critical item → submit | Loading blocked state |
| 10 | Automatic loading block | Attempt approve as unauthorized / show UI restrictions | Cannot unsafe-approve |
| 11 | Corrective action | Inspect DB or API/list if available | Auto-created CA for configured fails; UI workspace placeholder |
| 12 | Re-inspection | Show API/schema link if UI picker incomplete | Traceability intent; OBD-07 |
| 13 | Report | Open Reports | Placeholder — roadmap |
| 14 | PDF | — | Deferred ADR-009 |
| 15 | Audit history | Show audit log query or API evidence from loading decision | `AuditLog` on decisions |
| 16 | Admin template revision | Show template preview / describe publish API | Version immutability |
| 17 | Offline draft and sync status | Airplane mode → edit → local draft; reconnect | Local backup only; full sync backlog |

---

## Close

Recap value (speed + loading safety + versioned history). List limitations and next decisions from `OPEN_BUSINESS_DECISIONS.md`. Collect questions into `CHANGE_REQUEST_TEMPLATE.md`.
