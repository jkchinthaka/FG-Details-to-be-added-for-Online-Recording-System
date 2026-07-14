# ADR-002: Dynamic Checklist Engine

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

Finished-goods records use multiple checklist types that can change over time. Historical submissions must remain interpretable against the content used when recorded.

## Decision

Model stable templates, versioned definitions, ordered sections/items/options, item rules, and typed responses. Render and validate checklist behaviour from `@nelna/shared` definitions. Records reference `ChecklistTemplateVersion`, not merely a template code.

## Consequences

New checklist types are data/configuration work rather than new bespoke forms where supported by item types. Published-version mutation is prohibited through service paths. Non-status response persistence is an explicit future capability, not an implied complete implementation.
