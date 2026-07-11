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

test("insights supports reduced motion, keyboard and responsive reading order", async ({ page }) => {
  const token = requireAdminFixture(process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN, "VISTAIRE_ADMIN_E2E_QR_TOKEN");
  const healthy = watchHealth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/q/${encodeURIComponent(token!)}`, { waitUntil: "networkidle" });
  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
    await page.goto("/admin/insights", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Analyses détaillées" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const controls = page.getByRole("navigation", { name: "Navigation du restaurant" }).locator("a:visible").or(page.getByRole("navigation", { name: "Période analysée" }).locator("a:visible")).or(page.getByRole("link", { name: /Retour au tableau de bord/ }));
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      if (box) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
    }
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toHaveCount(1);
  await page.getByRole("link", { name: /Retour au tableau de bord/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin$/);
  healthy();
});
