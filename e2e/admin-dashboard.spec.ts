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

test("overview navigates and remains usable at 390 and 430", async ({ page }) => {
  const healthy = watchHealth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/q/${encodeURIComponent(token!)}`, { waitUntil: "networkidle" });
  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("navigation", { name: "Navigation du restaurant" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const control of await page.locator("a:visible,button:visible").all()) {
      const box = await control.boundingBox();
      if (box) expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
  }
  await page.getByRole("link", { name: "Analyses", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/insights/);
  healthy();
});
