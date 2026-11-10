// Full booking + admin flows. These need a running app with a migrated PostgreSQL database and a
// Resend-capable (or log-only) environment, so they only run when E2E_LIVE=1 is set.
// Start the database first (docker compose up -d db migrate) and set DATABASE_URL for the app.
import { expect, test } from "@playwright/test";

const live = process.env.E2E_LIVE === "1";
test.describe("booking flow (live database)", () => {
  test.skip(!live, "set E2E_LIVE=1 with a configured database to run");

  test("customer can pick service, date and slot and reaches the check-email step", async ({ page }) => {
    await page.goto("/booking");
    await page.getByRole("radio", { name: /Подстригване на нокти/ }).check();
    await page.getByRole("button", { name: /^\d{1,2}$/ }).filter({ hasNot: page.locator("[disabled]") }).first().click();
    await page.getByRole("listitem").getByRole("button", { pressed: false }).first().click();
    await page.getByLabel("Вашето име").fill("Тестова Клиентка");
    await page.getByLabel("Телефон").fill("+359 88 000 0000");
    await page.getByLabel("Имейл").fill("e2e@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Изпрати заявката" }).click();
    await expect(page.getByRole("heading", { name: "Проверете имейла си" })).toBeVisible();
  });

  test("invalid confirm link shows a safe error", async ({ page }) => {
    await page.goto("/booking/confirm?token=this-token-does-not-exist-0000000000");
    await expect(page.getByRole("alert")).toBeVisible();
  });
});

test.describe("admin (live database)", () => {
  test.skip(!live || !process.env.E2E_ADMIN_EMAIL, "needs E2E_LIVE=1, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD");

  test("admin can log in and open the calendar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByLabel("Имейл").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Парола").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Вход" }).click();
    await page.getByRole("link", { name: "Календар" }).click();
    await expect(page.getByRole("heading", { name: "Календар" })).toBeVisible();
  });
});
