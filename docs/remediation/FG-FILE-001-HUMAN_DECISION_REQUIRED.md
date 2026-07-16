# FG-FILE-001 — Human Decision Required

The secure streaming evidence pipeline was implemented with conservative,
technically-safe defaults. The following are **business/policy** choices that
should be confirmed by the process owner (QA / Food Safety). They are isolated
and easy to change; none block the security fix.

## 1. Allowed evidence types

Current allow-list (enforced by extension **and** magic-byte signature):

- `image/jpeg` (`.jpg`, `.jpeg`)
- `image/png` (`.png`)
- `image/webp` (`.webp`)
- `image/gif` (`.gif`)
- `application/pdf` (`.pdf`)

**Decision needed:** Is PDF evidence permitted for cleaning / freezer-truck
records, or should evidence be images only? Should HEIC (common on iPhones) be
accepted? HEIC is currently rejected because it cannot be validated by a simple
signature and is not universally viewable.

## 2. File-size and count limits

- Max **4 files** per response.
- Max **8 MB** per file.
- Max **32 MB** per request.

**Decision needed:** Confirm these match operational reality (e.g. multi-page
PDF scans may exceed 8 MB).

## 3. Who may upload / replace evidence

Current rule: **only the record's creator, while the record is still editable**
(DRAFT / RETURNED_FOR_CORRECTION), holding `records:create`.

**Decision needed:** Should supervisors/QA be able to attach or replace evidence
during check/verify, or is evidence strictly operator-owned and frozen at
submission? (Today it is frozen once submitted.)

## 4. Retention of replaced / removed evidence

Current rule: on replacement or removal, the **old binary is deleted** once the
new metadata is committed (with orphan cleanup fallback). There is no versioned
retention of superseded evidence.

**Decision needed:** Does the food-safety audit trail require retaining
superseded evidence (immutable history), or is delete-on-replace acceptable?

## 5. Orphan reconciliation cadence & grace window

`scripts/database/reconcile-evidence-orphans.js` is **read-only by default** and
only deletes orphan binaries older than a **15-minute** grace window when run
with `--cleanup`. It is a manual maintenance command and never runs at startup.

**Decision needed:** Confirm the grace window and who is authorized to run the
`--cleanup` variant in production, and on what schedule.
