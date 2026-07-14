import { expect, type Browser, type Locator, type Page, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const visualOutputDir = process.env.VISTAIRE_INSIGHTS_VISUAL_OUTPUT_DIR ?? process.env.VISTAIRE_VISUAL_OUTPUT_DIR;
const panelCaptureNames = ["activity", "comparison", "heatmap", "top-dishes", "top-searches", "categories", "service", "summary", "key-insights"];

async function enterPreview(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/admin$/);
    await page.waitForLoadState("networkidle");
  }
  await page.goto("/admin/insights", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

function watchRuntime(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (!failure.includes("ERR_ABORTED")) errors.push(`request: ${request.method()} ${request.url()} (${failure})`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`response: ${response.status()} ${response.url()}`);
  });
  return () => expect(errors, "unexpected console, page, or network errors").toEqual([]);
}

async function boxes(locator: Locator) {
  return locator.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
  }));
}

function intersects(a: Awaited<ReturnType<typeof boxes>>[number], b: Awaited<ReturnType<typeof boxes>>[number]) {
  return a.x < b.right - 1 && a.right > b.x + 1 && a.y < b.bottom - 1 && a.bottom > b.y + 1;
}

async function expectViewportContained(page: Page, locator: Locator) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.y).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectTooltipMatchesMark(page: Page, frame: Locator, mark: Locator, ignoredTail = 0) {
  const aria = await mark.getAttribute("aria-label");
  expect(aria).toBeTruthy();
  if (await mark.evaluate((element) => element.tagName.toLowerCase() === "path")) {
    await mark.scrollIntoViewIfNeeded();
    const point = await mark.evaluate((element) => {
      const path = element as SVGPathElement;
      const local = path.getPointAtLength(path.getTotalLength() * 0.15);
      const screen = new DOMPoint(local.x, local.y).matrixTransform(path.getScreenCTM()!);
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.move(point.x, point.y);
  } else {
    await mark.hover();
  }
  const tooltip = frame.locator('output[data-visible="true"]');
  await expect(tooltip).toBeVisible();
  const tooltipText = (await tooltip.innerText()).replace(/\s+/g, " ");
  const pieces = aria!.split(",").slice(0, aria!.split(",").length - ignoredTail).map((piece) => piece.trim()).filter(Boolean);
  for (const piece of pieces) {
    for (const fragment of piece.split(":").map((value) => value.trim().replace(/\s+/g, " ")).filter(Boolean)) expect(tooltipText).toContain(fragment);
  }
  await expectViewportContained(page, tooltip);
  await page.mouse.move(0, 0);
}

async function expectPanelContainment(page: Page) {
  const violations = await page.locator("[data-insights-panel]").evaluateAll((panels) => panels.flatMap((panel, panelIndex) => {
    const panelRect = panel.getBoundingClientRect();
    const panelStyle = getComputedStyle(panel);
    const results: string[] = [];
    if (panel.scrollWidth - panel.clientWidth > 2 || panel.scrollHeight - panel.clientHeight > 2) results.push(`panel ${panelIndex} scroll overflow`);
    if ([panelStyle.overflow, panelStyle.overflowX, panelStyle.overflowY].some((value) => value === "scroll" || value === "auto")) results.push(`panel ${panelIndex} scroll container`);
    const targets = panel.querySelectorAll<HTMLElement>("[data-chart-frame], svg, [data-chart-legend], [data-chart-heat-legend], ol, ul, details[open], output[data-visible='true']");
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      const srOnly = rect.width <= 1.5 && rect.height <= 1.5;
      const fixedMobileTooltip = style.position === "fixed" && target.matches("output");
      const closedDisclosure = Boolean(target.closest("details:not([open])"));
      const hidden = style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0;
      if (srOnly || fixedMobileTooltip || closedDisclosure || hidden) continue;
      if (rect.left < panelRect.left - 2 || rect.right > panelRect.right + 2 || rect.top < panelRect.top - 2 || rect.bottom > panelRect.bottom + 2) {
        results.push(`panel ${panelIndex} does not contain ${target.tagName.toLowerCase()}${target.getAttribute("data-chart-kind") ? `[${target.getAttribute("data-chart-kind")}]` : ""}`);
      }
    }
    return results;
  }));
  expect(violations).toEqual([]);
}

test("Insights desktop follows the reference composition without clipping or runtime errors", async ({ page }) => {
  const assertRuntime = watchRuntime(page);
  await page.setViewportSize({ width: 1672, height: 941 });
  await enterPreview(page);
  await expect(page.getByRole("heading", { name: /Maison/ })).toBeVisible();
  await expect(page.locator("[data-insights-kpi]")).toHaveCount(5);
  await expect(page.locator("[data-insights-panel]")).toHaveCount(9);
  await expect(page.locator("[data-insights-dish-row]:visible")).toHaveCount(5);
  await expect(page.locator("[data-insights-search-row]:visible")).toHaveCount(5);
  await expect(page.locator('svg[data-chart-kind="line"]')).toHaveCount(1);
  await expect(page.locator('svg[data-chart-kind="comparison"]')).toHaveCount(1);
  await expect(page.locator('svg[data-chart-kind="heatmap"]')).toHaveCount(1);
  await expect(page.locator('svg[data-chart-kind="donut"]')).toHaveCount(2);
  expect(await page.getByText(/Heures affich.es en UTC/, { exact: true }).evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 1 && rect.height > 1 && style.visibility !== "hidden";
  }).length)).toBe(1);
  expect(await page.getByText(/fresh|delayed|stale|no-evidence|sample-too-small|source-incomplete/i).count()).toBe(0);

  await expectPanelContainment(page);
  const panelBoxes = await boxes(page.locator("[data-insights-panel]"));
  for (let left = 0; left < panelBoxes.length; left += 1) for (let right = left + 1; right < panelBoxes.length; right += 1) expect(intersects(panelBoxes[left], panelBoxes[right])).toBe(false);
  const [header, kpis] = await Promise.all([boxes(page.locator("[data-insights-header]")), boxes(page.locator("[data-insights-kpis]"))]);
  expect(intersects(header[0], kpis[0])).toBe(false);
  const iconSignatures = await page.locator("[data-insights-kpi] [data-kpi-icon] svg").evaluateAll((icons) => icons.map((icon) => icon.innerHTML));
  expect(new Set(iconSignatures).size).toBe(5);
  if (visualOutputDir) {
    await mkdir(visualOutputDir, { recursive: true });
    await page.screenshot({ path: path.join(visualOutputDir, "insights-full-page.png"), fullPage: true });
    const panels = page.locator("[data-insights-panel]");
    for (const [index, name] of panelCaptureNames.entries()) await panels.nth(index).screenshot({ path: path.join(visualOutputDir, `insights-panel-${index + 1}-${name}.png`) });
  }
  assertRuntime();
});

