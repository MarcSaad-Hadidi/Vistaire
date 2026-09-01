import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";
import {
  ADMIN_VISUAL_FULL_MENU_DISH_IDS,
  adminVisualFullMenuPhotoVersion
} from "./support/adminVisualFixtureData";

async function enterPreview(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/admin$/);
    await page.waitForLoadState("networkidle");
  }
}

async function enterFullMenuPreview(page: Page, testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  expect(baseURL, "Playwright baseURL is required for the local preview grant").toBeTruthy();
  const origin = new URL(baseURL!);
  const response = await page.context().request.post(new URL("/admin/preview", origin).toString(), {
    headers: { Origin: origin.origin },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);

  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) =>
    cookie.name === "vistaire_admin_local_preview" &&
    cookie.path === "/admin" &&
    cookie.httpOnly &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cookie.value)
  )).toBe(true);

  const adminResponse = await page.goto(new URL("/admin", origin).toString(), { waitUntil: "domcontentloaded" });
  expect(adminResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /Aujourd’hui — Centre de pilotage du service/ })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

async function hoverPaintedSvgPath(path: Locator) {
  await path.scrollIntoViewIfNeeded();
  const point = await path.evaluate((element) => {
    if (!(element instanceof SVGGeometryElement)) return null;
    const matrix = element.getScreenCTM();
    const length = element.getTotalLength();
    if (!matrix || !length) return null;
    for (let step = 1; step < 100; step += 1) {
      const local = element.getPointAtLength(length * step / 100);
      const screen = new DOMPoint(local.x, local.y).matrixTransform(matrix);
      if (document.elementFromPoint(screen.x, screen.y) === element) return { x: screen.x, y: screen.y };
    }
    return null;
  });
  expect(point, "donut segment exposes a painted browser hit target").not.toBeNull();
  await path.page().mouse.move(point!.x, point!.y);
}

async function tapInteractiveMark(mark: Locator) {
  await mark.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  const point = await mark.evaluate((element) => {
    if (element instanceof SVGGeometryElement && element.tagName.toLowerCase() === "path") {
      const matrix = element.getScreenCTM();
      const length = element.getTotalLength();
      if (matrix && length) {
        for (let step = 1; step < 100; step += 1) {
          const local = element.getPointAtLength(length * step / 100);
          const screen = new DOMPoint(local.x, local.y).matrixTransform(matrix);
          if (document.elementFromPoint(screen.x, screen.y) === element) {
            return { x: screen.x, y: screen.y };
          }
        }
      }
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const candidate = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hit = document.elementFromPoint(candidate.x, candidate.y);
    return hit && (hit === element || element.contains(hit)) ? candidate : null;
  });
  expect(point, "chart mark exposes a browser hit target").not.toBeNull();
  await mark.page().touchscreen.tap(point!.x, point!.y);
}

async function exerciseChart(chart: Locator) {
  const marks = chart.locator("[tabindex]");
  expect(await marks.count()).toBeGreaterThan(1);
  const first = marks.first();
  const second = marks.nth(1);
  const firstExact = await first.getAttribute("aria-label");
  const secondExact = await second.getAttribute("aria-label");
  expect(firstExact).toBeTruthy();
  expect(secondExact).toBeTruthy();

  const isDonutSegment = await first.evaluate((element) => element.tagName.toLowerCase() === "path" && element.closest('[data-chart-kind="donut"]') !== null);
  if (isDonutSegment) await hoverPaintedSvgPath(first);
  else await first.hover();
  const tooltip = chart.locator("output[data-visible=true]");
  await expect(tooltip).toBeVisible();
  const [tooltipText, exactRows] = await Promise.all([
    tooltip.innerText(),
    chart.locator("tbody tr").evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll("th,td"), (cell) => cell.textContent ?? ""))),
  ]);
  expect(exactRows.some((cells) => tooltipText.includes(cells[0]) && tooltipText.includes(cells.at(-1)!))).toBe(true);
  if (isDonutSegment) await chart.page().mouse.move(0, 0);
  await first.evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })));
  await expect(tooltip).toBeVisible();
  await first.evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })));
  await expect(tooltip).toBeHidden();
  await first.focus();
  await expect(tooltip).toBeVisible();
  const firstTooltip = await tooltip.innerText();
  await second.focus();
  await expect.poll(() => tooltip.innerText()).not.toBe(firstTooltip);

  await first.focus();
  await expect(first).toBeFocused();
  await first.press("ArrowRight");
  await expect(second).toBeFocused();
  await second.press("End");
  await expect(marks.last()).toBeFocused();
  await marks.last().press("Home");
  await expect(first).toBeFocused();
  await first.press("Enter");
  await expect(tooltip).toBeVisible();
  await first.press("Escape");
  await expect(tooltip).toBeHidden();
  await second.focus();
  await first.focus();
  await first.press("Space");
  await expect(tooltip).toBeVisible();
  await first.press("Space");
  await expect(tooltip).toBeVisible();
  await first.press("Escape");
  await expect(tooltip).toBeHidden();
}

