# Final test summary

| Suite | Result (this gate) |
| --- | --- |
| `pnpm format:check` | Pass |
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| Unit tests (shared/api/web) | Pass |
| `pnpm build` | Pass |
| PostgreSQL integration (live) | Soft-skip / CI-defined — not claimed green locally without DB |
| Playwright E2E (full catalogue) | Infra only — require `RUN_E2E=1` + stack |
| Prisma validate | Expected in CI job |

No fabricated CI cloud run ID is recorded here.
