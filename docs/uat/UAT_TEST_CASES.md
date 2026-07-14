# UAT Test Cases — Nelna FG Digital Recording System

**Companion to:** `UAT_TEST_PLAN.md`  
**Legend (Result column filled in `UAT_EXECUTION_RESULTS.md`):** Pass | Fail | Blocked | Deferred | Not Executed | Partial (automated only)

Each case lists **Expected** behaviour. Do not mark Pass without evidence.

---

## AUTH — Authentication & access

| ID | Title | Role | Preconditions | Steps | Expected |
|----|-------|------|---------------|-------|----------|
| AUTH-01 | Valid login | Any active | Seeded ACTIVE user | Open login → enter valid email/password → submit | Redirect to app; cookies set; `/auth/me` returns user |
| AUTH-02 | Invalid login | — | — | Submit wrong password | Error; no session cookies with usable access |
| AUTH-03 | Inactive user | — | User status not ACTIVE | Login with correct password | `ACCOUNT_INACTIVE` (or equivalent); no usable session |
| AUTH-04 | Session expiry / refresh | Operator | Logged in | Wait past access TTL or clear access cookie only; use app | Refresh issues new access **or** controlled re-login; no opaque 500 |
| AUTH-05 | Unauthorized page / API | Operator | Operator login | Call Admin-only API or open restricted admin action | API 403; UI does not claim success |
| AUTH-06 | Lockout after repeated failures | — | Fresh account | Fail login ≥ max attempts | Temporary lockout; unlock after configured minutes |

---

## CL24 — Daily cleaning (NMS/PPU/CL/24)

| ID | Title | Role | Steps (summary) | Expected |
|----|-------|------|-----------------|----------|
| CL24-01 | All acceptable | Operator | Create/resume today draft → mark all Acceptable → review → submit | SUBMITTED; no CA for non-CA items |
| CL24-02 | One unacceptable | Operator | Mark one fail + remark (+ evidence if required) → submit | Result recorded; CA if item requires it |
| CL24-03 | Multiple unacceptable | Operator | Fail ≥2 configured items with remarks/evidence → submit | All fails stored; CAs per rules |
| CL24-04 | Required evidence missing | Operator | Fail evidence-required item without photo → submit | Validation error; remains editable |
| CL24-05 | Save draft | Operator | Partial fill → save/autosave | Draft persisted; reload continues |
| CL24-06 | Continue draft | Operator | Reopen Today’s Task / cleaning route | Same draft resumed |
| CL24-07 | Submit | Operator | Complete valid form → submit | Locked from further operator edit |
| CL24-08 | Duplicate daily prevention | Operator | Second create for same date/shift/area | Resume own draft or conflict message; no silent duplicate SUBMITTED |
| CL24-09 | Returned correction | Supervisor→Operator | Return record for correction | Operator can edit REJECTED draft path **if** return API exists |
| CL24-10 | Resubmission | Operator | Fix REJECTED → submit again | New submit succeeds when status allows |

---

## CL30 — Truck inspection (NMS/PPU/CL/30)

| ID | Title | Role | Steps (summary) | Expected |
|----|-------|------|-----------------|----------|
| CL30-01 | All pass | Operator | Select vehicle → all pass → submit | Pass recommendation path |
| CL30-02 | Noncritical failure | Operator | Fail non-critical → remark → submit | Recorded; loading not auto-blocked solely by non-critical |
| CL30-03 | Critical failure | Operator | Fail critical item → submit | Loading blocked / cannot approve override without authority |
| CL30-04 | Loading block | Supervisor/QA | Attempt approve while critical block | API/UI rejects unsafe override |
| CL30-05 | Corrective action | — | After critical fail submit | CA row(s) created when seed requires |
| CL30-06 | Re-inspection | Operator | Start re-inspection linked to prior | `reinspectionOf` set; history traceable |
| CL30-07 | QA loading approval | QA | Safe truck → approve loading | Decision + ApprovalRecord + audit |
| CL30-08 | Unauthorized override | Operator | Call loading-decision without permission | 403 |

---

## WF — Workflow (check / verify / lock)

