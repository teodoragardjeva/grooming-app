// Runs without any backend: verifies safe behavior when unauthenticated / unconfigured.
import { expect, test } from "@playwright/test";

test("unauthenticated /admin redirects to the login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Вход за администратор" })).toBeVisible();
});

test("admin and tokenized pages are noindex", async ({ request }) => {
  const admin = await request.get("/admin/login");
  expect(admin.headers()["x-robots-tag"]).toContain("noindex");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Disallow: /api");
});

test("API rejects invalid input without leaking internals", async ({ request }) => {
  const res = await request.post("/api/booking", { data: {} });
  expect(res.status()).toBe(400);
  expect(await res.json()).toMatchObject({ ok: false, error: "invalid_input" });
  const bad = await request.get("/api/availability?service=nope");
  expect(bad.status()).toBe(400);
});

test("cron endpoint requires the secret", async ({ request }) => {
  const res = await request.get("/api/cron/cleanup");
  expect([401, 503]).toContain(res.status());
});

test("booking page renders in both languages", async ({ page }) => {
  await page.goto("/booking");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Запази час");
  await page.goto("/en/booking");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Book an appointment");
});
