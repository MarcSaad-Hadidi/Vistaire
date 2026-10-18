import { test, expect, type Page } from "@playwright/test";

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  });
async function preview(page: Page) {
  const baseURL = test.info().project.use.baseURL;
  expect(
    baseURL,
    "The local Studio preview needs a configured baseURL",
  ).toBeTruthy();
  const origin = new URL(baseURL!).origin;
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
    // The BeUI switch track animates for 150ms when theme tokens change.
    // Retry the actual pseudo-element color instead of sampling its old frame.
    await expect
      .poll(
        async () => {
          const track = await page
            .locator(`[role="switch"][aria-checked="${available}"]`)
            .first()
            .evaluate((element, isAvailable) => {
              const style = getComputedStyle(element);
              const token = style
                .getPropertyValue(isAvailable ? "--available" : "--unavailable")
                .trim();
              const channels = token
                .match(/^#(..)(..)(..)$/)
                ?.slice(1)
                .map((channel) => Number.parseInt(channel, 16));
              return {
                actual: getComputedStyle(element, "::before").backgroundColor,
                expected: channels ? `rgb(${channels.join(", ")})` : token,
              };
            }, available);
          return track.actual === track.expected;
        },
        {
          message: `The ${available ? "available" : "unavailable"} track settles on its theme token`,
        },
      )
      .toBe(true);
  }
}
function watchPrivatePage(page: Page) {
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
  return () => {
    expect(errors).toEqual([]);
    expect(badResponses).toEqual([]);
    expect(heavyRequests).toEqual([]);
  };
}
for (const width of [390, 430, 1440]) {
  test(
    `studio four destinations, overview theme and chart evidence at ${width}px`,
    { tag: width === 390 ? "@critical" : [] },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const expectHealthyPage = watchPrivatePage(page);
      await preview(page);
      const nav = page.getByRole("navigation", {
        name: "Navigation principale",
      });
      await expect(nav.getByRole("link")).toHaveCount(4);
      for (const name of [
        "Vue d’ensemble",
        "Analyses",
        "Les plats",
        "Planning",
      ])
        await expect(
          nav.getByRole("link", { name, exact: true }),
        ).toBeVisible();
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
      await page.waitForURL(/\/admin\/insights(?:\?|$)/);
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
      await page
        .getByRole("button", { name: "Passer au thème sombre" })
        .click();
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
      const nameBox = await ranking
        .locator("tbody tr")
        .first()
        .locator("td")
        .first()
        .boundingBox();
      expect(nameBox!.width).toBeGreaterThanOrEqual(rankingBox!.width * 0.48);
      await expect(ranking.getByText("vs période précédente")).toHaveCount(0);
      const heatmap = page.locator('[data-kind-ui="heatmap-grid"]');
      await expect(heatmap.getByRole("gridcell")).toHaveCount(84);
      const heatmapBox = await heatmap.boundingBox();
      const lastHour = await heatmap.getByRole("gridcell").last().boundingBox();
      expect(lastHour!.width).toBeGreaterThan(0);
      expect(lastHour!.x + lastHour!.width).toBeLessThanOrEqual(
        heatmapBox!.x + heatmapBox!.width + 1,
      );
      expect(
        await heatmap.evaluate(
          (table) => table.scrollWidth <= table.clientWidth + 1,
        ),
      ).toBe(true);
      expect(
        await heatmap
          .locator("..")
          .evaluate(
            (wrapper) => wrapper.scrollWidth <= wrapper.clientWidth + 1,
          ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`vistaire-studio-overview-dark-${width}.png`),
        fullPage: true,
      });
      expectHealthyPage();
    },
  );
  test(`studio remaining destinations retain theme, exports and screenshots at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const expectHealthyPage = watchPrivatePage(page);
    await preview(page);
    await page.getByRole("button", { name: "Passer au thème sombre" }).click();
    await expect(page.locator("[data-admin-studio]")).toHaveAttribute(
      "data-theme",
      "dark",
    );
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    for (const name of ["Analyses", "Les plats", "Planning"]) {
      const destination = nav.getByRole("link", { name, exact: true });
      await destination.click();
      await expect(destination).toHaveAttribute("aria-current", "page", {
        timeout: 15_000,
      });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        name === "Analyses" ? "Analyses visuelles" : name,
      );
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
    expectHealthyPage();
  });
  test(
    `studio dish filters, semantic states and read-only controls at ${width}px`,
    { tag: width === 430 ? "@critical" : [] },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const expectHealthyPage = watchPrivatePage(page);
      await preview(page);
      await page
        .getByRole("button", { name: "Passer au thème sombre" })
        .click();
      await expect(page.locator("[data-admin-studio]")).toHaveAttribute(
        "data-theme",
        "dark",
      );
      const nav = page.getByRole("navigation", {
        name: "Navigation principale",
      });
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
      await page
        .getByRole("searchbox", { name: "Rechercher un plat" })
        .fill("");
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
      await expect(page.locator("[data-admin-studio]")).toHaveAttribute(
        "data-theme",
        "light",
      );
      await expectSemanticSwitchTracks(page);
      await page.screenshot({
        path: testInfo.outputPath(`vistaire-studio-${width}.png`),
        fullPage: true,
      });
      expectHealthyPage();
    },
  );
}
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
    await metric.click();
    await page
      .getByRole("option", {
        name: {
          menuOpened: "Ouvertures du menu",
          dishOpened: "Consultations de plats",
          three: "Clics 3D",
          ar: "Clics AR",
          immersive: "Clics 3D et AR",
          searches: "Recherches",
        }[key],
        exact: true,
      })
      .click();
    await expect(trend.locator("tbody tr")).toHaveCount(7);
    await expect.poll(() => total(2)).toBe(current);
    await expect.poll(() => total(3)).toBe(previous);
  }
  await metric.click();
  await page
    .getByRole("option", { name: "Consultations de plats", exact: true })
    .click();
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
  const bucket = await tooltip.getAttribute("data-studio-tooltip-date");
  const day = new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(bucket!));
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
    .getByRole("button", { name: /Modifier la période d’analyse/ })
    .click();
  await page.getByRole("button", { name: "30 jours", exact: true }).click();
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await expect(page).toHaveURL(/range=30d/);
  await expect(trend.locator("tbody tr")).toHaveCount(30);
  await expect.poll(() => total(2)).toBe(6760);
  await page.goto("/admin/insights?range=7d");
  const searches = page.locator("section").filter({
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
      .click();
    await page
      .getByRole("option", { name: "Ouvertures du menu", exact: true })
      .click();
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

test("studio approved controls keep keyboard filtering and persisted theme across navigation", async ({
  page,
}) => {
  await preview(page);
  await expect(
    page.locator('[data-component="beui-theme-toggle"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Passer au thème sombre" }).click();
  await expect(page.locator("[data-admin-studio]")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Les plats", exact: true })
    .click();
  await expect(page.locator("[data-admin-studio]")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  const category = page.getByRole("combobox", {
    name: "Catégorie",
    exact: true,
  });
  await category.fill("aucune catégorie correspondante");
  await expect(
    page.getByRole("listbox", { name: "Catégorie", exact: true }),
  ).toContainText("Aucun résultat");
  await category.press("Escape");
  await expect(
    page.getByRole("listbox", { name: "Catégorie", exact: true }),
  ).toHaveCount(0);
  await expect(category).toBeFocused();
  await category.fill("");
  await category.press("ArrowDown");
  await category.press("Enter");
  await expect(page.locator("[data-admin-menu-dish]").first()).toBeVisible();
});

test("studio restored date picker cancels drafts and analysis controls work from the keyboard", async ({
  page,
}) => {
  await preview(page);
  const before = page.url();
  await page
    .getByRole("button", { name: /Modifier la période d’analyse/ })
    .click();
  await page.getByRole("button", { name: "30 jours", exact: true }).click();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  expect(page.url()).toBe(before);
  await page
    .getByRole("button", { name: /Modifier la période d’analyse/ })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /Modifier la période d’analyse/ }),
  ).toBeFocused();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Analyses", exact: true })
    .click();
  const data = page.getByRole("button", { name: "Vue tableau", exact: true });
  await data.focus();
  await data.press("Enter");
  await expect(
    page.getByRole("button", { name: "Vue graphique", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-dataset="dishes"]')).toBeVisible();
});

test("studio command search restores focus and navigates by keyboard", async ({
  page,
}) => {
  await preview(page);
  const trigger = page.getByRole("button", { name: "Rechercher", exact: true });
  await trigger.click();
  const input = page.getByRole("combobox", {
    name: "Rechercher une vue ou un plat",
  });
  await expect(input).toBeFocused();
  await input.fill("Analyses");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/admin\/insights/);
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.press("Control+k");
  await expect(input).toBeFocused();
  await input.fill("aucun resultat inexistant");
  await expect(page.getByText("Aucun résultat", { exact: true })).toBeVisible();
  await input.press("Escape");
});

for (const width of [390, 1440]) {
  test(
    `studio dialogs stay centered after page scroll at ${width}px`,
    { tag: "@critical" },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await preview(page);
      let dialogIndex = 0;
      const assertCentered = async () => {
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await page.evaluate(() =>
          scrollTo(0, document.documentElement.scrollHeight),
        );
        await expect
          .poll(async () =>
            dialog.evaluate((element) => {
              const box = element.getBoundingClientRect();
              return Math.max(
                Math.abs(
                  box.x +
                    box.width / 2 -
                    document.documentElement.clientWidth / 2,
                ),
                Math.abs(box.y + box.height / 2 - innerHeight / 2),
              );
            }),
          )
          .toBeLessThanOrEqual(2);
        const box = await dialog.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(8);
        expect(box!.y).toBeGreaterThanOrEqual(8);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - 8);
        expect(box!.y + box!.height).toBeLessThanOrEqual(892);
        await page.screenshot({
          path: testInfo.outputPath(
            `studio-centered-${width}-${++dialogIndex}.png`,
          ),
        });
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      };
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      await page
        .getByRole("button", { name: "Agrandir le graphique d’évolution" })
        .first()
        .click();
      await assertCentered();
      await page
        .getByRole("button", { name: "Consultations de plats", exact: false })
        .first()
        .click();
      await assertCentered();
      await page.getByRole("button", { name: "Exporter", exact: true }).click();
      await assertCentered();
      await page
        .getByRole("button", { name: "Rechercher", exact: true })
        .click();
      await assertCentered();
      await page.screenshot({
        path: testInfo.outputPath(`studio-centered-${width}.png`),
        fullPage: true,
      });
    },
  );
}

test(
  "studio chart marks retain approved colors in both themes",
  { tag: "@critical" },
  async ({ page }, testInfo) => {
    await preview(page);
    await page.goto("/admin/insights?range=7d");
    for (const theme of ["light", "dark"] as const) {
      if (theme === "dark")
        await page
          .getByRole("button", { name: "Passer au thème sombre" })
          .click();
      await expect(page.locator("[data-admin-studio]")).toHaveAttribute(
        "data-theme",
        theme,
      );
      const pie = page.locator('[data-studio-chart="composition"]');
      await expect
        .poll(async () =>
          pie
            .locator('[data-kind-ui="pie-sector"]')
            .evaluateAll(
              (marks) =>
                new Set(marks.map((mark) => getComputedStyle(mark).fill)).size,
            ),
        )
        .toBeGreaterThan(1);
      await expect
        .poll(() =>
          pie.evaluate((root) => {
            const style = getComputedStyle(root);
            const expected = Array.from({ length: 6 }, (_, index) => {
              const hex = style
                .getPropertyValue(`--chart-category-${index}`)
                .trim();
              const channels = hex
                .match(/^#(..)(..)(..)$/)
                ?.slice(1)
                .map((value) => parseInt(value, 16));
              return channels ? `rgb(${channels.join(", ")})` : hex;
            });
            return [
              ...root.querySelectorAll('[data-kind-ui="pie-sector"]'),
            ].every((mark) => expected.includes(getComputedStyle(mark).fill));
          }),
        )
        .toBe(true);
      const cells = page.locator(
        '[data-kind-ui="heatmap-grid"] [role="gridcell"]',
      );
      await expect(cells).toHaveCount(84);
      const expectedZero =
        theme === "dark" ? "rgb(23, 32, 50)" : "rgb(232, 247, 255)";
      await expect
        .poll(async () =>
          cells.evaluateAll((marks) =>
            marks.map((mark) => getComputedStyle(mark).backgroundColor),
          ),
        )
        .toContain(expectedZero);
      await expect
        .poll(async () => {
          const ticks = await page
            .locator(
              '[data-studio-chart="profile"] .recharts-polar-radius-axis-tick',
            )
            .allTextContents();
          return (
            ticks.filter(Boolean).length > 0 &&
            ticks.filter(Boolean).every((tick) => tick.endsWith(" %"))
          );
        })
        .toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`studio-chart-colors-${theme}.png`),
        fullPage: true,
      });
    }
  },
);

test(
  "studio source table workspace exposes five truthful datasets and real export",
  { tag: "@critical" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preview(page);
    await page.goto("/admin/insights?range=30d");
    await page
      .getByRole("button", { name: "Vue tableau", exact: true })
      .click();
    await expect(page.locator('[data-component="number-flow"]')).toHaveCount(0);
    const datasets = page.getByRole("group", {
      name: "Jeu de données",
      exact: true,
    });
    await expect(datasets.getByRole("button")).toHaveCount(5);
    for (const [label, id] of [
      ["Plats", "dishes"],
      ["Par jour", "daily"],
      ["Horaires", "hours"],
      ["Catégories", "categories"],
      ["Comparaison", "comparison"],
    ]) {
      await datasets.getByRole("button", { name: label, exact: true }).click();
      await expect(page.locator(`[data-dataset="${id}"]`)).toBeVisible();
      await expect(page.getByRole("table")).toHaveCount(1);
    }
    await datasets
      .getByRole("button", { name: "Par jour", exact: true })
      .click();
    await expect(page.getByText("Page 1 sur 2", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Page suivante", exact: true })
      .click();
    await expect(page.getByText("Page 2 sur 2", { exact: true })).toBeVisible();
    await page
      .getByRole("searchbox", { name: "Rechercher dans Par jour", exact: true })
      .fill("aucune-ligne-correspondante");
    await expect(
      page
        .getByText("Aucun résultat", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Effacer la recherche", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Exporter toutes les données de la période sélectionnée",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
  },
);

test(
  "metric explorer keeps nested expansion and dish handoff accessible",
  { tag: "@critical" },
  async ({ page }) => {
    await preview(page);
    const trigger = page
      .getByRole("button", { name: "Consultations de plats", exact: false })
      .first();
    await trigger.click();
    const explorer = page.getByRole("dialog", {
      name: "Explorer la période",
      exact: true,
    });
    await expect(
      explorer.locator("[data-studio-metric-explorer]"),
    ).toHaveAttribute("data-studio-metric-explorer", "dishOpened");
    const expand = explorer.getByRole("button", {
      name: "Agrandir le graphique d’évolution",
    });
    await expand.click();
    await expect(page.locator("dialog[open]")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expect(expand).toBeFocused();
    await explorer
      .getByRole("group", { name: "Mesure à explorer" })
      .getByRole("button", { name: "3D", exact: true })
      .click();
    await expect(
      explorer.locator("[data-studio-metric-explorer]"),
    ).toHaveAttribute("data-studio-metric-explorer", "three");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  },
);