| ID | Title | Expected when implemented | Notes |
|----|-------|---------------------------|-------|
| WF-01 | Supervisor check | Status CHECKED; checkedBy set; not creator if policy forbids | Deferred — OBD-05/06 |
| WF-02 | Return | Status REJECTED with reason; operator notified | Deferred general return API |
| WF-03 | QA verification | Status VERIFIED; verifiedBy set | Deferred |
| WF-04 | Rejection | QA reject with reason | Deferred / partial |
| WF-05 | Verified record locking | No content mutation after VERIFIED | Partial — SUBMITTED locks; VERIFIED transition missing |
| WF-06 | Self-verification restriction | Creator cannot verify own record | Deferred OBD-06 |
| WF-07 | Amendment or void | Controlled amend/void with audit | Deferred |

---

## CA — Corrective actions

| ID | Title | Expected |
|----|-------|----------|
| CA-01 | Automatic creation | On submit for CA-required fails |
| CA-02 | Assignment | Assignee set via product UI/API |
| CA-03 | In progress | Status transition |
| CA-04 | Evidence upload | Evidence stored on CA |
| CA-05 | Completion | Complete with evidence |
| CA-06 | QA rejection | Reject completion |
| CA-07 | Rework | Return to in progress |
| CA-08 | Closure | Closed/verified terminal state |
| CA-09 | Overdue state | Identifiable overdue list |

---

## RPT — Reports

| ID | Title | Expected |
|----|-------|----------|
| RPT-01 | Daily counts | Accurate daily totals |
| RPT-02 | Monthly compliance | Rate by period |
| RPT-03 | Failed-item report | Lists failed items |
| RPT-04 | Truck pass/fail report | Pass/fail / block stats |
| RPT-05 | Corrective-action report | Open/closed/overdue |
| RPT-06 | PDF output | Traceable PDF |
| RPT-07 | CSV/export | Spreadsheet-compatible export |

---

## ADM — Administration

| ID | Title | Expected |
|----|-------|----------|
| ADM-01 | User creation | Admin creates ACTIVE user |
| ADM-02 | Role assignment | Roles reflected after refresh |
| ADM-03 | User deactivation | Inactive cannot login |
| ADM-04 | Vehicle creation | Unique vehicle numbers |
| ADM-05 | Duplicate prevention | Reject duplicate vehicle/user email |
| ADM-06 | Template draft | Draft version editable |
| ADM-07 | Template publish | Publish sets current; immutability |
| ADM-08 | New revision | Version N+1 draft from prior |
| ADM-09 | Published version protection | Cannot mutate published content |

---

## PWA — Progressive web / offline

| ID | Title | Expected |
|----|-------|----------|
| PWA-01 | Installation | Installable via manifest |
| PWA-02 | Offline draft | Draft survives offline in local store |
| PWA-03 | Reconnection | App recovers when online |
| PWA-04 | Sync | Queued drafts sync without duplicates |
| PWA-05 | Duplicate prevention | Offline sync respects server duplicate rules |
| PWA-06 | Clear sync status | User sees clear pending/synced/error |

---

## A11Y — Accessibility & responsive

| ID | Title | Viewport / mode | Expected |
|----|-------|-----------------|----------|
| A11Y-01 | Small mobile | ~360×640 | Usable Today’s Tasks + forms; no critical overflow |
| A11Y-02 | Standard mobile | ~390×844 | Primary flows usable |
| A11Y-03 | Tablet | ~768×1024 | Layout stable |
| A11Y-04 | Desktop | ≥1280 | Shell + forms usable |
| A11Y-05 | Keyboard operation | Desktop | Tab order; Enter submits where intended |
| A11Y-06 | Visible focus | — | Focus ring visible on interactive controls |
| A11Y-07 | Labels | — | Inputs have accessible names |
| A11Y-08 | Error messages | — | Validation text associated / visible |
| A11Y-09 | No horizontal scrolling | Mobile primary routes | No page-level horizontal scroll |

---

## Traceability to source forms

See `docs/requirements/TRACEABILITY_MATRIX.md` and `FIELD_MAPPING_MATRIX.md` for NMS/PPU/CL/24 and CL/30 field coverage. Cases CL24-* and CL30-* are the operational acceptance of that mapping for MVP submit paths.
