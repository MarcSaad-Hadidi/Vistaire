import { expect, type Page, test } from "@playwright/test";
import path from "node:path";

const outputDir = process.env.VISTAIRE_VISUAL_OUTPUT_DIR;

async function enterLocalPreview(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await page.waitForURL(/\/admin$/);
    await page.waitForLoadState("networkidle");
  }
  await expect(page.getByRole("heading", { name: "Maison Élysée", exact: true })).toBeVisible();
}

async function stabilize(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}"
  });
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function assertPageHealth(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth)
  );
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
}

async function capture(page: Page, name: string) {
  if (!outputDir) return;
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false });
}

test.describe("admin deterministic visual contract", () => {
  test.use({ locale: "fr-CA", timezoneId: "America/Toronto", deviceScaleFactor: 1 });

  test("desktop routes render without overflow or unsupported heavy requests", async ({ page }) => {
    const errors: string[] = [];
    const failed: string[] = [];
    const heavy: string[] = [];
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => failed.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`));
    page.on("request", request => { if (/\.(?:glb|usdz|mp4)(?:\?|$)/i.test(request.url())) heavy.push(request.url()); });

    await page.setViewportSize({ width: 1672, height: 941 });
    await enterLocalPreview(page);
    for (const [route, name] of [["/admin", "overview-desktop"], ["/admin/availability", "availability-desktop"], ["/admin/insights", "insights-desktop"]] as const) {
      await page.goto(route, { waitUntil: "networkidle" });
      await stabilize(page);
      await assertPageHealth(page);
      await capture(page, name);
    }
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
    expect(heavy).toEqual([]);
  });

  test("mobile overview is deliberate at every release viewport", async ({ page }) => {
    await enterLocalPreview(page);
    for (const width of [320, 360, 375, 390, 430]) {
      await page.setViewportSize({ width, height: width === 430 ? 932 : 844 });
      await page.goto("/admin", { waitUntil: "networkidle" });
      await stabilize(page);
      await assertPageHealth(page);
      const navigation = page.getByRole("navigation", { name: "Navigation du restaurant" });
      await expect(navigation).toBeVisible();
      for (const link of await navigation.locator("a:visible").all()) {
        const box = await link.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      if (width === 390 || width === 430) await capture(page, `overview-mobile-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 903 });
    await page.goto("/admin", { waitUntil: "networkidle" });
    await stabilize(page);
    const availability = page.getByRole("heading", { name: "Disponibilité des plats" }).locator("..").locator("..");
    const mobileNav = page.getByRole("navigation", { name: "Navigation du restaurant" });
    const availabilityBox = await availability.boundingBox();
    const navBox = await mobileNav.boundingBox();
    expect(availabilityBox?.y ?? Infinity).toBeLessThan(navBox?.y ?? 0);
    await capture(page, "overview-mobile-reference");
    await expect(page).toHaveScreenshot("overview-mobile-390.png", { animations: "disabled", maxDiffPixelRatio: 0.01, threshold: 0.08 });
  });

  test("keyboard, live region and reduced motion remain effective", async ({ page }) => {
    await enterLocalPreview(page);
    await page.setViewportSize({ width: 390, height: 903 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/availability", { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus-visible")).toHaveCount(1);
    await expect(page.locator('[aria-live="polite"]')).not.toHaveCount(0);
    const motion = await page.locator("[class*=adminRoot]").evaluate((root) => {
      const child = root.querySelector("button, a");
      return child ? getComputedStyle(child).transitionDuration : "missing";
    });
    expect(motion).toMatch(/^(0s|1e-05s|0\.00001s|0\.001s|0\.01ms)$/);
  });
});
