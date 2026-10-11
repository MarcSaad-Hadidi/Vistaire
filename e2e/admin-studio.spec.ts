import { test, expect, type Page } from "@playwright/test";

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  });
async function preview(page: Page) {
  await page.goto("/admin");
  const origin = new URL(page.url()).origin;
  const response = await page
    .context()
    .request.post(`${origin}/admin/preview`, {
      headers: { Origin: origin },
      maxRedirects: 0,
    });
  expect(response.status()).toBe(303);
  await page.goto("/admin");
  await expect(page.locator("[data-admin-studio]")).toBeVisible();
}
async function expectSemanticSwitchTracks(page: Page) {
  for (const available of [true, false]) {
    const track = await page
      .locator(`[role="switch"][aria-checked="${available}"]`)
      .first()
      .evaluate((element, isAvailable) => {
        const style = getComputedStyle(element);
        const token = style.getPropertyValue(isAvailable ? "--available" : "--unavailable").trim();
        const channels = token.match(/^#(..)(..)(..)$/)?.slice(1).map((channel) => Number.parseInt(channel, 16));
        return {
          actual: getComputedStyle(element, "::before").backgroundColor,
          expected: channels ? `rgb(${channels.join(", ")})` : token,
        };
      }, available);
    expect(track.actual).toBe(track.expected);
  }
}
for (const width of [390, 430, 1440])
  test(`studio four destinations, theme, evidence and export cancellation at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const badResponses: string[] = [];
    const heavyRequests: string[] = [];
    page.on("request", (request) => {
      if (/\.(?:glb|usdz|mp4)(?:\?|$)/i.test(request.url()))
        heavyRequests.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 500)
        badResponses.push(
          `${response.status()} ${new URL(response.url()).pathname}`,
        );
    });
    await preview(page);
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link")).toHaveCount(4);
    for (const name of ["Vue d’ensemble", "Analyses", "Les plats", "Planning"])
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const analysisLink = nav.getByRole("link", {
      name: "Analyses",
      exact: true,
    });
    await analysisLink.focus();
    await analysisLink.press("Enter");
    await expect(analysisLink).toHaveAttribute("aria-current", "page");
    await nav
      .getByRole("link", { name: "Vue d’ensemble", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Vue d’ensemble",
    );
    await expect(
      page.locator('[data-studio-chart="trend"] svg').first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Passer au thème sombre" }).click();
    await expect(page.locator("[data-admin-studio]")).toHaveAttribute(
      "data-theme",
      "dark",
    );
    await page
      .getByRole("button", { name: "Consultations de plats", exact: false })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const ranking = page.locator('[data-studio-table="ranking"]');
    const rankingBox = await ranking.boundingBox();
    const nameBox = await ranking.locator("tbody tr").first().locator("td").first().boundingBox();
    expect(nameBox!.width).toBeGreaterThanOrEqual(rankingBox!.width * 0.48);
    await expect(ranking.getByText("vs période précédente")).toHaveCount(0);
    const heatmap = page.locator('[data-kind-ui="heatmap-grid"]');
    await expect(heatmap.getByRole("gridcell")).toHaveCount(168);
    const heatmapBox = await heatmap.boundingBox();
    const lastHour = await heatmap.getByRole("gridcell").last().boundingBox();
    expect(lastHour!.width).toBeGreaterThan(0);
    expect(lastHour!.x + lastHour!.width).toBeLessThanOrEqual(heatmapBox!.x + heatmapBox!.width + 1);
    expect(await heatmap.evaluate((table) => table.scrollWidth <= table.clientWidth + 1)).toBe(true);
    expect(await heatmap.locator("..").evaluate((wrapper) => wrapper.scrollWidth <= wrapper.clientWidth + 1)).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`vistaire-studio-overview-dark-${width}.png`),
      fullPage: true,
    });
    for (const name of ["Analyses", "Les plats", "Planning"]) {
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
      const exporter = page.getByRole("button", {
        name: "Exporter",
        exact: true,
      });
      await exporter.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(exporter).toBeFocused();
      await page.screenshot({
        path: testInfo.outputPath(
          `vistaire-studio-${name.replaceAll(" ", "-")}-dark-${width}.png`,
        ),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await nav.getByRole("link", { name: "Les plats", exact: true }).click();
    await expect(
      page.getByText("Accès en lecture seule.", { exact: false }),
    ).toBeVisible();
    for (const input of await page.getByRole("switch").all())
      await expect(input).toBeDisabled();
    await expectSemanticSwitchTracks(page);
    if (width < 650) {
      for (const name of ["Catégorie", "Disponibilité"]) {
        const control = page.getByRole("combobox", { name, exact: true });
        const box = await control.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(280);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await page
      .getByRole("searchbox", { name: "Rechercher un plat" })
      .fill("no-such-dish");
    await expect(page.getByText("Aucun plat trouvé")).toBeVisible();
    await page.getByRole("button", { name: "Effacer les filtres" }).click();
    const rows = page.locator("[data-admin-menu-dish]");
    await expect(rows).toHaveCount(12);
    const firstName = await rows
      .first()
      .getByRole("heading", { level: 3 })
      .innerText();
    await page
      .getByRole("searchbox", { name: "Rechercher un plat" })
      .fill(firstName);
    await expect(rows).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Rechercher un plat" }).fill("");
    const state = page.getByRole("combobox", {
      name: "Disponibilité",
      exact: true,
    });
    await state.selectOption("unavailable");
    await expect(rows).toHaveCount(2);
    await state.selectOption("available");
    await expect(rows).toHaveCount(10);
    await state.selectOption("all");
    await expect(rows).toHaveCount(12);
    await expect(
      page
        .getByRole("button", { name: "Déconnexion", exact: true })
        .filter({ visible: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Passer au thème clair" }).click();
    await expectSemanticSwitchTracks(page);
    await page.screenshot({
      path: testInfo.outputPath(`vistaire-studio-${width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(badResponses).toEqual([]);
    expect(heavyRequests).toEqual([]);
  });
test("studio downloads all four real formats without leaving the private page", async ({
  page,
}) => {
  await preview(page);
  for (const format of ["JSON", "CSV", "Excel", "PDF"]) {
    await page.getByRole("button", { name: "Exporter", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: new RegExp(format) }).check();
    const download = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: new RegExp(`Télécharger ${format}`) })
      .click();
    const file = await download;
    await file.saveAs(`/tmp/${file.suggestedFilename()}`);
    expect(await file.failure()).toBeNull();
    if (await dialog.count()) await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  }
});

