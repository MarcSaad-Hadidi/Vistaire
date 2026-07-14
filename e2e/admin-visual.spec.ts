import { expect, type Page, test } from "@playwright/test";
import path from "node:path";

const outputDir = process.env.VISTAIRE_VISUAL_OUTPUT_DIR;

async function enterLocalPreview(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/admin$/);
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

async function capture(page: Page, name: string, fullPage = false) {
  if (!outputDir) return;
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage });
}

async function expectContained(page: Page, selector: string) {
  const violations = await page.locator(selector).evaluateAll((elements) => elements.flatMap((element, index) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return [];
    return element.scrollWidth <= element.clientWidth + 2 && element.scrollHeight <= element.clientHeight + 2 ? [] : [index];
  }));
  expect(violations, `${selector} must not scroll internally`).toEqual([]);
}

async function expectNonIntersecting(page: Page, selector: string) {
  const overlaps = await page.locator(selector).evaluateAll((elements) => {
    const boxes = elements.map((element, index) => ({ index, rect: element.getBoundingClientRect() })).filter(({ rect }) => rect.width > 1 && rect.height > 1);
    const results: string[] = [];
    for (let left = 0; left < boxes.length; left += 1) for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left]; const b = boxes[right];
      const width = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const height = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (width > 1 && height > 1) results.push(`${a.index}:${b.index}`);
    }
    return results;
  });
  expect(overlaps, `${selector} elements must not overlap`).toEqual([]);
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
      if (error === "net::ERR_ABORTED") return;
      failed.push(`${error} ${request.url()}`);
    });
    page.on("request", request => { if (/\.(?:glb|usdz|mp4)(?:\?|$)/i.test(request.url())) heavy.push(request.url()); });

    await page.setViewportSize({ width: 1672, height: 941 });
    await enterLocalPreview(page);
    for (const [route, name] of [["/admin", "overview-desktop"], ["/admin/availability", "availability-desktop"], ["/admin/insights", "insights-desktop"]] as const) {
      await page.goto(route, { waitUntil: "networkidle" });
      await stabilize(page);
      await assertPageHealth(page);
      if (route === "/admin") {
        const momentPanel = page.locator('[data-overview-panel="moment"]');
        const donutPlot = momentPanel.locator("[data-chart-plot-stack]");
        const [panelBox, plotBox] = await Promise.all([momentPanel.boundingBox(), donutPlot.boundingBox()]);
        expect((plotBox?.y ?? Infinity) + (plotBox?.height ?? Infinity)).toBeLessThanOrEqual(
          (panelBox?.y ?? 0) + (panelBox?.height ?? 0) - 1
        );
        const dimensions = await momentPanel.evaluate((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth
        }));
        expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 1);
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      }
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
      const desktopTabs = page.getByRole("navigation", { name: "Sections principales" });
      await expect(navigation).toBeVisible();
      await expect(desktopTabs).toBeHidden();
      await expect(navigation.locator("a")).toHaveCount(3);
      for (const link of await navigation.locator("a:visible").all()) {
        const box = await link.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      const kpis = page.locator("[data-overview-kpis] > article");
      const ranking = page.locator("[data-overview-ranking] > li");
      const availabilityCards = page.locator("[data-overview-availability-card]");
      await expect(kpis).toHaveCount(5);
      await expect(ranking).toHaveCount(5);
      await expect(availabilityCards).toHaveCount(5);
      for (const item of [...await kpis.all(), ...await ranking.all(), ...await availabilityCards.all()]) await expect(item).toBeVisible();

      const activity = page.locator('[data-overview-panel="activity"]');
      const moment = page.locator('[data-overview-panel="moment"]');
      const category = page.locator('[data-overview-panel="category"]');
      await expect(moment).toBeVisible();
      await expect(category).toBeVisible();
      await expect(activity.locator('[aria-label="Métrique affichée"] button')).toHaveCount(3);
      await expect(page.getByRole("link", { name: "Gérer les disponibilités" })).toBeVisible();
      const activityPlot = activity.locator("[data-chart-plot-stack]");
      expect((await activityPlot.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(168);

      const donutPlot = moment.locator("[data-chart-plot-stack]");
      const donutLegend = moment.locator("[data-chart-legend]");
      const donutPlotBox = await donutPlot.boundingBox();
      const donutLegendBox = await donutLegend.boundingBox();
      expect(donutLegendBox?.y ?? 0).toBeGreaterThanOrEqual((donutPlotBox?.y ?? 0) + (donutPlotBox?.height ?? 0) - 1);

      for (const panel of await page.locator("[data-overview-panel]").all()) {
        const dimensions = await panel.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
        expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 1);
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      }

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const lastCardBox = await availabilityCards.last().boundingBox();
      const navBox = await navigation.boundingBox();
      expect((lastCardBox?.y ?? Infinity) + (lastCardBox?.height ?? Infinity)).toBeLessThanOrEqual(navBox?.y ?? 0);
      await page.evaluate(() => window.scrollTo(0, 0));
      if (width === 390 || width === 430) {
        await capture(page, `overview-mobile-${width}`);
        await capture(page, `overview-mobile-${width}-full`, true);
      }
      if (width === 390) await expect(page).toHaveScreenshot("overview-mobile-390.png", { animations: "disabled", maxDiffPixelRatio: 0.01, threshold: 0.08 });
    }

    if (outputDir) {
      await page.setViewportSize({ width: 390, height: 903 });
      await page.goto("/admin", { waitUntil: "networkidle" });
      await stabilize(page);
      await assertPageHealth(page);
      await expect(page.getByRole("navigation", { name: "Sections principales" })).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Navigation du restaurant" })).toBeVisible();
      await capture(page, "overview-mobile-reference");
    }
  });

  test("mobile navigation keeps every admin route reachable without duplicate top tabs", async ({ page }) => {
    await enterLocalPreview(page);
    for (const width of [390, 430]) {
      await page.setViewportSize({ width, height: width === 430 ? 932 : 844 });
      for (const [route, currentLabel] of [["/admin", "Vue d’ensemble"], ["/admin/availability", "Disponibilités"], ["/admin/insights", "Analyses"]] as const) {
        await page.goto(route, { waitUntil: "networkidle" });
        await stabilize(page);
        await assertPageHealth(page);

        const topTabs = page.getByRole("navigation", { name: "Sections principales" });
        const mobileNavigation = page.getByRole("navigation", { name: "Navigation du restaurant" });
        await expect(topTabs).toBeHidden();
        await expect(mobileNavigation).toBeVisible();
        await expect(mobileNavigation.locator("a")).toHaveCount(3);
        await expect(mobileNavigation.getByRole("link", { name: currentLabel, exact: true })).toHaveAttribute("aria-current", "page");
        await expect(page.locator("[data-admin-subtitle]")).toBeVisible();
        await expect(page.getByRole("link", { name: "Ouvrir le menu client", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Copier le lien du menu", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Déconnexion", exact: true })).toBeVisible();
        if (route === "/admin/availability") {
          const metricIcons = page.locator("[data-availability-metric-icon]");
          await expect(metricIcons).toHaveCount(3);
          for (const icon of await metricIcons.all()) await expect(icon).toBeVisible();
        }
        if (route === "/admin/insights") {
          await expect(page.locator("[data-insights-kpi]")).toHaveCount(5);
          const trends = page.locator("[data-kpi-trend]");
          await expect(trends).toHaveCount(4);
          for (const trend of await trends.all()) await expect(trend).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
      }
    }
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
    await expect(rows).toHaveCount(34);
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
    await expect(rows).toHaveCount(8);
    await page.getByRole("button", { name: "Tous", exact: true }).click();
    await expect(rows).toHaveCount(34);
  });

  test("availability thumbnails preserve a stable dish crop across desktop and mobile ratios", async ({ page }) => {
    await enterLocalPreview(page);
    await page.setViewportSize({ width: 1672, height: 941 });
    await page.goto("/admin/availability", { waitUntil: "networkidle" });
    const thumbnail = page.locator("[data-admin-dish-thumbnail] img").first();
    await expect(thumbnail).toBeVisible();
    const desktop = await thumbnail.evaluate((image) => {
      const rect = image.getBoundingClientRect();
      return { width: rect.width, height: rect.height, fit: getComputedStyle(image).objectFit, naturalWidth: (image as HTMLImageElement).naturalWidth, naturalHeight: (image as HTMLImageElement).naturalHeight };
    });
    expect(desktop.fit).toBe("cover");
    expect(desktop.naturalWidth).toBeGreaterThan(0);
    expect(desktop.naturalHeight).toBeGreaterThan(0);
    expect(desktop.width / desktop.height).toBeGreaterThan(2);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await thumbnail.evaluate((image) => {
      const rect = image.getBoundingClientRect();
      return { width: rect.width, height: rect.height, fit: getComputedStyle(image).objectFit };
    });
    expect(mobile.fit).toBe("cover");
    expect(mobile.width / mobile.height).toBeGreaterThan(1);
    expect(mobile.width / mobile.height).toBeLessThan(1.3);
  });

  test("all release viewports keep headers, cards, panels, and mobile navigation separated", async ({ page }) => {
    test.setTimeout(180_000);
    await enterLocalPreview(page);
    const viewports = [
      { width: 320, height: 700 }, { width: 360, height: 780 }, { width: 375, height: 812 },
      { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 },
      { width: 1440, height: 900 }, { width: 1672, height: 941 }, { width: 1920, height: 1080 }
    ];
    const routes = ["/admin", "/admin/availability", "/admin/insights"] as const;
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(route, { waitUntil: "networkidle" });
        await stabilize(page);
        await assertPageHealth(page);
        await expectNonIntersecting(page, "header:first-of-type > div");
        await expectNonIntersecting(page, "header:first-of-type > div:first-child > *");
        await expectNonIntersecting(page, "header:first-of-type > div:first-child > div > *");
        await expectNonIntersecting(page, "header:first-of-type > div:nth-child(2) > *");

        let finalContent = page.locator("main").last();
        if (route === "/admin") {
          await expectContained(page, "[data-overview-panel]");
          await expectNonIntersecting(page, "[data-overview-panel]");
          await expectNonIntersecting(page, "[data-overview-kpis] > article");
          finalContent = page.locator('[data-overview-panel="availability"]');
        } else if (route === "/admin/insights") {
          await expectContained(page, "[data-insights-panel]");
          await expectNonIntersecting(page, "[data-insights-panel]");
          await expectNonIntersecting(page, "[data-insights-kpi]");
          finalContent = page.locator("[data-insights-panel]").last();
        } else {
          await expectContained(page, "[data-admin-menu-dish]");
          await expectNonIntersecting(page, "[data-admin-menu-dish]");
          await expectContained(page, "[data-availability-metric-icon]");
          finalContent = page.locator("[data-admin-menu-dish]").last();
        }

        if (viewport.width <= 700) {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const [contentBox, navBox] = await Promise.all([finalContent.boundingBox(), page.getByRole("navigation", { name: "Navigation du restaurant" }).boundingBox()]);
          expect((contentBox?.y ?? Infinity) + (contentBox?.height ?? Infinity)).toBeLessThanOrEqual((navBox?.y ?? 0) + 1);
        }
      }
    }
  });
});