async function expectTooltipInsidePlot(chart: Locator, mark: Locator, viewportWidth: number) {
  await chart.scrollIntoViewIfNeeded();
  await mark.focus();
  const tooltip = chart.locator("output[data-visible=true]");
  const plot = chart.locator("[data-chart-plot-stack]");
  await expect(tooltip).toBeVisible();
  const [tooltipBox, plotBox] = await Promise.all([tooltip.boundingBox(), plot.boundingBox()]);
  expect(tooltipBox).not.toBeNull();
  expect(plotBox).not.toBeNull();
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(plotBox!.x - 1);
  expect(tooltipBox!.y).toBeGreaterThanOrEqual(plotBox!.y - 1);
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(plotBox!.x + plotBox!.width + 1);
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(plotBox!.y + plotBox!.height + 1);
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(0);
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(viewportWidth);
}

async function expectReadableNonIntersectingLabels(axis: Locator, direction: "horizontal" | "vertical") {
  const boxes = (await axis.locator("text").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }).filter(({ width, height }) => width > 0 && height > 0))).sort((a, b) => direction === "horizontal" ? a.x - b.x : a.y - b.y);
  expect(boxes.length).toBeGreaterThan(1);
  for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(10);
  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1];
    if (direction === "horizontal") expect(previous.x + previous.width).toBeLessThanOrEqual(boxes[index].x + 1);
    else expect(previous.y + previous.height).toBeLessThanOrEqual(boxes[index].y + 1);
  }
}

test("all rendered admin charts expose exact mouse and keyboard interactions", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  await enterPreview(page);
  for (const route of ["/admin", "/admin/insights"]) {
    await page.goto(route, { waitUntil: "networkidle" });
    const charts = page.locator('svg[role="group"], svg[role="grid"]');
    expect(await charts.count()).toBeGreaterThan(0);
    for (let index = 0; index < await charts.count(); index += 1) {
      await exerciseChart(charts.nth(index).locator("xpath=ancestor::*[@data-chart-frame][1]"));
    }
    if (route === "/admin/insights") {
      const sparklines = page.locator('[data-kpi-trend] [data-interactive="true"]');
      await expect(sparklines).toHaveCount(4);
      for (const sparkline of await sparklines.all()) {
        const mark = sparkline.locator('svg[role="button"]');
        const tooltip = sparkline.locator("output[data-visible=true]");
        await mark.focus();
        await expect(tooltip).toBeVisible();
        await mark.press("Enter");
        await expect(mark).toHaveAttribute("aria-pressed", "true");
        await mark.press("Escape");
        await expect(tooltip).toBeHidden();
        await expect(mark).toHaveAttribute("aria-pressed", "false");
      }
    }
  }
  expect(errors).toEqual([]);
});

