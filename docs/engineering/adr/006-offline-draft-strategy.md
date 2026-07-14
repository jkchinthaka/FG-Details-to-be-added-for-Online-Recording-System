# ADR-006: Offline Draft Strategy and Sync Queue

- **Status:** Accepted (implemented — Prompt 34)
- **Date:** 2026-07-14
- **Supersedes:** Deferred draft-only stance

## Context

Shop-floor connectivity is unreliable. Operators need transparent offline capture without falsely claiming server submission success.

## Decision

1. Keep online API as source of truth.
2. Use IndexedDB submission queue with explicit states: `SAVED_ON_DEVICE`, `WAITING_TO_SYNC`, `SYNCING`, `SYNCED`, `SYNC_FAILED`, `CONFLICT_REQUIRES_REVIEW`.
3. Generate an idempotency key per queued submission; never show success until `SYNCED`.
4. Do not overwrite newer verified server records with older device drafts.
5. Service worker caches app shell + offline fallback; never caches authentication secrets.
6. Clear offline queue on logout (operational drafts only).

## Consequences

- Evidence-heavy CA sync remains limited until CA submit APIs land (CA drafts `SAVED_ON_DEVICE`).
- Middleware marks `/offline` public for the cached fallback page.
- Plant UAT still required for shop-floor network conditions.
