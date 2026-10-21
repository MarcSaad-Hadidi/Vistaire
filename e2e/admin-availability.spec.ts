import { expect, test } from "@playwright/test";

const qrToken = process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN;

test("availability route stays scoped and responsive", async ({ page }) => {
  test.skip(!qrToken, "requires VISTAIRE_ADMIN_E2E_QR_TOKEN");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/q/${encodeURIComponent(qrToken ?? "")}`);
  await page.goto("/admin/availability");
  await expect(page.getByRole("heading", { level: 1, name: "Les plats", exact: true })).toBeVisible();
  const availability = page.getByRole("combobox", { name: "Disponibilité", exact: true });
  await expect(availability).toBeVisible();
  await expect(availability.locator("option")).toHaveText(["Tous les plats", "Disponibles", "Indisponibles"]);
  await expect(page.getByRole("button", { name: /Prix manquant|Description manquante|Photo manquante|3D\/AR/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const firstDish = page.locator("article[data-available]").first();
  const name = await firstDish.getByRole("heading").innerText();
  const search = page.getByRole("searchbox", { name: "Rechercher un plat", exact: true });
  await search.fill(name);
  await expect(firstDish).toBeVisible();
  await search.fill("plat-introuvable-e2e");
  await expect(page.getByText("Aucun plat trouvé", { exact: true })).toBeVisible();
});
