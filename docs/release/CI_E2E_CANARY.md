# CI canary — E2E failure must block

## Evidence requirement

Mandatory E2E in `.github/workflows/ci.yml` must **not** use `continue-on-error`.

## Canary procedure (capture once, then revert)

1. Temporarily add a failing Playwright assertion in `apps/e2e`.
2. Push a branch and confirm the `Playwright E2E` job fails and blocks merge.
3. Remove the deliberate failure immediately after capturing CI URL/log evidence.
4. Store evidence path under `reports/p0/ci-canary-evidence.md` (no secrets).

Status this window: **CANARY_NOT_EXECUTED_IN_THIS_SESSION** — workflow updated to remove `continue-on-error`; live GitHub Actions canary still required.
