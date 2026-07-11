import { expect, type Page, test } from "@playwright/test";

const token = process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN;

function watchHealth(page: Page) {
  const errors: string[] = [], network: string[] = [], heavy: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.status() === 404 || response.status() >= 500) network.push(`${response.status()} ${response.url()}`); });
  page.on("request", request => { if (/\.glb|usdz|mp4/i.test(request.url())) heavy.push(request.url()); });
  return () => { expect(errors).toEqual([]); expect(network).toEqual([]); expect(heavy).toEqual([]); };
}

test.beforeEach(() => test.skip(!token, "requires VISTAIRE_ADMIN_E2E_QR_TOKEN"));

test("insights supports reduced motion, keyboard and responsive reading order", async ({ page }) => {
  const healthy = watchHealth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/q/${encodeURIComponent(token!)}`, { waitUntil: "networkidle" });
  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
    await page.goto("/admin/insights", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Analyses détaillées" })).toBeVisible();
    await expect(page.getByRole("table").first()).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toHaveCount(1);
  await page.getByRole("link", { name: /Retour au tableau de bord/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin$/);
  healthy();
});
