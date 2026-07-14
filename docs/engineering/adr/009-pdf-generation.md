# ADR-009: PDF Generation

- **Status:** Deferred
- **Date:** 2026-07-14

## Context

The system may need printable, auditable record exports. A compliant document requires approved layout, field coverage, historical template rendering, signatures, evidence links, generation authority, and retention rules.

## Decision

Defer PDF generation. No PDF library, export endpoint, or client-side rendering workaround is introduced by this audit.

## Consequences

When requirements are approved, create a follow-up ADR that decides server versus client generation, immutable source payload, template/version rendering, pagination, signatures, access control, storage, and test fixtures. Until then, reports/pages are not evidence of a formal export capability.
