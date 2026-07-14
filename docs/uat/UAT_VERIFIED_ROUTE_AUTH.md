# UAT — Verified web route authorization (Prompt 33)

Plant execution unsigned until DEF-012.

| ID | Scenario | Expected |
| --- | --- | --- |
| AUTH-R01 | No cookies → protected URL | Redirect `/login?next=…` |
| AUTH-R02 | Invalid / expired cookies | Login with `reason=session-expired` after me/refresh fail |
| AUTH-R03 | Inactive user | `/account-inactive` |
| AUTH-R04 | Operator opens `/admin` | `/unauthorized` |
| AUTH-R05 | Direct URL to pending-check as operator | Denied |
| AUTH-R06 | Safe return URL `/records` | Restored after login |
| AUTH-R07 | Open redirect `next=//evil` | Falls back to `/tasks` |
| AUTH-R08 | Session expires mid-draft | Dialog; draft not claimed submitted |
| AUTH-R09 | API 401 on records fetch | Session-expired event; drafts preserved |
| AUTH-R10 | HttpOnly cookies | Tokens not readable from `document.cookie` |
