import { expect, type Page, test } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;

type PageHealth = {
  consoleErrors: string[];
  networkIssues: string[];
  modelRequests: string[];
};

function installPageHealth(page: Page): PageHealth {
  const consoleErrors: string[] = [];
  const networkIssues: string[] = [];
  const modelRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => {
    if (MODEL_ASSET_RE.test(new URL(request.url()).pathname)) {
      modelRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    const target = new URL(response.url());
    if (!page.url().startsWith("http")) return;
    if (target.origin !== new URL(page.url()).origin) return;
    if (response.status() === 404 || response.status() >= 500) {
      networkIssues.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "request failed";
    if (failure === "net::ERR_ABORTED") return;
    const target = new URL(request.url());
    if (!page.url().startsWith("http")) return;
    if (target.origin === new URL(page.url()).origin) {
      networkIssues.push(`${failure} ${request.url()}`);
    }
  });

  return { consoleErrors, networkIssues, modelRequests };
}

async function expectHealthyPricingPage(page: Page, health: PageHealth) {
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(page.locator("footer")).toBeVisible();
  await expect.poll(() => health.consoleErrors).toEqual([]);
  expect(health.networkIssues, health.networkIssues.join("\n")).toEqual([]);
  expect(health.modelRequests, "3D assets must wait for explicit menu intent").toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function structuredDataTypes(page: Page) {
  return page.evaluate(() => {
    const types: string[] = [];
    const visit = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const record = value as Record<string, unknown>;
      const type = record["@type"];
      if (typeof type === "string") types.push(type);
      Object.values(record).forEach(visit);
    };
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      visit(JSON.parse(script.textContent || "null"));
    });
    return types;
  });
}

test.describe("Vistaire pricing collections", () => {
  test("publishes the same four-collection offer in French and English", async ({ page }) => {
    const health = installPageHealth(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const scenario of [
      {
        path: "/tarifs-menu-digital-restaurant",
        h1: "Choisissez l’expérience qui prendra place sur vos tables.",
        collectionNames: ["Acrylique", "Sculpté", "Carré", "Signature"],
        prices: ["2 000 $ CAD", "2 050 $ CAD", "2 100 $ CAD", "2 200 $ CAD"],
        monthly: "+ 200 $ CAD / mois",
        pilotage: "+ 100 $ CAD / mois",
        total: "Total — 300 $ / mois",
        pricingNav: "Tarifs",
        demoCta: "Réserver une démo"
      },
      {
        path: "/en/pricing-digital-restaurant-menu",
        h1: "Choose the experience that belongs on your tables.",
        collectionNames: ["Acrylic", "Sculpted", "Square", "Signature"],
        prices: ["$2,000 CAD", "$2,050 CAD", "$2,100 CAD", "$2,200 CAD"],
        monthly: "+ $200 CAD / month",
        pilotage: "+ $100 CAD / month",
        total: "Total — $300 / month",
        pricingNav: "Pricing",
        demoCta: "Book a demo"
      }
    ] as const) {
      const response = await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1, name: scenario.h1 })).toBeVisible();

      const collections = page.locator("[data-pricing-collection]");
      await expect(collections).toHaveCount(4);
      for (const [index, collection] of scenario.collectionNames.entries()) {
        await expect(collections.nth(index).getByRole("heading", { name: collection })).toBeVisible();
        await expect(collections.nth(index).getByText(scenario.prices[index], { exact: true })).toBeVisible();
        await expect(collections.nth(index).getByText(scenario.monthly, { exact: true })).toBeVisible();
      }

      const pilotage = page.locator("[data-pricing-pilotage]");
      await expect(pilotage.getByText(scenario.pilotage, { exact: true })).toBeVisible();
      await expect(pilotage.getByText(scenario.total, { exact: true })).toBeVisible();
      await expect(
        page.getByRole("navigation").first().getByRole("link", {
          name: scenario.pricingNav,
          exact: true
        })
      ).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("link", { name: scenario.demoCta, exact: true }).last()).toBeVisible();

      const publicText = await page.locator("body").innerText();
      expect(publicText).not.toContain("Vistaire Base");
      expect(publicText).not.toContain("Vistaire Premium");
      expect(publicText).not.toContain("125 $ CAD");
      expect(publicText).not.toContain("169 $ CAD");
      expect(publicText).not.toContain("249 $ CAD");
      expect(await structuredDataTypes(page)).toEqual(
        expect.arrayContaining(["WebPage", "Service", "OfferCatalog", "BreadcrumbList"])
      );
      expect(await structuredDataTypes(page)).not.toContain("FAQPage");
      await expectNoHorizontalOverflow(page);
    }

    await expectHealthyPricingPage(page, health);
  });

  test("keeps the required five responsive viewports free of page overflow", async ({ page }) => {
    const health = installPageHealth(page);

    for (const viewport of [
      { width: 390, height: 844, columns: 1 },
      { width: 430, height: 932, columns: 1 },
      { width: 768, height: 1024, columns: 2 },
      { width: 1280, height: 800, columns: 4 },
      { width: 1440, height: 900, columns: 4 }
    ]) {
      await page.setViewportSize(viewport);
      const response = await page.goto("/tarifs-menu-digital-restaurant", {
        waitUntil: "domcontentloaded"
      });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("[data-pricing-collection]")).toHaveCount(4);
      await expectNoHorizontalOverflow(page);

      const renderedColumns = await page.locator("[data-pricing-collection]").first().evaluate((card) => {
        const grid = card.parentElement;
        return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
      });
      expect(renderedColumns).toBe(viewport.columns);

      const imagesReady = await page.locator("[data-pricing-collection] img").evaluateAll((images) =>
        images.every((image) => {
          const element = image as HTMLImageElement;
          const bounds = element.getBoundingClientRect();
          return element.complete && element.naturalWidth > 0 && bounds.width > 0 && bounds.height > 0;
        })
      );
      expect(imagesReady).toBe(true);

      await page.locator("[data-pricing-pilotage]").scrollIntoViewIfNeeded();
      await expect(page.locator("[data-pricing-dashboard]")).toBeVisible();
      await expect(page.getByRole("link", { name: "Réserver une démo", exact: true }).last()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await expectHealthyPricingPage(page, health);
  });

  test("embeds the real interactive Pilotage dashboard at 30 days", async ({ page }) => {
    const health = installPageHealth(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto("/tarifs-menu-digital-restaurant", {
      waitUntil: "domcontentloaded"
    });
    expect(response?.status()).toBeLessThan(400);

    const dashboard = page.locator("[data-pricing-dashboard]");
    await dashboard.scrollIntoViewIfNeeded();
    await expect(dashboard.getByRole("button", { name: "30 jours", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const availabilityTab = dashboard.getByRole("tab", { name: "Disponibilités", exact: true });
    await availabilityTab.click();
    await expect(availabilityTab).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("link", { name: "Explorer l’aperçu restaurateur", exact: true })
    ).toHaveAttribute("href", "/apercu-restaurateur");
    await expectNoHorizontalOverflow(page);
    await expectHealthyPricingPage(page, health);
  });
});
