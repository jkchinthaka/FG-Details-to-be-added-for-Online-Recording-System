# Review matrix (verification window)

| file path | finding | intended behavior | risk | tests | required | unrelated | generated | sensitive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| apps/api/src/auth/refresh-token-family.ts | FG-006 | Mongo null/unset-safe claim+revoke | high | fg-auth-001, auth.service.spec | yes | no | no | no |
| apps/api/src/auth/auth.service.ts | FG-006 | Explicit nulls on create; revokeAllSessions | high | fg-auth-001 | yes | no | no | no |
| apps/api/src/auth/auth.service.spec.ts | FG-006 | Expect AND/isSet where clauses | med | auth.service.spec | yes | no | no | no |
| apps/api/src/auth/fg-auth-001-refresh-rotation.spec.ts | FG-006 | Force isolated URL; unique email; isSet query | high | fg-auth-001 | yes | no | no | no |
| apps/api/src/users/users.service.ts | FG-006 | Revoke sessions with null/unset match | med | users.service.spec | yes | no | no | no |
| scripts/ci/sanitize-env-db.js | safety | Print host/db flags only | low | manual | yes | no | no | no |
| reports/verification/* | gate | Sanitized verification evidence | low | n/a | yes | no | no | no |