test("Insights KPI and ranking bars expose restrained entry motion", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __adminMotionEvents?: Array<{ animationName: string; marker: string | null }> }).__adminMotionEvents = [];
    document.addEventListener("animationstart", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const marker = target.getAttribute("data-chart-animated") ?? (target.hasAttribute("data-insights-kpi") ? "insights-kpi" : null);
      if (marker) (window as unknown as Window & { __adminMotionEvents: Array<{ animationName: string; marker: string | null }> }).__adminMotionEvents.push({ animationName: event.animationName, marker });
    });
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enterPreview(page);
  await expect.poll(() => page.evaluate(() => (window as Window & { __adminMotionEvents?: Array<{ marker: string | null }> }).__adminMotionEvents?.map(({ marker }) => marker) ?? [])).toEqual(expect.arrayContaining(["insights-kpi", "insights-rank-bar"]));
});

test("Insights charts expose exact hover, keyboard, and metric-switch behavior", async ({ page }) => {
  const assertRuntime = watchRuntime(page);
  await page.setViewportSize({ width: 1672, height: 941 });
  await enterPreview(page);

  const lineFrame = page.locator('[data-chart-frame][data-chart-kind="line"]');
  const initialPath = await lineFrame.locator("path[class*=line]").getAttribute("d");
  const initialKey = await lineFrame.locator("[data-chart-animation-key]").getAttribute("data-chart-animation-key");
  await page.getByRole("button", { name: "Recherches", exact: true }).click();
  await expect.poll(() => lineFrame.locator("path[class*=line]").getAttribute("d")).not.toBe(initialPath);
  await expect(lineFrame.locator("[data-chart-animation-key]")).not.toHaveAttribute("data-chart-animation-key", initialKey!);

  await expectTooltipMatchesMark(page, lineFrame, lineFrame.locator("[data-chart-point]").nth(2));
  const comparisonFrame = page.locator('[data-chart-frame][data-chart-kind="comparison"]');
  const comparisonMark = comparisonFrame.locator("rect[tabindex]").nth(2);
  await expect(comparisonMark).toHaveAttribute("aria-label", /Jour 3 · actuelle 05 juill\. · précédente 28 juin/);
  await expectTooltipMatchesMark(page, comparisonFrame, comparisonMark);
  const axisLabelBoxes = await boxes(comparisonFrame.locator('[data-chart-axis="x"] text'));
  for (let index = 1; index < axisLabelBoxes.length; index += 1) expect(intersects(axisLabelBoxes[index - 1], axisLabelBoxes[index])).toBe(false);
  const heatmapFrame = page.locator('[data-chart-frame][data-chart-kind="heatmap"]');
  await expectTooltipMatchesMark(page, heatmapFrame, heatmapFrame.getByRole("gridcell").nth(80));
  const donutFrames = page.locator('[data-chart-frame][data-chart-kind="donut"]');
  for (const frame of await donutFrames.all()) await expectTooltipMatchesMark(page, frame, frame.locator("path[tabindex]").first(), 1);

  const dishRow = page.locator("[data-insights-dish-row]").first();
  await dishRow.getByRole("button").hover();
  await expect(dishRow.locator("output")).toBeVisible();
  await expect(dishRow.locator("output")).toContainText(/consultations · rang 1/);
  await expectViewportContained(page, dishRow.locator("output"));
  const searchRow = page.locator("[data-insights-search-row]").first();
  await searchRow.getByRole("button").hover();
  await expect(searchRow.locator("output")).toBeVisible();
  await expect(searchRow.locator("output")).toContainText(/recherches/);
  await expectViewportContained(page, searchRow.locator("output"));

  const firstPoint = lineFrame.locator("[data-chart-point]").first();
  await firstPoint.focus();
  await expect(firstPoint).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const secondPoint = lineFrame.locator("[data-chart-point]").nth(1);
  await expect(secondPoint).toBeFocused();
  expect(await secondPoint.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  await page.keyboard.press("Enter");
  await expect(lineFrame.locator('output[data-visible="true"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lineFrame.locator("output")).toHaveAttribute("data-visible", "false");
  await expect(lineFrame.locator("output")).toHaveCSS("opacity", "0");
  assertRuntime();
});

test("Insights search disclosure reveals real additional rows", async ({ page }) => {
  const assertRuntime = watchRuntime(page);
  await enterPreview(page);
  await expect(page.locator("[data-insights-search-row]:visible")).toHaveCount(5);
  const exactSearchCount = await page.getByRole("table", { name: "Liste exacte de toutes les recherches" }).locator("tbody tr").count();
  expect(exactSearchCount).toBeGreaterThan(5);
  const disclosure = page.getByText("Voir toutes les recherches", { exact: true });
  await expect(disclosure).toBeVisible();
  await disclosure.click();
  await expect(page.locator("[data-insights-search-row]:visible")).toHaveCount(exactSearchCount);
  await expect(page.locator("[data-insights-search-extra]")).toContainText("menu végétarien");
  assertRuntime();
});

test("Insights mobile reading path has no horizontal overflow, clipping, or overlap", async ({ page }) => {
  const assertRuntime = watchRuntime(page);
  for (const width of [320, 360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: width === 430 ? 932 : 844 });
    await enterPreview(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const panelBoxes = await boxes(page.locator("[data-insights-panel]"));
    for (let index = 1; index < panelBoxes.length; index += 1) expect(panelBoxes[index].y).toBeGreaterThanOrEqual(panelBoxes[index - 1].bottom - 1);
    await expectPanelContainment(page);
    await expect(page.locator('[data-chart-frame][data-chart-kind="donut"] [data-chart-legend]').first()).toBeAttached();
  }
  assertRuntime();
});

test("Insights touch interactions pin, toggle, and dismiss chart tooltips", async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fr-CA", timezoneId: "America/Toronto", baseURL: process.env.PLAYWRIGHT_BASE_URL });
  const page = await context.newPage();
  const assertRuntime = watchRuntime(page);
  await enterPreview(page);
  const frame = page.locator('[data-chart-frame][data-chart-kind="line"]');
  const point = frame.locator("[data-chart-point]").nth(2);
  await point.tap();
  await expect(frame.locator('output[data-visible="true"]')).toBeVisible();
  await expectViewportContained(page, frame.locator('output[data-visible="true"]'));
  await point.tap();
  await expect(frame.locator("output")).toHaveAttribute("data-visible", "false");
  await expect(frame.locator("output")).toHaveCSS("opacity", "0");
  await point.tap();
  await page.getByRole("heading", { name: /Maison/ }).tap();
  await expect(frame.locator("output")).toHaveAttribute("data-visible", "false");
  await expect(frame.locator("output")).toHaveCSS("opacity", "0");
  assertRuntime();
  await context.close();
});

test("Insights reduced motion preserves all chart geometry without entry animations", async ({ page }) => {
  const assertRuntime = watchRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterPreview(page);
  await expect(page.locator('svg[data-reduced-motion="true"]')).toHaveCount(5);
  await expect(page.locator('svg[data-chart-kind="line"] path[class*=line]')).toHaveAttribute("d", /^M /);
  await expect(page.locator('svg[data-chart-kind="comparison"] [data-chart-series] path')).toHaveCount(2);
  await expect(page.locator('svg[data-chart-kind="heatmap"] [role="gridcell"]')).toHaveCount(168);
  expect(await page.locator('svg[data-chart-kind="donut"] path[tabindex]').count()).toBeGreaterThan(2);
  const animationCounts = await page.locator("[data-insights-kpi], [data-insights-panel]").evaluateAll((elements) => elements.map((element) => element.getAnimations({ subtree: true }).length));
  expect(animationCounts.every((count) => count === 0)).toBe(true);
  assertRuntime();
});
