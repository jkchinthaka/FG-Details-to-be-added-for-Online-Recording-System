# ADR-007: File Storage Strategy

- **Status:** Proposed
- **Date:** 2026-07-14

## Context

Inspection evidence and corrective-action evidence require retention, access control, content validation, and auditability.

## Decision

Store attachment metadata and its owning record/result/action in PostgreSQL. The current `fileUrl` field is an integration boundary, not a confirmed production storage architecture.

## Consequences

Before production file uploads, choose an object-storage provider and define private object access, signed URL lifetime, malware scanning, file type/size enforcement, retention/deletion policy, backup, and migration of existing data URLs. Do not store production binary evidence indiscriminately in relational rows.
