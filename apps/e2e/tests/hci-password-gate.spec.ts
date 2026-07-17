import { test, expect } from "@playwright/test";

/**
 * HCI password-gate and redirect-loop checks.
 * Runs only when RUN_E2E=1 against local/UAT — never production credentials.
 */
const run = process.env.RUN_E2E === "1";
const tempUsername = process.env.E2E_TEMP_USERNAME;
const tempPassword = process.env.E2E_TEMP_PASSWORD;

test.describe("HCI password change gate", () => {
  test.skip(!run, "Set RUN_E2E=1 against local/UAT only");

  test("change-password page has no primary app navigation", async ({ page }) => {
    test.skip(
      !tempUsername || !tempPassword,
      "E2E_TEMP_USERNAME / E2E_TEMP_PASSWORD not configured",
    );
    await page.goto("/login");
    await page.getByLabel(/^username$/i).fill(tempUsername!);
    await page.getByLabel(/^password$/i).fill(tempPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/change-password/, { timeout: 20_000 });

    await expect(page.getByText(/Step 1 of 1 — Secure your account/i)).toBeVisible();
    await expect(page.getByRole("navigation", { name: /primary/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Home$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Administration$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sign out/i }).first()).toBeVisible();
  });

  test("no redirect loop between tasks and change-password", async ({ page }) => {
    test.skip(
      !tempUsername || !tempPassword,
      "E2E_TEMP_USERNAME / E2E_TEMP_PASSWORD not configured",
    );
    await page.goto("/login");
    await page.getByLabel(/^username$/i).fill(tempUsername!);
    await page.getByLabel(/^password$/i).fill(tempPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/change-password/, { timeout: 20_000 });

    for (let i = 0; i < 3; i += 1) {
      await page.goto("/tasks");
      await expect(page).toHaveURL(/change-password/, { timeout: 20_000 });
    }
    await expect(page.getByRole("heading", { name: /create a new password/i })).toBeVisible();
  });
});
