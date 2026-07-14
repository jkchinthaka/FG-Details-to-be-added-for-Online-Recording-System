# ADR-005: Record Immutability

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

Quality records must preserve their historical content, operator, review history, and loading decisions.

## Decision

Records are editable only in the draft lifecycle. Submission locks operator edits; records are retained through statuses including `ARCHIVED` rather than physical deletion. Each record references the exact checklist version used. Re-inspections link to their original record.

## Consequences

Templates can evolve without rewriting historical records. Sensitive decisions require auditable workflow writes. Application code must enforce transition legality until database-level controls are justified and introduced with migration safety review.
