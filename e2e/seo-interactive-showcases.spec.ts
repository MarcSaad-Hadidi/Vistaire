import { expect, test } from "@playwright/test";

test("PDF versus digital menu keeps its accessible restaurant switcher and comparison slider", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/menu-pdf-vs-menu-digital", {
    waitUntil: "domcontentloaded"
  });

  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("tablist")).toBeVisible();
  await page.waitForTimeout(250);
  expect(pageErrors).toEqual([]);

  const trouvableTab = page.getByRole("tab", { name: "Trouvable" });
  await trouvableTab.click();
  await expect(trouvableTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-active-preview="trouvable"]')).toBeVisible();

  const slider = page.getByRole("slider");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "54");
  await expect(slider).toHaveAttribute("aria-valuetext", /54 pour cent PDF/);
  expect(
    await page.locator("html").evaluate(
      (element) => element.scrollWidth - element.clientWidth <= 2
    )
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("digital restaurant menu keeps the circular reveal lock and Escape reset", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 430, height: 932 });
  const response = await page.goto("/menu-digital-restaurant", {
    waitUntil: "domcontentloaded"
  });

  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator("h1")).toHaveCount(1);
  await page.waitForTimeout(250);
  expect(pageErrors).toEqual([]);
  const saugeTab = page.getByRole("tab", { name: "Sauge Noire" });
  await saugeTab.click();
  await expect(saugeTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-active-preview="sauge-noire"]')).toBeVisible();

  const reveal = page.locator('[data-preview-reveal-frame="true"]');
  await reveal.focus();
  await reveal.press("Enter");
  await expect(reveal).toHaveAttribute("data-reveal-locked", "true");
  await reveal.press("Escape");
  await expect(reveal).toHaveAttribute("data-reveal-locked", "false");
  await expect(reveal).toHaveAttribute("style", /pan-y pinch-zoom/);
  expect(
    await page.locator("html").evaluate(
      (element) => element.scrollWidth - element.clientWidth <= 2
    )
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("digital restaurant Trouvable grid cards keep dish names readable", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/menu-digital-restaurant", {
    waitUntil: "domcontentloaded"
  });

  expect(response?.status()).toBeLessThan(400);
  await page.waitForTimeout(500);
  const trouvableTab = page.getByRole("tab", { name: "Trouvable" });
  await trouvableTab.scrollIntoViewIfNeeded();
  await trouvableTab.click();
  await expect(trouvableTab).toHaveAttribute("aria-selected", "true");

  const reveal = page.locator('[data-preview-reveal-frame="true"]');
  await reveal.focus();
  await reveal.press("Enter");
  await expect(reveal).toHaveAttribute("data-reveal-locked", "true");

  const menu = page.locator(
    '[data-active-preview="trouvable"] [data-menu-ui="trouvable"]'
  );
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Afficher en grille" }).click();
  await expect(reveal).toHaveAttribute("data-reveal-locked", "true");

  const metrics = await menu
    .locator("ul")
    .first()
    .locator("article")
    .first()
    .evaluate((article) => {
      const summary = article.querySelector('[class*="dishSummary"]');
      const visual = article.querySelector('[class*="dishVisual"]');
      const copy = article.querySelector('[class*="dishCopy"]');
      const title = article.querySelector("strong");
      if (!summary || !visual || !copy || !title) {
        throw new Error("SEO Trouvable grid card structure is incomplete");
      }
      const summaryWidth = summary.getBoundingClientRect().width;
      const titleStyle = getComputedStyle(title);
      return {
        summaryWidth,
        visualWidth: visual.getBoundingClientRect().width,
        copyWidth: copy.getBoundingClientRect().width,
        titleLines: Math.round(
          title.getBoundingClientRect().height /
            parseFloat(titleStyle.lineHeight)
        )
      };
    });

  expect(metrics.visualWidth).toBeGreaterThan(metrics.summaryWidth * 0.8);
  expect(metrics.copyWidth).toBeGreaterThan(metrics.summaryWidth * 0.8);
  expect(metrics.titleLines).toBeLessThanOrEqual(3);
  expect(
    await page.locator("html").evaluate(
      (element) => element.scrollWidth - element.clientWidth <= 2
    )
  ).toBe(true);
});

test("digital restaurant Trouvable list cards use one readable column", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/menu-digital-restaurant", {
    waitUntil: "domcontentloaded"
  });

  expect(response?.status()).toBeLessThan(400);
  await page.waitForTimeout(500);
  const trouvableTab = page.getByRole("tab", { name: "Trouvable" });
  await trouvableTab.scrollIntoViewIfNeeded();
  await trouvableTab.click();
  await expect(trouvableTab).toHaveAttribute("aria-selected", "true");

  const reveal = page.locator('[data-preview-reveal-frame="true"]');
  await reveal.focus();
  await reveal.press("Enter");
  await expect(reveal).toHaveAttribute("data-reveal-locked", "true");

  const menu = page.locator(
    '[data-active-preview="trouvable"] [data-menu-ui="trouvable"]'
  );
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Afficher en liste" }).click();
  await expect(reveal).toHaveAttribute("data-reveal-locked", "true");

  const metrics = await menu
    .locator("ul")
    .first()
    .locator("article")
    .first()
    .evaluate((article) => {
      const list = article.closest("ul");
      const summary = article.querySelector('[class*="dishSummary"]');
      const copy = article.querySelector('[class*="dishCopy"]');
      const title = article.querySelector("strong");
      if (!list || !summary || !copy || !title) {
        throw new Error("SEO Trouvable list card structure is incomplete");
      }
      const titleStyle = getComputedStyle(title);
      return {
        listColumns: getComputedStyle(list).gridTemplateColumns,
        listWidth: list.getBoundingClientRect().width,
        cardWidth: article.getBoundingClientRect().width,
        summaryWidth: summary.getBoundingClientRect().width,
        copyWidth: copy.getBoundingClientRect().width,
        titleLines: Math.round(
          title.getBoundingClientRect().height /
            parseFloat(titleStyle.lineHeight)
        )
      };
    });

  expect(metrics.listColumns.split(" ")).toHaveLength(1);
  expect(metrics.cardWidth).toBeGreaterThan(metrics.listWidth * 0.85);
  expect(metrics.copyWidth).toBeGreaterThan(metrics.summaryWidth * 0.35);
  expect(metrics.titleLines).toBeLessThanOrEqual(4);
  expect(
    await page.locator("html").evaluate(
      (element) => element.scrollWidth - element.clientWidth <= 2
    )
  ).toBe(true);
});
