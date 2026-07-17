import { test, expect } from "@playwright/test";

/**
 * FG-CI-001 canary — intentional failure when E2E_CANARY_FAIL=1.
 *
 * Default / CI: skipped (E2E_CANARY_FAIL unset or "0").
 * Proof method: see docs/ci/CANARY_E2E_BLOCK_PROOF.md
 *
 * Never leave E2E_CANARY_FAIL=1 enabled in CI or default local runs.
 */
const canaryArmed = process.env.E2E_CANARY_FAIL === "1";

test.describe("CI canary (must stay disarmed)", () => {
  test("intentional fail when E2E_CANARY_FAIL=1", async () => {
    test.skip(
      !canaryArmed,
      "Canary disarmed — set E2E_CANARY_FAIL=1 only for gate proof",
    );
    expect(
      false,
      "FG-CI-001 canary: this failure must block the workflow when armed",
    ).toBe(true);
  });
});
