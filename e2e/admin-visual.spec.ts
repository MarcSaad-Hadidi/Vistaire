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
    page.on("requestfailed", request => {
      const error = request.failure()?.errorText ?? "failed";
      if (error === "net::ERR_ABORTED" && /[?&]_rsc=/.test(request.url())) return;
      failed.push(`${error} ${request.url()}`);
    });
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
    const firstAvailabilityCard = page.locator("[data-overview-availability-card]").first();
    const mobileNav = page.getByRole("navigation", { name: "Navigation du restaurant" });
    const availabilityBox = await availability.boundingBox();
    const navBox = await mobileNav.boundingBox();
    expect(availabilityBox?.y ?? Infinity).toBeLessThan(navBox?.y ?? 0);
    await expect(firstAvailabilityCard.locator("img")).toBeVisible();
    await expect(firstAvailabilityCard.locator("strong").first()).toBeVisible();
    await expect(firstAvailabilityCard.getByText(/Disponible|Indisponible/)).toBeVisible();
    await expect(firstAvailabilityCard.getByRole("link", { name: /Gérer la disponibilité/ })).toBeVisible();
    const cardBox = await firstAvailabilityCard.boundingBox();
    expect((cardBox?.y ?? Infinity) + (cardBox?.height ?? Infinity)).toBeLessThanOrEqual(navBox?.y ?? 0);
    await capture(page, "overview-mobile-reference");
    await expect(page).toHaveScreenshot("overview-mobile-390.png", { animations: "disabled", maxDiffPixelRatio: 0.01, threshold: 0.08 });
  });

  test("keyboard, live region and reduced motion remain effective", async ({ page }) => {
    await enterLocalPreview(page);
    await page.setViewportSize({ width: 390, height: 903 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/availability", { waitUntil: "networkidle" });
    const focusOrder: string[] = [];
    for (let index=0; index<6; index+=1) { await page.keyboard.press("Tab"); const focused=page.locator(":focus-visible"); await expect(focused).toHaveCount(1); focusOrder.push(await focused.evaluate((element)=>`${element.tagName}:${element.getAttribute("aria-label")||element.textContent?.trim()}`)); }
    expect(new Set(focusOrder).size).toBe(focusOrder.length);
    await expect(page.locator('p[aria-live="polite"]')).toContainText(/résultat/);
    const navigationSnapshot=await page.getByRole("navigation",{name:"Navigation du restaurant"}).ariaSnapshot();
    expect(navigationSnapshot).toContain("Vue d’ensemble"); expect(navigationSnapshot).toContain("Disponibilités"); expect(navigationSnapshot).toContain("Analyses");
    const motion = await page.locator("[class*=adminRoot]").evaluate((root) => [...root.querySelectorAll("button,a,svg polyline")].slice(0,20).map((element)=>({animation:getComputedStyle(element).animationDuration,transition:getComputedStyle(element).transitionDuration})));
    for(const value of motion){expect(value.animation).toMatch(/^(0s|1e-05s|0\.00001s|0\.001s|0\.01ms)$/);expect(value.transition).toMatch(/^(0s|1e-05s|0\.00001s|0\.001s|0\.01ms)$/)}
  });

  test("availability search and final-state filters remain complete on mobile", async ({ page }) => {
    await enterLocalPreview(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/availability", { waitUntil: "networkidle" });
    await stabilize(page);
    await assertPageHealth(page);

    const rows = page.locator("article[data-available]");
    await expect(rows).toHaveCount(12);
    const firstName = await rows.first().getByRole("heading", { level: 3 }).innerText();
    const search = page.getByPlaceholder("Rechercher un plat…");
    await search.fill(firstName);
    await expect(rows).toHaveCount(1);
    await search.fill("plat-introuvable-visual");
    await expect(page.locator('[role="status"]').filter({ hasText: /Aucun plat/ })).toBeVisible();
    await search.fill("");

    for (const name of ["Tous", "Disponibles", "Indisponibles"]) {
      const button = page.getByRole("button", { name, exact: true });
      const box = await button.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Indisponibles", exact: true }).click();
    await expect(page.locator('[role="status"]').filter({ hasText: /Aucun plat/ })).toBeVisible();
    await page.getByRole("button", { name: "Tous", exact: true }).click();
    await expect(rows).toHaveCount(12);
  });
});
