# Error message standard

| Layer | User sees | Support may see |
| --- | --- | --- |
| Validation | What to fix, in field order | Field names |
| Permission | What permission is missing in plain language | Permission key |
| Network | Connection problem + Retry | Offline / timeout |
| Server | Temporary unavailability + preserve data | Optional request id |
| Session | Session expired + Sign in | `SESSION_EXPIRED` |

Never show stack traces or raw HTTP status alone.

Do not claim success until the server confirms.
