import { expect, type Page, test } from "@playwright/test";

const visualFixture = process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE === "1";
async function enterLocalPreview(page: Page) {
  if (!visualFixture) throw new Error("VISTAIRE_ADMIN_VISUAL_FIXTURE=1 is required for hermetic admin E2E");
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) await preview.click();
  await page.goto("/admin/availability", { waitUntil: "networkidle" });
}
test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => { const url = new URL(route.request().url()); if (["http:", "https:"].includes(url.protocol) && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Non-loopback request blocked"); await route.continue(); });
  await page.routeWebSocket("**/*", async (route) => { const url = new URL(route.url()); if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Non-loopback WebSocket blocked"); route.connectToServer(); });
});
test("availability route stays scoped and responsive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterLocalPreview(page);
  await expect(page.getByRole("heading", { name: /Disponibilités — Gestion opérationnelle/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tous", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