test("chart fixtures render readable axes, bounded tooltips, legends and active comparison detail", async ({ page }) => {
  test.setTimeout(120_000);
  await enterPreview(page);
  await page.goto("/admin/insights", { waitUntil: "networkidle" });

  const line = page.locator('[data-chart-kind="line"]').first();
  await expect(line.locator('[data-chart-axis="x"]')).toBeVisible();
  await expect(line.locator('[data-chart-axis="y"]')).toBeVisible();
  await expect(line.locator("[data-chart-grid]").first()).toHaveCSS("stroke-width", "1px");
  await expect(line.locator("[data-chart-area]")).toBeVisible();
  await line.locator("[data-chart-point]").first().hover();
  await expect(line.locator("[data-chart-crosshair]")).toHaveAttribute("data-visible", "true");

  const comparison = page.locator('[data-chart-kind="comparison"]').first();
  await expect(comparison.locator("[data-chart-legend]")).toBeVisible();
  await comparison.locator("[tabindex]").first().hover();
  await expect(comparison.locator("[data-chart-delta]")).toBeVisible();
  const hitBoxes = await comparison.locator('svg[role="group"] rect[tabindex]').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, width: rect.width };
  }));
  for (let index = 1; index < hitBoxes.length; index += 1) {
    expect(hitBoxes[index - 1].x + hitBoxes[index - 1].width).toBeLessThanOrEqual(hitBoxes[index].x + 0.5);
  }

  const heatmap = page.locator('[data-chart-kind="heatmap"]').first();
  await expect(heatmap.locator('[data-chart-axis="hours"]')).toBeVisible();
  await expect(heatmap.locator('[data-chart-axis="rows"]')).toBeVisible();
  await expect(heatmap.locator("[data-chart-heat-legend]")).toHaveText("Faible → Forte");
  const technicalCopy = await page.getByText(/hachures|valeurs exclues|trait plein/i).evaluateAll((elements) => elements.filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 1 && rect.height > 1
      && !element.closest('[class*="srOnly"]') && !element.closest("svg");
  }).length);
  expect(technicalCopy).toBe(0);

  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/insights", { waitUntil: "networkidle" });
    for (const chart of await page.locator("[data-chart-frame]").all()) {
      const marks = chart.locator("[tabindex]");
      if (await marks.count()) {
        await expectTooltipInsidePlot(chart, marks.first(), viewport.width);
        await expectTooltipInsidePlot(chart, marks.last(), viewport.width);
      }
    }
    const mobileLine = page.locator('[data-chart-kind="line"]').first();
    await expectReadableNonIntersectingLabels(mobileLine.locator('[data-chart-axis="x"]'), "horizontal");
    const mobileComparison = page.locator('[data-chart-kind="comparison"]').first();
    await expectReadableNonIntersectingLabels(mobileComparison.locator('[data-chart-axis="x"]'), "horizontal");
    const mobileHeatmap = page.locator('[data-chart-kind="heatmap"]').first();
    await expectReadableNonIntersectingLabels(mobileHeatmap.locator('[data-chart-axis="hours"]'), "horizontal");
    await expectReadableNonIntersectingLabels(mobileHeatmap.locator('[data-chart-axis="rows"]'), "vertical");

    await page.goto("/admin", { waitUntil: "networkidle" });
    const donut = page.locator('[data-chart-frame][data-chart-kind="donut"]');
    if (await donut.isVisible()) {
      const donutMarks = donut.locator("[tabindex]");
      await expectTooltipInsidePlot(donut, donutMarks.first(), viewport.width);
      await expectTooltipInsidePlot(donut, donutMarks.last(), viewport.width);
    }
  }
});

test("chart data changes replay one bounded animation and then settle", async ({ page }) => {
  await enterPreview(page);
  await page.goto("/admin", { waitUntil: "networkidle" });
  const chart = page.locator('[data-chart-kind="line"]').first();
  const before = await chart.locator("[data-chart-animation-key]").getAttribute("data-chart-animation-key");
  await page.getByRole("button", { name: "Consultations" }).click();
  const geometry = chart.locator("[data-chart-animation-key]");
  await expect(geometry).not.toHaveAttribute("data-chart-animation-key", before!);
  const timings = await geometry.evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => {
    const timing = animation.effect?.getTiming();
    return { duration: Number(timing?.duration ?? 0), iterations: Number(timing?.iterations ?? 0) };
  }));
  expect(timings.length).toBeGreaterThan(0);
  expect(timings.every(({ duration, iterations }) => duration >= 180 && duration <= 420 && iterations === 1)).toBe(true);
  await expect.poll(() => geometry.evaluate((element) => element.getAnimations({ subtree: true }).filter(({ playState }) => playState !== "finished").length)).toBe(0);
});

test.describe("reduced chart motion", () => {
  test("data changes do not animate", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enterPreview(page);
    await page.goto("/admin", { waitUntil: "networkidle" });
    const chart = page.locator('svg[data-chart-kind="line"]').first();
    await expect(chart).toHaveAttribute("data-reduced-motion", "true");
    await page.getByRole("button", { name: "Consultations" }).click();
    const geometry = chart.locator("[data-chart-animation-key]");
    await expect(geometry).toBeAttached();
    expect(await geometry.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  });
});

