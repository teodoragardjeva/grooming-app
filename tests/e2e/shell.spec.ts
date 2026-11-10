import { expect, test } from "@playwright/test";

test("Bulgarian is the default at /", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Магическа грижа");
  await expect(page.getByRole("link", { name: "Запази час" }).first()).toBeVisible();
});

test("English is served under /en", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Magical care");
});

test("language switcher keeps the current page", async ({ page }) => {
  await page.goto("/services");
  await page.getByRole("link", { name: "English" }).first().click();
  await expect(page).toHaveURL(/\/en\/services$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("link", { name: "Български" }).first().click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "bg");
});

test("pages expose hreflang alternates", async ({ page }) => {
  await page.goto("/about");
  const langs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("hreflang")),
  );
  expect(langs).toEqual(expect.arrayContaining(["bg", "en", "x-default"]));
});

test("unknown paths render the localized 404", async ({ page }) => {
  const res = await page.goto("/en/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Page not found");
});
