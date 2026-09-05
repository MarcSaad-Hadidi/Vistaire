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

async function visibleDashText(page: Page) {
  return page.evaluate(() => {
    const matches: string[] = [];
    const isVisuallyHidden = (element: Element) => {
      let current: Element | null = element;
      while (current && current !== document.body) {
        const style = getComputedStyle(current);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number.parseFloat(style.opacity || "1") === 0
        ) {
          return true;
        }
        const className = typeof current.className === "string" ? current.className : "";
        if (className.toLowerCase().includes("sronly")) return true;
        const rect = current.getBoundingClientRect();
        const isTinyClippedElement =
          rect.width <= 2 &&
          rect.height <= 2 &&
          (style.position === "absolute" || style.position === "fixed") &&
          (style.overflow === "hidden" ||
            style.clip !== "auto" ||
            style.clipPath !== "none");
        if (isTinyClippedElement) return true;
        current = current.parentElement;
      }
      return false;
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const parent = node.parentElement;
      if (text && /[-–—]/.test(text) && parent && !isVisuallyHidden(parent)) {
        matches.push(text);
      }
      node = walker.nextNode();
    }
    return [...new Set(matches)];
  });
}

async function expectPrimaryNavigationFits(
  page: Page,
  labels: readonly string[]
) {
  const navigation = page.getByRole("navigation").first();
  await expect(navigation).toBeVisible();
  const navigationBox = await navigation.boundingBox();
  expect(navigationBox).not.toBeNull();
  if (!navigationBox) return;

  const linkBoxes = [];
  for (const label of labels) {
    const link = navigation.getByRole("link", { name: label, exact: true });
    await expect(link).toHaveCount(1);
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box, `${label} should have rendered geometry`).not.toBeNull();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(navigationBox.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(navigationBox.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(
      navigationBox.x + navigationBox.width + 1
    );
    expect(box.y + box.height).toBeLessThanOrEqual(
      navigationBox.y + navigationBox.height + 1
    );
    linkBoxes.push({ box, label });
  }
  expect(linkBoxes).toHaveLength(labels.length);

  for (let index = 0; index < linkBoxes.length; index += 1) {
    for (let other = index + 1; other < linkBoxes.length; other += 1) {
      const first = linkBoxes[index];
      const second = linkBoxes[other];
      const horizontalOverlap = Math.min(
        first.box.x + first.box.width,
        second.box.x + second.box.width
      ) - Math.max(first.box.x, second.box.x);
      const verticalOverlap = Math.min(
        first.box.y + first.box.height,
        second.box.y + second.box.height
      ) - Math.max(first.box.y, second.box.y);
      expect(
        horizontalOverlap <= 1 || verticalOverlap <= 1,
        `${first.label} and ${second.label} must not overlap`
      ).toBe(true);
    }
  }

  const internalOverflow = await navigation.evaluate(
    (element) => element.scrollWidth - element.clientWidth
  );
  expect(internalOverflow).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);
}

