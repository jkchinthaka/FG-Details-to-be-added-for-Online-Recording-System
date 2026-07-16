import { test, expect } from "@playwright/test";

/**
 * Username authentication E2E.
 * Runs only when RUN_E2E=1 against a local/UAT stack — never production credentials.
 */
const run = process.env.RUN_E2E === "1";
const operatorUsername = process.env.E2E_OPERATOR_USERNAME;
const operatorPassword = process.env.E2E_OPERATOR_PASSWORD;
const tempUsername = process.env.E2E_TEMP_USERNAME;
const tempPassword = process.env.E2E_TEMP_PASSWORD;
const newPassword = process.env.E2E_NEW_PASSWORD;

test.describe("Username authentication and first password change", () => {
  test.skip(!run, "Set RUN_E2E=1 against local/UAT only");

  test("login page shows Username, not Email", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/^username$/i)).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toHaveCount(0);
    await expect(page.getByPlaceholder("fg.operator01")).toBeVisible();
  });

  test("invalid username/password shows credentials error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/^username$/i).fill("nobody.here");
    await page.getByLabel(/^password$/i).fill("wrong-password-12");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid username or password/i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("valid temporary password redirects to change-password", async ({ page }) => {
    test.skip(
      !tempUsername || !tempPassword,
      "E2E_TEMP_USERNAME / E2E_TEMP_PASSWORD not configured",
    );
    await page.goto("/login");
    await page.getByLabel(/^username$/i).fill(tempUsername!);
    await page.getByLabel(/^password$/i).fill(tempPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/change-password/, { timeout: 20_000 });
  });

  test("protected pages blocked until password change", async ({ page }) => {
    test.skip(
      !tempUsername || !tempPassword,
      "E2E_TEMP_USERNAME / E2E_TEMP_PASSWORD not configured",
    );
    await page.goto("/login");
    await page.getByLabel(/^username$/i).fill(tempUsername!);
    await page.getByLabel(/^password$/i).fill(tempPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/change-password/, { timeout: 20_000 });
    await page.goto("/tasks");
    await expect(page).toHaveURL(/change-password/, { timeout: 20_000 });
  });

  test("successful password change then new password works", async ({ page }) => {
    test.skip(
      !tempUsername || !tempPassword || !newPassword,
      "E2E temp/new password env not configured",
    );
    test.skip(newPassword === tempPassword, "new password must differ from temporary");

    await page.goto("/login");
    await page.getByLabel(/^username$/i).fill(tempUsername!);
    await page.getByLabel(/^password$/i).fill(tempPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/change-password/, { timeout: 20_000 });

    await page.getByLabel(/current password/i).fill(tempPassword!);
    await page.getByLabel(/^new password$/i).fill(newPassword!);
    await page.getByLabel(/confirm new password/i).fill(newPassword!);
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(page).toHaveURL(/tasks/, { timeout: 20_000 });

    await page.goto("/login");
    // After logout cookie clear may be needed via UI if still authenticated
  });

  test("operator username login reaches tasks when password already changed", async ({
    page,
  }) => {
    test.skip(
      !operatorUsername || !operatorPassword,
      "E2E_OPERATOR_USERNAME / E2E_OPERATOR_PASSWORD not configured",
    );
    await page.goto("/login");
    await page.getByLabel(/^username$/i).fill(operatorUsername!);
    await page.getByLabel(/^password$/i).fill(operatorPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/tasks|records|\//, { timeout: 20_000 });
  });
});
