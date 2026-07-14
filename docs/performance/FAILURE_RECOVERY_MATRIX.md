# Failure-recovery matrix

| Failure mode | Existing/implemented control | Remaining gap | Test reference |
| --- | --- | --- | --- |
| API down | Client maps fetch rejection to a connection message; dashboard widgets isolate failures. | No offline mutation queue. | `inspection-records/api.test.ts`; `useAsyncResource.test.ts` |
| Database down | Nest request fails rather than fabricating success; client retains local form backup until a confirmed save. | No database failover or server-side retry policy. | Manual test in `RELIABILITY_TESTS.md` |
| Slow network | 15-second client timeout; retry actions on load errors; autosave debounce. | Timeout value is a target, not a measured optimum. | `inspection-records/api.test.ts` |
| Lost network during form/submit | Responses are backed up locally and submit shows a user-visible error. | A submit whose response is lost must be reconciled by reopening the record; no idempotency response replay token. | `draft-storage.test.ts`; API/service tests |
| Duplicate tap | Web in-flight guard and API conditional state claim inside a transaction. | None known for the submit transition; validate with real PostgreSQL concurrency. | `inspection-records.service.spec.ts` |
| Refresh during draft | Dirty-unload warning plus newer-local-snapshot recovery. | Browser unload prompts are browser-controlled; no background sync. | `draft-storage.test.ts` |
| Image upload fail | Response state and local backup remain; validation can require evidence where configured. | No resumable upload or object-store retry queue. | Manual test required |
| Session expiry | Protected API rejects expired session; form client exposes the API error. | Draft re-auth/replay flow is not automated. | Manual test required |
| Draft conflict | Restore only if local snapshot is newer than `header.updatedAt`. | Clock skew and simultaneous edits require a server-side revision/version for full optimistic concurrency. | `draft-storage.test.ts` |
| Service-worker update | Web manifest exists. | No explicit update prompt or update-deferral protocol was found. | Manual test required |
| Record verified by another user | Non-editable status produces API `RecordLockedException` on the next edit/submit. | The open form does not live-poll for a verification change. | `inspection-records.service.spec.ts` |
| Concurrent corrective-action update | Submit executes its status claim, corrective actions, task update, and truck recommendation in one transaction; corrective action is unique per result. | General corrective-action editing has no version column. | `inspection-records.service.spec.ts`; migration `20260714060000_harden_submit_idempotency` |

“Gap” means a deliberate follow-up, not a claim that the condition is fully
solved. Confirm the matrix in a production-like environment before rollout.