async function expectVistaireChromeTypography(
  page: Page,
  brandLabel: string,
  bodyLinkLabel: string
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const navigation = page.getByRole("navigation").first();
  const brand = navigation
    .getByRole("link", { name: brandLabel, exact: true })
    .locator("span")
    .first();
  const bodyLink = navigation.getByRole("link", {
    name: bodyLinkLabel,
    exact: true
  });
  const footerBrand = page.locator('footer section[aria-label="Vistaire"] h2');

  await expect(brand).toBeVisible();
  await expect(bodyLink).toBeVisible();
  await expect(footerBrand).toHaveCount(1);
  const [headerFamily, bodyFamily, footerFamily] = await Promise.all([
    brand.evaluate((element) => getComputedStyle(element).fontFamily),
    bodyLink.evaluate((element) => getComputedStyle(element).fontFamily),
    footerBrand.evaluate((element) => getComputedStyle(element).fontFamily)
  ]);

  expect(headerFamily).toContain("BT Suave");
  expect(footerFamily).toContain("BT Suave");
  expect(bodyFamily).toContain("Neue Montreal");
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
        title: "Tarifs Vistaire | Supports QR et menu digital restaurant",
        description:
          "Découvrez les quatre collections de supports QR Vistaire dès 2 000 $ CAD, avec menu digital restaurant à 200 $ par mois et Pilotage en option.",
        canonical: "https://www.vistaire.ca/tarifs-menu-digital-restaurant",
        h1: "Choisissez l’expérience qui prendra place sur vos tables.",
        collectionNames: ["Acrylique", "Sculpté", "Carré", "Signature"],
        prices: ["2 000 $ CAD", "2 050 $ CAD", "2 100 $ CAD", "2 200 $ CAD"],
        monthly: "+ 200 $ CAD / mois",
        pilotage: "+ 100 $ CAD / mois",
        total: "Total 300 $ / mois",
        navLinks: ["Accueil", "Carte", "Tarifs", "À propos", "Contact"],
        pricingLabel: "Tarifs",
        pricingPath: "#pricing-title",
        brandLabel: "Vistaire - accueil",
        navCta: "Prendre rendez-vous",
        appointmentCta: "Prendre rendez vous",
        appointmentPath: "/prendre-rendez-vous",
        forbiddenPreviewVocabulary: /démo|démonstration/i,
        forbiddenPrices: [
          "950 $ CAD setup",
          "125 $ CAD / mois",
          "1 450 $ CAD setup",
          "169 $ CAD / mois",
          "2 500 $ CAD setup",
          "249 $ CAD / mois"
        ]
      },
      {
        path: "/en/pricing-digital-restaurant-menu",
        title: "Vistaire Pricing | QR Displays & Digital Restaurant Menu",
        description:
          "Explore four Vistaire QR display collections from $2,000 CAD, with a digital restaurant menu at $200 per month and optional Pilotage controls.",
        canonical: "https://www.vistaire.ca/en/pricing-digital-restaurant-menu",
        h1: "Choose the experience that belongs on your tables.",
        collectionNames: ["Acrylic", "Sculpted", "Square", "Signature"],
        prices: ["$2,000 CAD", "$2,050 CAD", "$2,100 CAD", "$2,200 CAD"],
        monthly: "+ $200 CAD / month",
        pilotage: "+ $100 CAD / month",
        total: "Total $300 / month",
        navLinks: ["Home", "Menu", "Pricing", "About", "Contact"],
        pricingLabel: "Pricing",
        pricingPath: "#pricing-title",
        brandLabel: "Vistaire - home",
        navCta: "Book a call",
        appointmentCta: "Book a call",
        appointmentPath: "/en/book-a-call",
        forbiddenPreviewVocabulary: /demo|demonstration/i,
        forbiddenPrices: [
          "$950 CAD",
          "$125 CAD / month",
          "$1,450 CAD",
          "$169 CAD / month",
          "$2,500 CAD",
          "$249 CAD / month"
        ]
      }
    ] as const) {
      const response = await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveTitle(scenario.title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        scenario.description
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        scenario.canonical
      );
      await expect(page.locator('link[rel="alternate"][hreflang="fr-CA"]')).toHaveAttribute(
        "href",
        "https://www.vistaire.ca/tarifs-menu-digital-restaurant"
      );
      await expect(page.locator('link[rel="alternate"][hreflang="en-CA"]')).toHaveAttribute(
        "href",
        "https://www.vistaire.ca/en/pricing-digital-restaurant-menu"
      );
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
        "href",
        "https://www.vistaire.ca/tarifs-menu-digital-restaurant"
      );
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        scenario.title
      );
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
        "content",
        scenario.description
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        scenario.canonical
      );
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        "https://www.vistaire.ca/images/pricing/vistaire-acrylique.jpg"
      );
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        "content",
        "summary_large_image"
      );
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
        "content",
        scenario.title
      );
      await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
        "content",
        scenario.description
      );
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
      const navigation = page.getByRole("navigation").first();
      for (const label of scenario.navLinks) {
        await expect(navigation.getByRole("link", { name: label, exact: true })).toBeVisible();
      }
      await expect(page.locator("#pricing-title")).toBeVisible();
      await expect(
        navigation.getByRole("link", {
          name: scenario.pricingLabel,
          exact: true
        })
      ).toHaveAttribute("href", scenario.pricingPath);
      await expect(
        navigation.getByRole("link", {
          name: scenario.pricingLabel,
          exact: true
        })
      ).toHaveAttribute("aria-current", "page");
      for (const label of scenario.navLinks.filter(
        (navLabel) => navLabel !== scenario.pricingLabel
      )) {
        await expect(
          navigation.getByRole("link", { name: label, exact: true })
        ).not.toHaveAttribute("aria-current");
      }
      await expectVistaireChromeTypography(
        page,
        scenario.brandLabel,
        scenario.pricingLabel
      );
      await expect(
        navigation.getByRole("link", { name: scenario.navCta, exact: true })
      ).toBeVisible();
      await expect(
        page
          .locator('section[aria-labelledby="pricing-final-title"]')
          .getByRole("link", { name: scenario.appointmentCta, exact: true })
      ).toHaveAttribute("href", scenario.appointmentPath);
      expect(await page.locator("body").innerText()).not.toMatch(
        scenario.forbiddenPreviewVocabulary
      );
      const dashText = await visibleDashText(page);
      expect(dashText, dashText.join("\n")).toEqual([]);

      const publicPayload = await page.evaluate(() =>
        [
          document.body.innerText,
          ...Array.from(document.querySelectorAll("meta[content]"), (meta) =>
            meta.getAttribute("content")
          ),
          ...Array.from(
            document.querySelectorAll('script[type="application/ld+json"]'),
            (script) => script.textContent
          )
        ].join("\n")
      );
      expect(publicPayload).not.toContain("Vistaire Base");
      expect(publicPayload).not.toContain("Vistaire Premium");
      for (const legacyPrice of scenario.forbiddenPrices) {
        expect(publicPayload).not.toContain(legacyPrice);
      }
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

      if (viewport.width === 390 || viewport.width === 430) {
        await expectPrimaryNavigationFits(page, [
          "Accueil",
          "Carte",
          "Tarifs",
          "À propos",
          "Contact"
        ]);
      }

      const renderedColumns = await page.locator("[data-pricing-collection]").first().evaluate((card) => {
        const grid = card.parentElement;
        return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
      });
      expect(renderedColumns).toBe(viewport.columns);

      const firstImage = page.locator("[data-pricing-collection] img").first();
      await expect
        .poll(() => firstImage.evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);

      const imageGeometryIsCorrect = await page
        .locator("[data-pricing-collection] img")
        .evaluateAll((images) =>
        images.every((image) => {
          const element = image as HTMLImageElement;
          const bounds = element.getBoundingClientRect();
          const frame = element.parentElement?.getBoundingClientRect();
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            Math.abs(bounds.width - bounds.height) <= 2 &&
            Boolean(frame && Math.abs(frame.width - frame.height) <= 2) &&
            getComputedStyle(element).objectFit === "cover"
          );
        })
      );
      expect(imageGeometryIsCorrect).toBe(true);

      await page.locator("[data-pricing-pilotage]").scrollIntoViewIfNeeded();
      await expect(page.locator("[data-pricing-dashboard]")).toBeVisible();
      await expect(
        page
          .locator('section[aria-labelledby="pricing-final-title"]')
          .getByRole("link", { name: "Prendre rendez vous", exact: true })
      ).toHaveAttribute("href", "/prendre-rendez-vous");
      await expectNoHorizontalOverflow(page);
    }

    await expectHealthyPricingPage(page, health);
  });

  test("contains the included copy in one translucent glass panel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto("/tarifs-menu-digital-restaurant", {
      waitUntil: "domcontentloaded"
    });
    expect(response?.status()).toBeLessThan(400);

    const panel = page.locator("[data-pricing-included-panel]");
    await expect(panel).toHaveCount(1);
    await expect(panel.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(panel.getByRole("heading", { level: 3 })).toHaveCount(3);

    const treatment = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      const background = style.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
      return {
        backdropFilter:
          style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
        backgroundAlpha: background.length === 4 ? background[3] : 1,
        borderStyle: style.borderTopStyle,
        borderRadius: Number.parseFloat(style.borderTopLeftRadius)
      };
    });

    expect(treatment.borderStyle).toBe("solid");
    expect(treatment.borderRadius).toBeGreaterThan(0);
    expect(treatment.backgroundAlpha).toBeGreaterThan(0);
    expect(treatment.backgroundAlpha).toBeLessThan(1);
    expect(treatment.backdropFilter).toContain("blur(");
    await expectNoHorizontalOverflow(page);
  });

  test("embeds the real Pilotage dashboard preview at 30 days without tiny focus targets", async ({
    page
  }) => {
    const health = installPageHealth(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto("/tarifs-menu-digital-restaurant", {
      waitUntil: "domcontentloaded"
    });
    expect(response?.status()).toBeLessThan(400);

    const dashboard = page.locator("[data-pricing-dashboard]");
    await dashboard.scrollIntoViewIfNeeded();
    await expect(dashboard).toHaveAttribute("aria-hidden", "true");
    await expect(dashboard).toHaveAttribute("inert", "");
    await expect(dashboard.locator('button[data-demo-period="30d"]')).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(dashboard.locator("a, button, input, select, textarea").first()).not.toBeFocused();
    await expect(
      page.getByRole("link", { name: "Explorer l’aperçu restaurateur", exact: true })
    ).toHaveAttribute("href", "/apercu-restaurateur");
    await expectNoHorizontalOverflow(page);
    await expectHealthyPricingPage(page, health);
  });
});
