# FG-CI-001 — Canary proof that a failed E2E blocks the workflow

## Intent

Prove that a **required** Playwright failure fails the GitHub Actions workflow
(and therefore blocks merge when branch protection requires `CI PASS`).

## Disarmed by default

- Spec: `apps/e2e/tests/ci-canary-block.spec.ts`
- Arming env: `E2E_CANARY_FAIL=1`
- CI sets `E2E_CANARY_FAIL=0` explicitly
- When disarmed, the canary test is **skipped** (suite stays green)

**Do not leave the canary armed in CI or on shared branches.**

## Proof procedure (temporary)

1. On a throwaway branch or local workflow_dispatch run, set:

   ```bash
   export RUN_E2E=1
   export E2E_CANARY_FAIL=1
   # …same E2E stack as CI (fg_online_test only)…
   pnpm --filter @nelna/e2e test
   ```

2. Expect the canary test to **fail** and Playwright exit non-zero.

3. Optionally push a one-off workflow change that sets `E2E_CANARY_FAIL: "1"`
   on the `e2e` job, open a draft PR, confirm:

   - job `Playwright E2E + accessibility smoke` → **failure**
   - job `CI PASS` → **skipped / failed** (does not succeed)
   - merge blocked when status checks are required

4. **Revert immediately** — restore `E2E_CANARY_FAIL: "0"` (or unset) and
   do not merge an armed canary.

## Acceptance for FG-CI-001

- [x] Canary mechanism exists and is documented
- [x] CI does **not** arm the canary (`E2E_CANARY_FAIL=0`)
- [x] `continue-on-error` removed from the E2E job
- [x] Local proof: `E2E_CANARY_FAIL=1` → Playwright exit 1; disarmed → skipped / exit 0
- [ ] Optional: human runs the temporary proof once against GitHub Actions and
      records the failed check URL in release notes if required
