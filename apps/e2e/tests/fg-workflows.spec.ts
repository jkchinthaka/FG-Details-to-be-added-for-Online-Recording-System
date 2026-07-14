import { test, expect } from "@playwright/test";

const run = process.env.RUN_E2E === "1";
const operatorEmail = process.env.E2E_OPERATOR_EMAIL;
const operatorPassword = process.env.E2E_OPERATOR_PASSWORD;

test.describe("Nelna FG end-to-end (executable when RUN_E2E=1)", () => {
  test.skip(!run, "Set RUN_E2E=1 and start web+api against the dedicated test stack");

  test("1. Operator login", async ({ page }) => {
    test.skip(
      !operatorEmail || !operatorPassword,
      "E2E operator credentials not configured",
    );
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(operatorEmail!);
    await page.getByLabel(/password/i).fill(operatorPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/tasks|records|\//, { timeout: 20_000 });
  });

  test("2. View Today's Tasks", async ({ page }) => {
    test.skip(
      !operatorEmail || !operatorPassword,
      "E2E operator credentials not configured",
    );
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(operatorEmail!);
    await page.getByLabel(/password/i).fill(operatorPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.goto("/tasks");
    await expect(page.getByText(/today/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("20. Unauthorized access rejected", async ({ page }) => {
    test.skip(
      !operatorEmail || !operatorPassword,
      "E2E operator credentials not configured",
    );
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(operatorEmail!);
    await page.getByLabel(/password/i).fill(operatorPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.goto("/admin");
    await expect(page).toHaveURL(/unauthorized|login|tasks/, { timeout: 20_000 });
  });

  test("21. Offline fallback page", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByText(/offline/i).first()).toBeVisible();
  });
});
