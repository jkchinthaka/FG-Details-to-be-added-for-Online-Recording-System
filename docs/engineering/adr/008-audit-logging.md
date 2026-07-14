# ADR-008: Audit Logging

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

Compliance workflows need attributable evidence for sensitive operational decisions without exposing credentials or uncontrolled personal data.

## Decision

Record application-level audit events in `AuditLog` with actor, action, entity type/id, structured metadata, and timestamp. Log sensitive loading-decision recommendation and final-decision changes; retain approval records as workflow facts.

## Consequences

Audit payloads must exclude tokens, passwords, and unnecessary sensitive data. Audit writes belonging to one business action should be transactionally coupled to that action; current non-atomic paths are tracked as technical debt.
