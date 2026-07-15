import { expect, type Page, test } from "@playwright/test";

const REQUIRE_ADMIN_E2E = process.env.VISTAIRE_REQUIRE_ADMIN_E2E === "1";
function requireAdminFixture(value: string | undefined, name: string): string {
  if (value) return value;
  if (REQUIRE_ADMIN_E2E) throw new Error(`${name} must be configured for required admin E2E`);
  test.skip(true, `requires ${name}`);
  return "";
}

function watchHealth(page: Page) {
  const errors: string[] = [], network: string[] = [], heavy: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => network.push(`${request.failure()?.errorText ?? "request failed"} ${request.url()}`));
  page.on("response", response => { if (response.status() === 404 || response.status() >= 500) network.push(`${response.status()} ${response.url()}`); });
  page.on("request", request => { if (/\.glb|usdz|mp4/i.test(request.url())) heavy.push(request.url()); });
  return () => { expect(errors).toEqual([]); expect(network).toEqual([]); expect(heavy).toEqual([]); };
}

test("overview navigates and remains usable at 390 and 430", async ({ page }) => {
  const token = requireAdminFixture(process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN, "VISTAIRE_ADMIN_E2E_QR_TOKEN");
  const healthy = watchHealth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/q/${encodeURIComponent(token!)}`, { waitUntil: "networkidle" });
  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("navigation", { name: "Navigation du restaurant" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const control of await page.getByRole("navigation", { name: "Navigation du restaurant" }).locator("a:visible").all()) {
      const box = await control.boundingBox();
      if (box) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
    }
  }
  await page.getByRole("link", { name: "Analyses", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/insights/);
  healthy();
});

test("overview has visible detailed insights CTA", async ({ page }) => {
  const token = requireAdminFixture(process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN, "VISTAIRE_ADMIN_E2E_QR_TOKEN");
  await page.goto(`/q/${encodeURIComponent(token)}`, { waitUntil: "networkidle" });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin", { waitUntil: "networkidle" });
    const cta = page.getByRole("link", { name: "Voir les statistiques détaillées" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/admin/insights");
    await cta.focus();
    await expect(cta).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/insights/);
  }
});
