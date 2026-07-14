# ADR-006: Offline Draft Strategy

- **Status:** Deferred
- **Date:** 2026-07-14

## Context

Field users may expect draft resilience, but durable offline operation requires synchronization, conflict resolution, attachment queuing, authentication refresh handling, and a user-visible recovery model.

## Decision

Do not claim or implement full offline synchronization at this stage. Browser-local draft behaviour may improve usability, but the API remains authoritative and online submission is required.

## Consequences

No service worker, queue, or conflict protocol is introduced by this decision. A future implementation requires a separate ADR covering storage limits, encryption/privacy, conflict policy, attachment upload ordering, retry semantics, and end-to-end tests.