const numeric = (text: string) => Number(text.replace(/[^\d.-]/g, ""));
test("studio exact chart evidence, keyboard inspection, legends and periods replace legacy contracts", async ({
  page,
}) => {
  await preview(page);
  const trend = page.locator('[data-studio-chart="trend"]').first();
  await trend.locator("summary").click();
  const total = async (column: number) =>
    (
      await trend.locator(`tbody td:nth-child(${column})`).allTextContents()
    ).reduce((sum, value) => sum + numeric(value), 0);
  const metric = page.getByRole("combobox", {
    name: "Indicateur du graphique",
  });
  for (const [key, current, previous] of [
    ["menuOpened", 1286, 1090],
    ["dishOpened", 3742, 3018],
    ["three", 206, 158],
    ["ar", 206, 157],
    ["immersive", 412, 315],
    ["searches", 562, 502],
  ] as const) {
    await metric.selectOption(key);
    await expect(trend.locator("tbody tr")).toHaveCount(7);
    await expect.poll(() => total(2)).toBe(current);
    await expect.poll(() => total(3)).toBe(previous);
  }
  await metric.selectOption("dishOpened");
  const legend = trend.locator('[data-legend-key="previous"]');
  await expect(legend).toHaveAttribute("aria-pressed", "true");
  await legend.focus();
  await legend.press("Enter");
  await expect(legend).toHaveAttribute("aria-pressed", "false");
  await legend.press("Space");
  await expect(legend).toHaveAttribute("aria-pressed", "true");
  const surface = trend.locator("svg.recharts-surface").first();
  await surface.focus();
  await surface.press("ArrowRight");
  const tooltip = trend.locator('[data-kind-ui="chart-tooltip"]');
  await expect(tooltip).toBeVisible();
  const bucket = await tooltip
    .locator('[data-kind-ui="chart-tooltip-label"]')
    .innerText();
  const day = new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(bucket));
  const row = trend
    .locator("tbody tr")
    .filter({ has: page.getByRole("cell", { name: day, exact: true }) });
  await expect(row).toHaveCount(1);
  const values = await tooltip
    .locator('[data-kind-ui="chart-tooltip-value"]')
    .allTextContents();
  expect(values.map(numeric)).toEqual([
    numeric(await row.locator("td").nth(1).innerText()),
    numeric(await row.locator("td").nth(2).innerText()),
  ]);
  await surface.press("Escape");
  await expect(tooltip).toBeHidden();
  await page
    .getByRole("combobox", { name: "Période des statistiques" })
    .selectOption("30d");
  await expect(page).toHaveURL(/range=30d/);
  await expect(
    page.getByRole("combobox", { name: "Période des statistiques" }),
  ).toHaveValue("30d");
  await expect(trend.locator("tbody tr")).toHaveCount(30);
  await expect.poll(() => total(2)).toBe(6760);
  await page.goto("/admin/insights?range=7d");
  const searches = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Recherches fréquentes",
        exact: true,
      }),
    });
  await expect(
    searches.getByText("menu végétarien", { exact: true }),
  ).toBeVisible();
  await expect(searches.getByText("37", { exact: true })).toBeVisible();
});

