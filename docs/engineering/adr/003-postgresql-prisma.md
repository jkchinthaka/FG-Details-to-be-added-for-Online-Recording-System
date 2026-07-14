# ADR-003: PostgreSQL and Prisma

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

The system needs relational integrity across users, roles, templates, versions, records, approvals, corrective actions, and audit events.

## Decision

Use PostgreSQL as the system of record and Prisma for schema definition, migrations, generated client access, and transactions. Store operational calendar fields as PostgreSQL `DATE` where appropriate.

## Consequences

Foreign keys, unique constraints, and indexes are declared in the Prisma schema and verified through migrations. Prisma generated client code is a build artifact. Query indexes require query-plan evidence; do not add speculative indexes.
