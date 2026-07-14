# Reliability test inventory

All tests below are deterministic unit/component tests. They do not claim
real-device latency, cellular coverage, service-worker lifecycle, or PostgreSQL
availability measurements.

## Automated coverage

- API network rejection maps to a visible “could not reach the server” error:
  `apps/web/src/lib/inspection-records/api.test.ts`.
- API abort at the 15-second client timeout maps to a visible retry message:
  `apps/web/src/lib/inspection-records/api.test.ts`.
- Dashboard fetch errors, generic rejection fallback, and manual retry are
  covered in `apps/web/src/lib/dashboard/useAsyncResource.test.ts`.
- Local draft recovery round-trips a newer snapshot, rejects stale snapshots,
  and safely ignores malformed timestamps:
  `apps/web/src/lib/draft-storage.test.ts`.
- Autosave debounce and the operator-facing record workflow are covered in
  `apps/web/src/components/records/InspectionRecordWorkspace.test.tsx`.
- Re-submitting an already submitted record returns `RecordLockedException`;
  a successful submit followed by a duplicate attempt creates one corrective
  action and updates task state once:
  `apps/api/src/inspection-records/inspection-records.service.spec.ts`.
- A failed conditional submit claim prevents all downstream workflow writes:
  `apps/api/src/inspection-records/inspection-records.service.spec.ts`.

## Manual/production-like tests required

1. Use Chrome/Android network throttling and airplane mode to verify each target
   in `PERFORMANCE_REPORT.md`.
2. Start the API with an unavailable PostgreSQL endpoint and confirm dashboard
   widgets fail independently and record forms retain local work.
3. Send two simultaneous submit requests against a migrated PostgreSQL database
   and assert one 2xx response, one locked response, and one corrective action.
4. Refresh after an autosave failure; verify that only a locally newer snapshot
   is restored and that a newer server edit wins.
5. Upload representative images over the minimum supported network; verify the
   UI preserves form responses when the image request fails.
6. Expire a session while editing and verify login/re-entry does not silently
   discard the local backup.

## Test execution

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` from the
repository root. Results for this audit must be recorded separately; timings are
not measured in CI/sandbox.
