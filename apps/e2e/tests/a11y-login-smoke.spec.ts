import { test, expect } from "@playwright/test";

/**
 * Accessibility smoke — login surface only.
 * Runs with the E2E suite when RUN_E2E=1. Does not require axe dependency.
 */
const run = process.env.RUN_E2E === "1";

test.describe("Accessibility smoke (login)", () => {
  test.skip(!run, "Set RUN_E2E=1 against local/UAT only");

  test("login page exposes labelled controls and a primary landmark", async ({
    page,
  }) => {
    await page.goto("/login");

    const main = page.locator("main, [role='main']");
    await expect(main.first()).toBeVisible({ timeout: 20_000 });

    const username = page.getByLabel(/^username$/i);
    const password = page.getByLabel(/^password$/i);
    await expect(username).toBeVisible();
    await expect(password).toBeVisible();

    await expect(username).toHaveAttribute("type", /text|search/i);
    // Default is password; "Show" may flip to text — either is labelled.
    await expect(password).toHaveAttribute("type", /password|text/i);

    const submit = page.getByRole("button", { name: /sign in/i });
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();

    // Username uses autoFocus; ensure a focusable control holds focus.
    const active = await page.evaluate(() => document.activeElement?.tagName ?? "");
    expect(["INPUT", "BUTTON", "A", "SELECT", "TEXTAREA"]).toContain(active);
  });
});
