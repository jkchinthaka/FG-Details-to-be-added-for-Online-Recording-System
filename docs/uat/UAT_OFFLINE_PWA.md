# UAT — Offline queue and PWA (Prompt 34)

| ID | Scenario | Expected |
| --- | --- | --- |
| PWA-Q01 | Offline draft on cleaning | Draft saved; not marked submitted |
| PWA-Q02 | Refresh mid-draft | Draft recoverable if newer than server |
| PWA-Q03 | Reconnect with queued item | Sync to SYNCED; success only then |
| PWA-Q04 | Duplicate submit retry | No duplicate server record |
| PWA-Q05 | Failed sync | SYNC_FAILED + manual retry |
| PWA-Q06 | Template version changed | Conflict review |
| PWA-Q07 | Verified server newer | Conflict; draft not applied |
| PWA-Q08 | Permission changed | Conflict |
| PWA-Q09 | Service worker update | Update prompt; safe reload |
| PWA-Q10 | Logout | Queue cleared; drafts policy documented |
