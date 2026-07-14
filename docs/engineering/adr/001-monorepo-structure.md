# ADR-001: Monorepo Structure

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

The browser application, API, domain contracts, and UI primitives must evolve together while retaining clear runtime boundaries.

## Decision

Use a pnpm workspace: `apps/web` and `apps/api` are deployable applications; `packages/shared` holds platform-neutral domain contracts and rules; `packages/ui` holds reusable UI primitives.

## Consequences

Shared contracts reduce client/server drift. Applications must not import each other, and `shared` must not depend on React, Nest, Prisma, environment variables, or browser APIs. Workspace build order remains explicit.