test("studio reduced motion retains chart geometry and touch exposes exact values without overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
    baseURL: test.info().project.use.baseURL,
  });
  const page = await context.newPage();
  try {
    await preview(page);
    const trend = page.locator('[data-studio-chart="trend"]').first();
    await expect(trend.locator("svg.recharts-surface")).toBeVisible();
    await page
      .getByRole("combobox", { name: "Indicateur du graphique" })
      .selectOption("menuOpened");
    await expect(trend.locator(".recharts-line-curve").first()).toBeVisible();
    const plot = trend.locator("svg.recharts-surface").first();
    const rect = await plot.boundingBox();
    expect(rect).not.toBeNull();
    await plot.tap({
      position: { x: rect!.width * 0.45, y: rect!.height * 0.45 },
    });
    const tooltip = trend.locator('[data-kind-ui="chart-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(
      tooltip.locator('[data-kind-ui="chart-tooltip-value"]').first(),
    ).toContainText(/\d/);
    const box = await tooltip.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
    await expect
      .poll(() =>
        trend.evaluate(
          (root) =>
            root
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
        ),
      )
      .toBe(0);
    await page.goto("/admin/insights");
    // Responsive chart surfaces mount after the route's server HTML arrives.
    // Await the same geometry contract rather than sampling before hydration.
    await expect
      .poll(() => page.locator("svg.recharts-surface").count())
      .toBeGreaterThanOrEqual(6);
    await expect
      .poll(() =>
        page.locator("svg.recharts-surface").evaluateAll((elements) =>
          elements.every((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && box.height > 0;
          }),
        ),
      )
      .toBe(true);
    const chartBoxes = await page
      .locator("svg.recharts-surface")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const r = element.getBoundingClientRect();
          return { width: r.width, height: r.height };
        }),
      );
    expect(chartBoxes.length).toBeGreaterThanOrEqual(6);
    expect(chartBoxes.every((box) => box.width > 0 && box.height > 0)).toBe(
      true,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
