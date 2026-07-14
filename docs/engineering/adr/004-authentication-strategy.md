# ADR-004: Authentication Strategy

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

Operators need low-friction browser sessions while API access requires server-side authentication and role/permission enforcement.

## Decision

Use short-lived JWT access tokens and rotating refresh tokens in HTTP-only cookies. The Next middleware redirects when session cookies are absent; the Nest JWT guard validates credentials on every protected API request. Role and permission decorators guard endpoints, with service-level checks for critical rules.

## Consequences

Cookie presence is not authentication and must never become the API authorization boundary. Refresh tokens are hash-stored and revocable. CORS must remain credentialed and restricted to the configured web origin.