test("overview detailed-insights CTA works at desktop and mobile sizes", async ({ page }) => {
  await enterPreview(page);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin", { waitUntil: "networkidle" });
    const cta = page.getByRole("link", { name: "Voir les statistiques détaillées" });
    await expect(cta).toBeVisible();
    expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await cta.focus();
    await cta.press("Enter");
    await expect(page).toHaveURL(/\/admin\/insights$/);
  }
});

test("all required viewports stay within the document width", async ({ page }) => {
  await enterPreview(page);
  for (const route of ["/admin", "/admin/availability", "/admin/insights"]) {
    for (const viewport of [{width:320,height:700},{width:360,height:780},{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:1440,height:900},{width:1672,height:941},{width:1920,height:1080}]) {
      await page.setViewportSize(viewport);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  }
});

async function forEachAvailabilityPage(page: Page, visit: (rows: ReturnType<Page["locator"]>) => Promise<void>) {
  const pagination = page.getByRole("navigation", { name: "Pagination du catalogue" });
  await expect(page.locator("[data-admin-menu-dish]")).toHaveCount(6, { timeout: 30_000 });
  await expect(pagination).toBeVisible({ timeout: 30_000 });
  const pageButtons = pagination.getByRole("button", { name: /^Page \d+$/ });
  const pageCount = await pageButtons.count();
  expect(pageCount).toBeGreaterThan(0);
  for (let index = 0; index < pageCount; index += 1) {
    const pageButton = pagination.getByRole("button", { name: `Page ${index + 1}`, exact: true });
    await expect.poll(async () => {
      await pageButton.click();
      return pageButton.getAttribute("aria-current");
    }, { timeout: 30_000 }).toBe("page");
    await visit(page.locator("[data-admin-menu-dish]"));
  }
}

test("full-menu admin parity keeps unavailable dishes private while matching available public dishes", async ({ page }, testInfo) => {
  test.skip(process.env.VISTAIRE_ADMIN_FIXTURE_SCENARIO !== "full-menu", "requires the explicit full-menu fixture scenario");
  await enterFullMenuPreview(page, testInfo);
  await page.goto("/admin/availability", { waitUntil: "domcontentloaded" });
  const names: string[] = [];
  const categories: string[] = [];
  const adminDishes: Array<{ id: string | null; categoryId: string | null; available: string | null }> = [];
  await forEachAvailabilityPage(page, async (rows) => {
    names.push(...await rows.locator("h3").allTextContents());
    categories.push(...await rows.locator("h3 + p").allTextContents());
    adminDishes.push(...await rows.evaluateAll((elements) => elements.map((element) => ({
      id: element.getAttribute("data-dish-id"),
      categoryId: element.getAttribute("data-category-id"),
      available: element.getAttribute("data-available"),
    }))));
  });
  expect(adminDishes).toHaveLength(12);
  expect(adminDishes.some(({ available }) => available === "true")).toBe(true);
  expect(adminDishes.some(({ available }) => available === "false")).toBe(true);
  expect(new Set(names).size).toBe(12);
  expect(new Set(categories).size).toBeGreaterThanOrEqual(4);
  adminDishes.sort((left, right) => (left.id ?? "").localeCompare(right.id ?? ""));
  expect(adminDishes).not.toContainEqual(expect.objectContaining({ id: "other-menu-dish" }));
  expect(adminDishes).not.toContainEqual(expect.objectContaining({ id: "foreign-dish" }));

  await page.goto("/menu/maison-elyse", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("LA COLLECTION")).toBeVisible();
  const publicRows = page.locator("[data-public-menu-dish]");
  const availableAdminDishes = adminDishes.filter(({ available }) => available === "true");
  await expect(publicRows).toHaveCount(availableAdminDishes.length);
  const publicDishes = await publicRows.evaluateAll((elements) => elements.map((element) => ({
    id: element.getAttribute("data-dish-id"),
    categoryId: element.getAttribute("data-category-id"),
    available: element.getAttribute("data-available"),
  })).sort((left, right) => (left.id ?? "").localeCompare(right.id ?? "")));
  expect(publicDishes).not.toContainEqual(expect.objectContaining({ id: "other-menu-dish" }));
  expect(publicDishes).not.toContainEqual(expect.objectContaining({ id: "foreign-dish" }));
  expect(publicDishes.every(({ available }) => available === "true")).toBe(true);
  expect(publicDishes).toEqual(availableAdminDishes);
});

test("full-menu admin thumbnails fall back without broken-image icons", async ({ page }, testInfo) => {
  test.skip(process.env.VISTAIRE_ADMIN_FIXTURE_SCENARIO !== "full-menu", "requires the explicit full-menu fixture scenario");
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const adminResponses = new Map<string, import("@playwright/test").Response>();
  const signedResponses = new Map<string, import("@playwright/test").Response>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    const adminMatch = /\/admin\/api\/menu-dishes\/([0-9a-f-]+)\/photo(?:\?|$)/i.exec(url.pathname);
    if (adminMatch && response.request().method() === "GET") {
      adminResponses.set(adminMatch[1].toLowerCase(), response);
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/vistaire-media/")) {
      signedResponses.set(response.url(), response);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error" && message.text() !== "Failed to load resource: net::ERR_FAILED") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/admin/api/menu-dishes/*/photo**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/admin/api/menu-dishes/${ADMIN_VISUAL_FULL_MENU_DISH_IDS[0]}/photo`)) {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await enterFullMenuPreview(page, testInfo);
  await page.goto("/admin/availability", { waitUntil: "domcontentloaded" });
  const naturalWidths = new Map<string, number>();
  let rowCount = 0;
  let hasAvailable = false;
  let hasUnavailable = false;
  let fallbackCount = 0;
  await forEachAvailabilityPage(page, async (rows) => {
    rowCount += await rows.count();
    const states = await rows.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-available")));
    hasAvailable ||= states.includes("true");
    hasUnavailable ||= states.includes("false");
    for (const row of await rows.all()) {
      await row.scrollIntoViewIfNeeded();
      const dishId = await row.getAttribute("data-dish-id");
      if (dishId === ADMIN_VISUAL_FULL_MENU_DISH_IDS[0]) {
        await expect(row.locator("[data-admin-dish-thumbnail-fallback]")).toBeVisible();
        await expect(row.locator("[data-admin-dish-thumbnail] img")).toHaveCount(0);
        fallbackCount += 1;
        continue;
      }
      const image = row.locator("[data-admin-dish-thumbnail] img");
      if (await image.count() === 0) continue;
      // Trigger lazy loading in this row's viewport, then classify the image by
      // its own request lifecycle. `complete=false` before this point is lazy,
      // not broken; after the trigger it must settle with decoded pixels.
      await image.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
      await expect.poll(() => image.evaluate((element) =>
        element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0
      ), { timeout: 30_000 }).toBe(true);
      const state = await image.evaluate((element) => ({
        complete: element instanceof HTMLImageElement && element.complete,
        naturalWidth: element instanceof HTMLImageElement ? element.naturalWidth : 0
      }));
      expect(state.complete).toBe(true);
      expect(state.naturalWidth).toBeGreaterThan(0);
      if (dishId) naturalWidths.set(dishId, state.naturalWidth);
    }
  });
  expect(rowCount).toBe(12);
  expect(hasAvailable).toBe(true);
  expect(hasUnavailable).toBe(true);
  expect(fallbackCount).toBe(1);

  const adminCookie = await page.context().cookies();
  expect(adminCookie.some(({ name }) => name === "vistaire_admin_local_preview")).toBe(true);
  for (const dishId of [ADMIN_VISUAL_FULL_MENU_DISH_IDS[1], ADMIN_VISUAL_FULL_MENU_DISH_IDS[3]]) {
    const response = adminResponses.get(dishId);
    expect(response, `admin photo request for ${dishId}`).toBeDefined();
    expect(response!.status()).toBe(307);
    const signedLocation = response!.headers()["location"];
    expect(signedLocation).toMatch(/^https?:\/\/127\.0\.0\.1:\d+\/storage\/v1\/object\/sign\/vistaire-media\/restaurants\/[^/]+\/photos\/originals\/[^?]+\.png\?token=fixture-signed-token$/);
    const signed = signedResponses.get(signedLocation);
    expect(signed, `signed image response for ${dishId}`).toBeDefined();
    expect(signed!.status()).toBe(200);
    expect(signed!.headers()["content-type"]).toMatch(/^image\/png(?:;|$)/i);
    expect(naturalWidths.get(dishId)).toBeGreaterThan(0);
  }
  const publicUnavailable = await page.request.get(
    `/api/public/menu-dishes/${ADMIN_VISUAL_FULL_MENU_DISH_IDS[3]}/photo?v=${adminVisualFullMenuPhotoVersion(3)}`,
    { maxRedirects: 0 }
  );
  expect(publicUnavailable.status()).toBe(404);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("period changes replace chart evidence and replay bounded animations", async ({ page }) => {
  await page.addInitScript(() => {
    const runtime = window as typeof window & { __chartAnimationEvidence?: Array<{ duration: number; iterations: number }> };
    runtime.__chartAnimationEvidence = [];
    document.addEventListener("animationstart", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.matches("[data-chart-animated]")) return;
      for (const animation of target.getAnimations()) {
        const timing = animation.effect?.getTiming();
        const duration = Number(timing?.duration ?? 0);
        const iterations = Number(timing?.iterations ?? 0);
        if (duration > 0) runtime.__chartAnimationEvidence?.push({ duration, iterations });
      }
    }, true);
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enterPreview(page);
  await page.goto("/admin/insights?range=today", { waitUntil: "networkidle" });
  const keysBefore = await page.locator("[data-chart-animation-key]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-chart-animation-key")));
  await page.evaluate(() => {
    (window as typeof window & { __chartAnimationEvidence?: unknown[] }).__chartAnimationEvidence = [];
  });
  await page.getByRole("link", { name: "7d", exact: true }).click();
  await expect(page).toHaveURL(/range=7d/);
  await expect(page.getByRole("link", { name: "7d", exact: true })).toHaveAttribute("aria-current", "page");
  const keysAfter = await page.locator("[data-chart-animation-key]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-chart-animation-key")));
  expect(keysAfter).not.toEqual(keysBefore);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __chartAnimationEvidence?: unknown[] }).__chartAnimationEvidence?.length ?? 0)).toBeGreaterThan(0);
  const animations = await page.evaluate(() => (window as typeof window & { __chartAnimationEvidence?: Array<{ duration: number; iterations: number }> }).__chartAnimationEvidence ?? []);
  expect(animations.length).toBeGreaterThan(0);
  expect(animations.every(({ duration, iterations }) => duration >= 180 && duration <= 420 && iterations === 1)).toBe(true);
});

