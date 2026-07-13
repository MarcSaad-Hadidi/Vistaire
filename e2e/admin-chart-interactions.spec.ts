import { expect, type Locator, type Page, test } from "@playwright/test";

async function enterPreview(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await page.waitForURL(/\/admin$/);
    await page.waitForLoadState("networkidle");
  }
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

test("full-menu fixture preserves all 12 scoped dishes and both availability states", async ({ page }) => {
  test.skip(process.env.VISTAIRE_ADMIN_FIXTURE_SCENARIO !== "full-menu", "requires the explicit full-menu fixture scenario");
  await enterPreview(page);
  await page.goto("/admin/availability", { waitUntil: "networkidle" });
  const rows = page.locator("article[data-available]");
  await expect(rows).toHaveCount(12);
  expect(await page.locator('article[data-available="true"]').count()).toBeGreaterThan(0);
  expect(await page.locator('article[data-available="false"]').count()).toBeGreaterThan(0);
  const names = await rows.getByRole("heading", { level: 3 }).allTextContents();
  expect(new Set(names).size).toBe(12);
  const categories = await rows.locator("h3 + p").allTextContents();
  expect(new Set(categories).size).toBeGreaterThanOrEqual(4);
});

test.describe("touch chart contract", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("tap pins, second tap closes, and outside tap dismisses", async ({ page }) => {
    await enterPreview(page);
    await page.goto("/admin/insights", { waitUntil: "networkidle" });
    const mark = page.locator('svg[role="group"] [tabindex], svg[role="grid"] [tabindex]').first();
    const chart = mark.locator("xpath=ancestor::div[1]");
    const tooltip = chart.locator("output[data-visible=true]");
    await expect(mark).toBeAttached();
    await mark.tap({ force: true });
    await expect(tooltip).toBeVisible();
    await mark.tap({ force: true });
    await expect(tooltip).toBeHidden();
    await mark.tap({ force: true });
    await expect(tooltip).toBeVisible();
    await page.locator("h1").tap();
    await expect(tooltip).toBeHidden();
  });
});
