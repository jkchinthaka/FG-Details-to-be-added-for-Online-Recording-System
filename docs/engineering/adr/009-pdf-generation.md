# ADR-009: PDF Generation

- **Status:** Accepted (implemented)
- **Date:** 2026-07-14
- **Supersedes:** Deferred stance from earlier MVP baseline

## Context

Operational records must be exportable as official, audit-safe PDFs without inventing a second data store. Electronic approvals must not be labelled as cryptographic digital signatures (BD-25 / legal wording).

## Decision

Generate official record PDFs **server-side** with PDFKit from the live `InspectionRecord` graph (template version, results, truck detail, approvals).

| Concern | Choice |
| --- | --- |
| Source of truth | Same Prisma record used by checklists and workflow APIs |
| Branding | Nelna FG Digital Recording System header |
| Template history | `documentCode` + template `versionNumber` shown as revision |
| Approvals | Timestamps + users; disclaimer is not a crypto signature |
| Access | Operators: own records; others via `records:read` / `reports:read` |
| Storage | Generated on demand (not stored as blobs in this phase) |

Companion CSV exports for operational reports escape `= + - @` formula-injection prefixes.

## Consequences

- Layout is audit-oriented, **not** pixel-perfect paper parity until BD-25 APPROVED.
- Large report CSV export pages until row cap (50 × 100); not a background job queue yet.
- PDF binary dependency (`pdfkit`) is added to `@nelna/api`.
