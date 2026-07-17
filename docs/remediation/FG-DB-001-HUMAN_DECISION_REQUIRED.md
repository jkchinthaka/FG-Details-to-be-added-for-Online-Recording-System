# FG-DB-001 — HUMAN_DECISION_REQUIRED

Unsettled uniqueness / reuse policy (technical defaults applied in code):

1. **Key scope segments** — technical key is
   `documentCode|date|shift|area|vehicle`. Confirm whether load-context,
   inspection-type, or workflow cycle must also participate.
2. **`whenArchived`** — technical default `allow_new_draft` (clear key on
   archive). Alternative: `conflict` (retain key / block new draft).
3. **`whenRejected`** — technical default `resume` (retain key; own rejected
   record is resumed). Alternatives: `allow_new_draft`, `conflict`.
4. **HTTP shape on conflict** — technical default returns HTTP 409
   `DUPLICATE_RECORD` when another operator or an in-flight workflow occupies
   the scope; own draft/rejected resumes with HTTP 200.
