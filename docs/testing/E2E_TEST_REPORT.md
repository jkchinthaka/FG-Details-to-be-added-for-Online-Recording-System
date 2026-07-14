# E2E test report — Prompt 36

**Status:** Infrastructure delivered; executable browser scenarios require `RUN_E2E=1` + dedicated test stack.  
**Framework:** Playwright (`apps/e2e`)  
**Must not use:** development or production databases.

## Scenario catalogue

| # | Scenario | Automation status |
| --- | --- | --- |
| 1 | Operator login | Implemented (gated) |
| 2 | View Today's Tasks | Implemented (gated) |
| 3 | Complete all-acceptable daily cleaning | Catalogued — expand in CI once selectors stabilize |
| 4 | Create failed cleaning item | Catalogued |
| 5 | Submit failed item evidence | Catalogued |
| 6 | Supervisor returns record | Catalogued |
| 7 | Operator corrects and resubmits | Catalogued |
| 8 | Supervisor checks | Catalogued |
| 9 | QA verifies | Catalogued |
| 10 | Verified record becomes read-only | Catalogued |
| 11 | Truck all-pass inspection | Catalogued |
| 12 | Critical truck failure | Catalogued |
| 13 | Loading blocked | Catalogued |
| 14 | Corrective Action created | Catalogued |
| 15 | Complete corrective action | Catalogued |
| 16 | Create re-inspection | Catalogued |
| 17 | Approve loading | Catalogued |
| 18 | Generate PDF | Catalogued |
| 19 | Search historical record | Catalogued |
| 20 | Unauthorized access rejected | Implemented (gated) |
| 21 | Offline draft and synchronization | Offline page covered; full sync path catalogued |

## How to run locally

```bash
pnpm db:test:up
cp apps/api/.env.test.example apps/api/.env   # or export env vars
pnpm --filter @nelna/api prisma:migrate:deploy
pnpm --filter @nelna/api prisma:seed
# start api + web against DATABASE_URL for nelna_fg_test
cd apps/e2e && pnpm exec playwright install chromium
RUN_E2E=1 E2E_OPERATOR_EMAIL=... E2E_OPERATOR_PASSWORD=... pnpm test:e2e
```

## Evidence integrity

Plant / CI green runs will attach Playwright HTML reports as artifacts. This document does **not** invent pass counts for scenarios not executed in this environment.
