import { expect, test } from "@playwright/test";

async function expectShowcaseInteractive(page: import("@playwright/test").Page) {
  await expect(page.locator('[data-testid="landing-comparison"]')).toHaveAttribute(
    "data-tabs-interactive",
    "true"
  );
}

test("public comparison labels and tabs stay readable in light mode without recoloring restaurant menus", async ({ page }) => {
  test.setTimeout(120_000);
  for (const scenario of [
    { path: "/menu-pdf-vs-menu-digital", width: 390 },
    { path: "/menu-digital-restaurant", width: 430 },
    { path: "/en/pdf-vs-digital-menu", width: 1440 },
    { path: "/en/digital-restaurant-menu", width: 390 },
  ]) {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.goto(scenario.path);
    await expectShowcaseInteractive(page);
    const comparison = page.getByTestId("landing-comparison");
    const title = comparison.locator('[class*="activeCopy"] h3');
    const label = comparison.locator('[class*="activeCopy"] p');
    const link = comparison.locator('[class*="activeLink"]');
    const toggle = page.locator("[data-public-theme-toggle]").first();
    if (await toggle.getAttribute("aria-pressed") === "true") await toggle.click();
    await expect(title).toHaveCSS("color", "rgb(255, 250, 240)");
    const menu = comparison.locator('[data-public-menu-renderer]').first();
    await expect(menu).toBeAttached();
    const before = await menu.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.color, style.backgroundColor];
    });
    await toggle.click();
    await expect(title).toHaveCSS("color", "rgb(40, 37, 31)");
    await expect(label).toHaveCSS("color", "rgb(128, 96, 13)");
    await expect(link).toHaveCSS("color", "rgb(128, 96, 13)");
    await expect(comparison.getByRole("tablist")).toHaveCSS("background-color", "rgb(255, 252, 245)");
    await expect(comparison.getByRole("tab", { selected: true })).toHaveCSS("color", "rgb(40, 37, 31)");
    await expect(comparison.getByRole("tab", { selected: false }).first()).toHaveCSS("color", "rgb(98, 91, 80)");
    expect(await menu.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.color, style.backgroundColor];
    })).toEqual(before);
    const next = comparison.getByRole("tab", { name: "Trouvable", exact: true });
    await next.click();
    await expect(next).toHaveAttribute("aria-selected", "true");
    await expect(next).toHaveCSS("border-top-color", "rgb(128, 96, 13)");
    await expect(next).toHaveCSS("background-color", "rgb(238, 231, 217)");
    await next.press("ArrowRight");
    const focused = comparison.getByRole("tab", { name: "Sauge Noire", exact: true });
    await expect(focused).toBeFocused();
    await expect(focused).toHaveCSS("outline-color", "rgb(109, 80, 8)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    await toggle.click();
    await expect(title).toHaveCSS("color", "rgb(255, 250, 240)");
  }
});

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
  await expect(page.locator('[data-testid="landing-comparison"]')).toHaveAttribute(
    "data-preview-status",
    "ready"
  );
  await expectShowcaseInteractive(page);
  expect(pageErrors).toEqual([]);

  const trouvableTab = page.getByRole("tab", { name: "Trouvable" });
  await trouvableTab.click();
  await expect(trouvableTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-active-preview="trouvable"]')).toBeVisible();
  await expect(
    page.locator(
      '[data-active-preview="trouvable"] [data-public-menu-renderer="trouvable"]'
    )
  ).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);

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
  await expect(page.locator('[data-testid="landing-comparison"]')).toHaveAttribute(
    "data-preview-status",
    "ready"
  );
  await expectShowcaseInteractive(page);
  expect(pageErrors).toEqual([]);
  const saugeTab = page.getByRole("tab", { name: "Sauge Noire" });
  await saugeTab.click();
  await expect(saugeTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-active-preview="sauge-noire"]')).toBeVisible();
  await expect(
    page.locator('[data-active-preview="sauge-noire"] [data-sauge-comparison-pages="true"]')
  ).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);

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
  await expectShowcaseInteractive(page);
  const trouvableTab = page.getByRole("tab", { name: "Trouvable" });
  await trouvableTab.scrollIntoViewIfNeeded();
  await trouvableTab.click();
  await expect(trouvableTab).toHaveAttribute("aria-selected", "true");

  const reveal = page.locator('[data-preview-reveal-frame="true"]');
  await reveal.focus();
  await reveal.press("Enter");
  await expect(reveal).toHaveAttribute("data-reveal-locked", "true");

  const menu = page.locator(
    '[data-active-preview="trouvable"] [data-public-menu-renderer="trouvable"]'
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
  await expectShowcaseInteractive(page);
  const trouvableTab = page.getByRole("tab", { name: "Trouvable" });
  await trouvableTab.scrollIntoViewIfNeeded();
  await trouvableTab.click();
  await expect(trouvableTab).toHaveAttribute("aria-selected", "true");

  const reveal = page.locator('[data-preview-reveal-frame="true"]');
  await reveal.focus();
  await reveal.press("Enter");
  await expect(reveal).toHaveAttribute("data-reveal-locked", "true");

  const menu = page.locator(
    '[data-active-preview="trouvable"] [data-public-menu-renderer="trouvable"]'
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

for (const scenario of [
  {
    path: "/en/pdf-vs-digital-menu",
    canonical: "/en/pdf-vs-digital-menu"
  },
  {
    path: "/en/digital-restaurant-menu",
    canonical: "/en/digital-restaurant-menu"
  }
]) {
  test(`English SEO showcase keeps localized metadata and one page heading: ${scenario.path}`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    const response = await page.goto(scenario.path, {
      waitUntil: "domcontentloaded"
    });

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("tablist")).toBeVisible();
    await expectShowcaseInteractive(page);
    await page.getByRole("tab", { name: "Trouvable" }).click();
    await expect(
      page.locator(
        '[data-active-preview="trouvable"] [data-public-menu-renderer="trouvable"]'
      )
    ).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await page.getByRole("tab", { name: "Sauge Noire" }).click();
    await expect(
      page.locator('[data-active-preview="sauge-noire"] [data-sauge-comparison-pages="true"]')
    ).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${scenario.canonical.replaceAll("/", "\\/")}$`)
    );
    expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);
    expect(
      await page.locator("html").evaluate(
        (element) => element.scrollWidth - element.clientWidth <= 2
      )
    ).toBe(true);
  });
}