test("reduced motion disables every animated chart family without removing geometry", async ({ page }) => {
  await enterPreview(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/insights", { waitUntil: "networkidle" });
  const animated = page.locator("[data-chart-animated]");
  expect(await animated.count()).toBeGreaterThan(20);
  const states = await animated.evaluateAll((elements) => elements.map((element) => ({
    animation: getComputedStyle(element).animationDuration,
    transition: getComputedStyle(element).transitionDuration,
    box: element.getBoundingClientRect().toJSON(),
  })));
  expect(states.every((state) => /^(0s|1e-05s|0\.00001s|0\.001s|0\.01ms)$/.test(state.animation))).toBe(true);
  expect(states.every((state) => state.box.width > 0 || state.box.height > 0)).toBe(true);
});

test.describe("touch chart contract", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("every insights chart supports tap, second tap, and outside dismissal", async ({ page }) => {
    await enterPreview(page);
    await page.goto("/admin/insights", { waitUntil: "networkidle" });
    const charts = page.locator('[data-chart-frame]:has(svg[role="group"] [tabindex], svg[role="grid"] [tabindex])');
    const chartCount = await charts.count();
    expect(chartCount).toBe(5);
    for (let index = 0; index < chartCount; index += 1) {
      const chart = charts.nth(index);
      const marks = chart.locator('svg[role="group"] [tabindex], svg[role="grid"] [tabindex]');
      expect(await marks.count()).toBeGreaterThan(0);
      const mark = marks.first();
      const tooltip = chart.locator("output[data-visible=true]");
      await tapInteractiveMark(mark);
      await expect(tooltip).toBeVisible();
      await tapInteractiveMark(mark);
      await expect(tooltip).toBeHidden();
      await tapInteractiveMark(mark);
      await expect(tooltip).toBeVisible();
      await page.locator("h1").tap();
      await expect(tooltip).toBeHidden();
    }

    const sparklines = page.locator('[data-kpi-trend] [data-interactive="true"]');
    await expect(sparklines).toHaveCount(4);
    for (const sparkline of await sparklines.all()) {
      const mark = sparkline.locator('svg[role="button"]');
      const tooltip = sparkline.locator("output[data-visible=true]");
      await tapInteractiveMark(mark);
      await expect(tooltip).toBeVisible();
      await tapInteractiveMark(mark);
      await expect(tooltip).toBeHidden();
      await tapInteractiveMark(mark);
      await expect(tooltip).toBeVisible();
      await page.locator("h1").tap();
      await expect(tooltip).toBeHidden();
    }
  });
});
