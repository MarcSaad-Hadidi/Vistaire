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

async function exerciseChart(chart: Locator) {
  const marks = chart.locator("[tabindex]");
  expect(await marks.count()).toBeGreaterThan(1);
  const first = marks.first();
  const second = marks.nth(1);
  const firstExact = await first.getAttribute("aria-label");
  const secondExact = await second.getAttribute("aria-label");
  expect(firstExact).toBeTruthy();
  expect(secondExact).toBeTruthy();

  await first.hover();
  const tooltip = chart.locator("output[data-visible=true]");
  await expect(tooltip).toBeVisible();
  const exactCells = await chart.locator("tbody tr").first().locator("th,td").allTextContents();
  await expect(tooltip).toContainText(exactCells[0]);
  await expect(tooltip).toContainText(exactCells.at(-1)!);
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
    for (let index = 0; index < await charts.count(); index += 1) await exerciseChart(charts.nth(index).locator(".."));
  }
  expect(errors).toEqual([]);
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
    for (const viewport of [{width:320,height:844},{width:360,height:844},{width:375,height:844},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:1440,height:900},{width:1672,height:941},{width:1920,height:1080}]) {
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
