import { expect, test } from "@playwright/test";

const qrToken = process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN;

test("availability route stays scoped and responsive", async ({ page }) => {
  test.skip(!qrToken, "requires VISTAIRE_ADMIN_E2E_QR_TOKEN");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/q/${encodeURIComponent(qrToken ?? "")}`);
  await page.goto("/admin/availability");
  await expect(page.getByRole("heading", { name: "Disponibilité des plats" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tous", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disponibles", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Indisponibles", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Prix manquant|Description manquante|Photo manquante|3D\/AR/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const firstDish = page.locator("article[data-available]").first();
  const name = await firstDish.getByRole("heading").innerText();
  await page.getByPlaceholder("Rechercher un plat").fill(name);
  await expect(firstDish).toBeVisible();
  await page.getByPlaceholder("Rechercher un plat").fill("plat-introuvable-e2e");
  await expect(page.getByRole("status", { name: /Aucun plat/ })).toBeVisible();
});
