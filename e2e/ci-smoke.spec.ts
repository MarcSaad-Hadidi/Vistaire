import { expect, test, type Page } from "@playwright/test";

async function expectHealthy(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response?.status(), `${path} should not fail`).toBeLessThan(400);
  // Public pages are held behind the 3D room's loading screen until it is ready.
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 60_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    )
    .toBe(true);
}

test("CI smoke loads the public landing at Vistaire mobile widths", { tag: '@critical' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expectHealthy(page, "/");
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("link", { name: "Prendre rendez-vous" }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("CI smoke loads the restaurant discovery without early 3D requests", { tag: '@critical' }, async ({ page }) => {
  const modelRequests: string[] = [];
  page.on("request", (request) => {
    // The page's own 3D room is expected; no restaurant menu model may load early.
    const { pathname } = new URL(request.url());
    if (/\.(?:glb|usdz)$/i.test(pathname) && !pathname.startsWith("/immersive-assets/")) modelRequests.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectHealthy(page, "/demo");
  for (const [name, slug] of [["Maison Élyse", "maison-elyse"], ["Trouvable", "trouvable"], ["Sauge Noire", "sauge-noire"]]) {
    // The cinematic chapters carry the same restaurant names as headings.
    await expect(page.getByLabel("Expériences Vistaire").getByRole("heading", { level: 2, name, exact: true })).toBeAttached();
    await expect(page.getByRole("link", { name: `Explorer ${name}`, exact: true })).toHaveAttribute("href", `/menu/${slug}?lang=fr-CA`);
  }
  await expect(page.getByTestId("demo-phone-viewport")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(modelRequests).toEqual([]);
});

test("CI smoke keeps admin gated and metadata routes healthy", { tag: '@critical' }, async ({ page }) => {
  await expectHealthy(page, "/admin");
  await expect(page.getByText(/Accès dashboard restaurant requis/i)).toBeVisible();
  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    await expectHealthy(page, path);
  }
});

const pricingScenarios = [
  {
    path: "/tarifs-menu-digital-restaurant",
    question: "Nombre de tables à équiper ?",
    decrement: "Réduire le nombre de tables",
    increment: "Augmenter le nombre de tables",
    initialPrices: ["2 000 $ CAD", "2 050 $ CAD", "2 100 $ CAD", "2 200 $ CAD"],
    pricesAt21: ["2 040 $ CAD", "2 095 $ CAD", "2 155 $ CAD", "2 255 $ CAD"],
    pricesAt37: ["2 680 $ CAD", "2 815 $ CAD", "3 035 $ CAD", "3 135 $ CAD"],
    amountsAt37: [2680, 2815, 3035, 3135],
    monthly: "+ 200 $ CAD / mois",
    pilotage: "+ 100 $ CAD / mois",
    pilotageTotal: "Total 300 $ / mois",
    summaryAt37: "20 supports inclus · 17 supports supplémentaires",
    disclaimer:
      "Estimation indicative. Le prix final sera confirmé dans votre devis après analyse de votre établissement et de vos besoins."
  },
  {
    path: "/en/pricing-digital-restaurant-menu",
    question: "How many tables would you like to equip?",
    decrement: "Decrease the number of tables",
    increment: "Increase the number of tables",
    initialPrices: ["$2,000 CAD", "$2,050 CAD", "$2,100 CAD", "$2,200 CAD"],
    pricesAt21: ["$2,040 CAD", "$2,095 CAD", "$2,155 CAD", "$2,255 CAD"],
    pricesAt37: ["$2,680 CAD", "$2,815 CAD", "$3,035 CAD", "$3,135 CAD"],
    amountsAt37: [2680, 2815, 3035, 3135],
    monthly: "+ $200 CAD / month",
    pilotage: "+ $100 CAD / month",
    pilotageTotal: "Total $300 / month",
    summaryAt37: "20 displays included · 17 additional displays",
    disclaimer:
      "Indicative estimate. Final pricing will be confirmed in your quote after reviewing your venue and project requirements."
  }
] as const;

for (const scenario of pricingScenarios) {
test(`CI smoke validates ${scenario.path} Pricing table estimator`, { tag: '@critical' }, async ({ page }) => {
  // Smoke checks stay mobile-first; full runs retain the desktop resize matrix.
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  const networkIssues: string[] = [];
  const modelRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    // The page's own 3D room is expected; restaurant menu models are not.
    if (/\.(?:glb|usdz)$/i.test(pathname) && !pathname.startsWith("/immersive-assets/")) {
      modelRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (response.status() === 404 || response.status() >= 500) {
      const target = new URL(response.url());
      if (page.url().startsWith("http") && target.origin === new URL(page.url()).origin) {
        networkIssues.push(`${response.status()} ${response.url()}`);
      }
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "request failed";
    if (failure === "net::ERR_ABORTED" ||
        request.resourceType() === 'media' && failure.startsWith('Load request cancelled') ||
        !page.url().startsWith("http")) return;
    const target = new URL(request.url());
    if (target.origin === new URL(page.url()).origin) {
      networkIssues.push(`${failure} ${request.url()}`);
    }
  });



  await page.setViewportSize({ width: 390, height: 844 });

    await expectHealthy(page, scenario.path);

    const estimator = page.locator("[data-pricing-table-estimator]");
    const input = estimator.getByRole("spinbutton", { name: scenario.question });
    const decrement = estimator.getByRole("button", { name: scenario.decrement });
    const increment = estimator.getByRole("button", { name: scenario.increment });
    const collections = page.locator("[data-pricing-collection]");

    await expect(estimator).toBeVisible();
    await expect(input).toHaveValue("20");
    await expect(decrement).toBeEnabled();
    await expect(increment).toBeEnabled();
    await expect(collections).toHaveCount(4);

    const prices = collections.locator("[data-pricing-estimated-setup]");
    await expect(prices).toHaveText([...scenario.initialPrices]);
    await expect(collections.getByText(scenario.monthly, { exact: true })).toHaveCount(4);

    await increment.click();
    await expect(input).toHaveValue("21");
    await expect(prices).toHaveText([...scenario.pricesAt21]);

    await decrement.click();
    await expect(input).toHaveValue("20");
    await expect(prices).toHaveText([...scenario.initialPrices]);

    await input.fill("37");
    await expect(input).toHaveValue("37");
    await expect(estimator.getByText(scenario.summaryAt37, { exact: true })).toBeVisible();
    await expect(prices).toHaveText([...scenario.pricesAt37]);
    for (const [index, amount] of scenario.amountsAt37.entries()) {
      await expect(prices.nth(index)).toHaveAttribute("data-setup-amount", String(amount));
    }

    await expect(page.locator("[data-pricing-pilotage]").getByText(scenario.pilotage, { exact: true })).toBeVisible();
    await expect(
      page.locator("[data-pricing-pilotage]").getByText(scenario.pilotageTotal, { exact: true })
    ).toBeVisible();
    await expect(estimator.getByText(scenario.disclaimer, { exact: true })).toBeVisible();

    const publicCopy = await page.locator("body").innerText();
    expect(publicCopy).not.toContain("Votre prix final");
    expect(publicCopy).not.toContain("Total à payer");
    expect(publicCopy).not.toContain("Montant dû");
    expect(publicCopy).not.toContain("Your final price");
    expect(publicCopy).not.toContain("Total due");
    expect(publicCopy).not.toContain("Amount due");

    await input.fill("1");
    await expect(input).toHaveValue("1");
    await expect(decrement).toBeDisabled();
    await input.fill("");
    await input.blur();
    await expect(input).toHaveValue("1");

    await input.fill("20");
    await increment.focus();
    await increment.press("Enter");
    await expect(input).toHaveValue("21");
    await decrement.focus();
    await decrement.press("Enter");
    await expect(input).toHaveValue("20");

    await expectNoHorizontalOverflow(page);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 }
  ]) {
    if (process.env.VISTAIRE_CI_CRITICAL_ONLY === "true" && viewport.width > 430) continue;
    await page.setViewportSize(viewport);
    await test.step(`Responsive pricing at ${viewport.width}px`, async () => {
      await expect(estimator).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (viewport.width <= 430) {
        for (const button of [decrement, increment]) {
          const box = await button.boundingBox();
          expect(box).not.toBeNull();
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }

  await expect.poll(() => consoleErrors).toEqual([]);
  expect(networkIssues, networkIssues.join("\n")).toEqual([]);
  expect(modelRequests, "Pricing must not trigger heavy 3D assets").toEqual([]);
});
}
