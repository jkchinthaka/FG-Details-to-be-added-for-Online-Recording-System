# PWA and offline sync

## Installability

- `public/manifest.webmanifest` + icons
- Service worker `public/sw.js` registered by `ServiceWorkerRegistrar`
- Update prompt when a new SW is waiting (`SKIP_WAITING`)

## Offline behaviour

| Surface | Behaviour |
| --- | --- |
| Daily Cleaning / Truck submit while offline | Queued `WAITING_TO_SYNC` — UI states not submitted |
| Reconnect | `processOfflineQueue` runs; backoff on `SYNC_FAILED` |
| Conflicts | `/offline/conflicts` + status bar link |
| Logout | Clears IndexedDB queue (no auth secrets stored) |

## Failure recovery matrix (offline)

| Failure | Recovery |
| --- | --- |
| Offline submit | Queue + retry on online |
| Duplicate after retry | Treat server non-draft as synced |
| Template version drift | `CONFLICT_REQUIRES_REVIEW` |
| Newer server version | Conflict — do not overwrite |
| Permission changed | Conflict |
| SW update mid-session | User confirms Update prompt |

## Security

- HttpOnly auth cookies only; queue payloads exclude secrets
- Logout clears local queue
- Do not claim cryptographic encryption of IndexedDB payloads in this phase (device lock presumed)

## UAT

See `docs/uat/UAT_OFFLINE_PWA.md`.
