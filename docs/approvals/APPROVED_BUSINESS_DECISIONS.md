# Approved Business Decisions — Nelna FG Digital Recording System

**Rule:** Production-specific policies must not be hard-coded until status is **APPROVED**.  
**Initial state (Prompt 27):** every item is **PENDING BUSINESS CONFIRMATION**.  
**Do not** silently select defaults.

Update a row only when IT Manager / QA Executive / Food Safety Team Leader (as applicable) has recorded an approved answer with date and reference. Mirror the narrative answer into [`NELNA_DECISION_PACK.md`](./NELNA_DECISION_PACK.md).

Machine-readable skeleton (no guessed values): [`business-decisions.example.json`](./business-decisions.example.json).

| Decision ID | Status | Approved answer | Approval date | Approval reference |
|-------------|--------|-----------------|---------------|--------------------|
| BD-01 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-02 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-03 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-04 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-05 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-06 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-07 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-08 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-09 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-10 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-11 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-12 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-13 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-14 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-15 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-16 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-17 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-18 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-19 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-20 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-21 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-22 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-23 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-24 | PENDING BUSINESS CONFIRMATION | — | — | — |
| BD-25 | PENDING BUSINESS CONFIRMATION | — | — | — |

## Implementation gate statement

Later prompts may build **generic configurable** workflow capability.

They **must not** treat any BD-* recommended option as Nelna policy until this file shows **APPROVED** for that ID.

**As of Prompt 27: management or QA decisions are still required.**
