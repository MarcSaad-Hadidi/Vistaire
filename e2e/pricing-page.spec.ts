import { expect, type Page, test } from "@playwright/test";
import { getPublicModelAsset, PUBLIC_MODEL_ASSETS } from "../lib/publicModelAssets";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const DIGITAL_MODEL_URL = getPublicModelAsset("immersive.presentation.digital")!.publicUrl!;
const PHYSICAL_MODELS = PUBLIC_MODEL_ASSETS.filter((asset) => asset.id.startsWith("immersive.support."));

async function pricingSceneUrl(baseURL: string, path = "/tarifs-menu-digital-restaurant") {
  const url = new URL(path, baseURL);
  // The existing public bucket authorizes localhost for browser CORS.
  if (url.hostname === "127.0.0.1") url.hostname = "localhost";
  url.searchParams.set("sceneDiagnostics", "1");
  return url.href;
}

async function visitPricingChapter(page: Page, id: string) {
  await page.locator(`#pricing-${id}`).evaluate((section) => {
    const stage = section.firstElementChild as HTMLElement;
    scrollTo({ top: section.getBoundingClientRect().top + scrollY + Math.max(0, (section as HTMLElement).offsetHeight - stage.clientHeight) * 0.35, behavior: "instant" });
  });
  const canvas = page.locator(".scene-canvas");
  await expect(canvas).toHaveAttribute("data-support", id, { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-support-ready", "true");
}

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
    if (target.origin !== new URL(page.url()).origin && target.origin !== "https://3d.vistaire.ca") return;
    if (response.status() === 404 || response.status() >= 500) {
      networkIssues.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "request failed";
    if (failure === "net::ERR_ABORTED") return;
    const target = new URL(request.url());
    if (!page.url().startsWith("http")) return;
    if (target.origin === new URL(page.url()).origin || target.origin === "https://3d.vistaire.ca") {
      networkIssues.push(`${failure} ${request.url()}`);
    }
  });

  return { consoleErrors, networkIssues, modelRequests };
}

async function expectHealthyPricingPage(page: Page, health: PageHealth) {
  // The Studio preview has its own <footer>; the page footer is #contact.
  await page.locator("footer#contact").scrollIntoViewIfNeeded({ timeout: 30_000 });
  await expect(page.locator("footer#contact")).toBeVisible();
  await expect.poll(() => health.consoleErrors).toEqual([]);
  expect(health.networkIssues, health.networkIssues.join("\n")).toEqual([]);
  // The page plays in the shared 3D room (its GLBs); AR models still wait for intent.
  expect(health.modelRequests.filter((url) => /\.usdz(?:$|[?#])/i.test(url)), "AR assets must wait for explicit menu intent").toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

// This copy contract belongs to the authored pricing sections, not the shared
// navigation or footer (whose French rendez-vous label is correctly hyphenated).
async function visiblePricingDashText(page: Page) {
  return page.locator("main > section").evaluateAll((sections) => {
    if (!sections.length) throw new Error("Pricing copy sections are missing.");
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

    for (const section of sections) {
      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const parent = node.parentElement;
        if (text && /[-–—]/.test(text) && parent && !isVisuallyHidden(parent)) {
          matches.push(text);
        }
        node = walker.nextNode();
      }
    }
    return [...new Set(matches)];
  });
}

async function expectPrimaryNavigationFits(
  page: Page,
  labels: readonly string[]
) {
  await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
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
    .getByRole("link", { name: brandLabel, exact: true });
  const bodyLink = navigation.getByRole("link", {
    name: bodyLinkLabel,
    exact: true
  });
  const footerBrand = page.locator('footer#contact .footer-bottom span');

  await expect(brand).toBeVisible();
  await expect(bodyLink).toBeVisible();
  await expect(footerBrand).toHaveCount(1);
  const [headerFamily, bodyFamily, footerFamily] = await Promise.all([
    brand.evaluate((element) => getComputedStyle(element).fontFamily),
    bodyLink.evaluate((element) => getComputedStyle(element).fontFamily),
    footerBrand.evaluate((element) => getComputedStyle(element).fontFamily)
  ]);

  expect(headerFamily).toContain("Vistaire Editorial");
  expect(footerFamily).toContain("Vistaire Text");
  expect(bodyFamily).toContain("Vistaire Text");
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
  test("Digital renders the real book, keeps its framing and reuses it after physical chapters", async ({ page, baseURL }) => {
    test.setTimeout(420_000);
    const health = installPageHealth(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(await pricingSceneUrl(baseURL!), { waitUntil: "domcontentloaded" });
    const canvas = page.locator(".scene-canvas");
    await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 120_000 });
    await expect(canvas).toHaveAttribute("data-support", "digital");
    await expect(canvas).toHaveAttribute("data-support-ready", "true");
    expect(health.modelRequests.filter((url) => url === DIGITAL_MODEL_URL)).toHaveLength(1);
    expect(health.modelRequests.filter((url) => PHYSICAL_MODELS.some((asset) => url === asset.publicUrl || (asset.legacyUrl && url.endsWith(asset.legacyUrl))))).toEqual([]);

    for (const [width, height] of [[360, 800], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await visitPricingChapter(page, "digital");
      await expect.poll(() => canvas.evaluate((node) => {
        const bounds = JSON.parse((node as HTMLElement).dataset.supportBounds || "null");
        return Boolean(bounds && bounds.width >= Math.min(180, innerWidth * 0.5) && bounds.height >= 100 && bounds.x >= -2 && bounds.y >= -2 && bounds.x + bounds.width <= innerWidth + 2 && bounds.y + bounds.height <= innerHeight + 2);
      }), { message: `complete book in ${width}px viewport`, timeout: 20_000 }).toBe(true);
      await expectNoHorizontalOverflow(page);
    }
    for (const id of ["acrylique", "digital", "sculpte", "carre", "signature", "digital"]) await visitPricingChapter(page, id);
    expect(health.modelRequests.filter((url) => url === DIGITAL_MODEL_URL)).toHaveLength(1);
    await page.locator('[data-pricing-table-input]').fill("100");
    await expect(page.locator('[data-pricing-collection="digital"] [data-setup-amount]')).toHaveAttribute("data-setup-amount", "1500");
    await expectHealthyPricingPage(page, health);
  });

  test("a failed book request leaves a photograph and the complete pricing journey usable", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route(DIGITAL_MODEL_URL, (route) => route.fulfill({ status: 503, body: "controlled book failure", headers: { "access-control-allow-origin": "*" } }));
    await page.goto(await pricingSceneUrl(baseURL!), { waitUntil: "domcontentloaded" });
    const fallback = page.locator('#pricing-digital .presentation-fallback');
    await expect(fallback).toBeVisible({ timeout: 60_000 });
    await expect(fallback.locator('img')).toHaveAttribute('src', '/images/marketing/vistaire-digital-sauge-noire.webp');
    await expect(page.locator('.preloader')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await visitPricingChapter(page, "acrylique");
    const digital = page.locator('[data-pricing-collection="digital"]');
    await digital.scrollIntoViewIfNeeded();
    await expect(digital).toContainText("Aucun support physique inclus");
    await expect(digital.getByRole('link')).toHaveAttribute('href', '/prendre-rendez-vous');
    await expectNoHorizontalOverflow(page);
    expect(pageErrors).toEqual([]);
  });

  test("publishes the same five offers in French and English", async ({ page }) => {
    test.setTimeout(120_000);
    const health = installPageHealth(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const scenario of [
      {
        path: "/tarifs-menu-digital-restaurant",
        title: "Tarifs Vistaire | Supports QR et menu digital restaurant",
        description:
          "Découvrez Vistaire Digital dès 1 500 $ CAD et quatre collections de supports QR, avec menu digital à 200 $ CAD par mois et Pilotage en option.",
        canonical: "https://www.vistaire.ca/tarifs-menu-digital-restaurant",
        h1: "Choisissez l’expérience qui prendra place sur vos tables.",
        collectionNames: ["Digital", "Acrylique", "Sculpté", "Carré", "Signature"],
        prices: ["1 500 $ CAD", "2 000 $ CAD", "2 050 $ CAD", "2 100 $ CAD", "2 200 $ CAD"],
        monthly: "+ 200 $ CAD / mois",
        pilotage: "+ 100 $ CAD / mois",
        total: "Total 300 $ / mois",
        navLinks: ["Accueil", "Carte", "Tarifs", "À propos", "Contact"],
        pricingLabel: "Tarifs",
        pricingPath: "#pricing-title",
        brandLabel: "Vistaire - accueil",
        navCta: "Prendre rendez vous",
        appointmentCta: "Prendre rendez vous",
        appointmentPath: "/prendre-rendez-vous",
        digitalDisclosure: "Aucun support physique inclus",
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
          "Explore Vistaire Digital from $1,500 CAD and four QR display collections, with a digital menu at $200 CAD per month and optional Pilotage controls.",
        canonical: "https://www.vistaire.ca/en/pricing-digital-restaurant-menu",
        h1: "Choose the experience that belongs on your tables.",
        collectionNames: ["Digital", "Acrylic", "Sculpted", "Square", "Signature"],
        prices: ["$1,500 CAD", "$2,000 CAD", "$2,050 CAD", "$2,100 CAD", "$2,200 CAD"],
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
        digitalDisclosure: "No physical display included",
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
      await expect(page.locator('.preloader')).toHaveCount(0, { timeout: 30_000 });
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
        "https://www.vistaire.ca/images/marketing/pricing-acrylique-setting.webp"
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
      await expect(collections).toHaveCount(5);
      await expect(collections.first()).toContainText(scenario.digitalDisclosure);
      for (const [index, collection] of scenario.collectionNames.entries()) {
        await expect(collections.nth(index).getByRole("heading", { name: collection })).toBeVisible();
        await expect(collections.nth(index).getByText(scenario.prices[index], { exact: true })).toBeVisible();
        await expect(collections.nth(index).getByText(scenario.monthly, { exact: true })).toBeVisible();
      }

      const pilotage = page.locator("[data-pricing-pilotage]");
      await expect(pilotage.getByText(scenario.pilotage, { exact: true })).toBeVisible();
      await expect(pilotage.getByText(scenario.total, { exact: true })).toBeVisible();
      await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
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
      const dashText = await visiblePricingDashText(page);
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

  test("keeps all six required responsive viewports free of page overflow", async ({ page }) => {
    test.setTimeout(180_000);
    const health = installPageHealth(page);

    for (const viewport of [
      { width: 360, height: 800, columns: 1 },
      { width: 390, height: 844, columns: 1 },
      { width: 430, height: 932, columns: 1 },
      { width: 768, height: 1024, columns: 2 },
      { width: 1280, height: 800, columns: 3 },
      { width: 1440, height: 900, columns: 3 }
    ]) {
      await page.setViewportSize(viewport);
      const response = await page.goto("/tarifs-menu-digital-restaurant", {
        waitUntil: "domcontentloaded"
      });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator('.preloader')).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator("[data-pricing-collection]")).toHaveCount(5);
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
      await firstImage.scrollIntoViewIfNeeded();
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
            Boolean(frame && Math.abs(frame.width / frame.height - 4 / 3) <= 0.02) &&
            getComputedStyle(element).objectFit === (element.closest('[data-pricing-collection="digital"]') ? "contain" : "cover")
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

  test("embeds the real read only Pilotage dashboard without tiny focus targets", async ({
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
    await expect(dashboard.locator("[data-admin-studio]")).toHaveCount(1);
    await expect(dashboard.locator('[data-date-picker] button').first()).toHaveAttribute("aria-label", /Modifier la période d’analyse/);
    await expect(dashboard.locator("[data-studio-preview-banner]")).toContainText("données fictives");
    await expect(dashboard.locator("a, button, input, select, textarea").first()).not.toBeFocused();
    await expect(
      page.getByRole("link", { name: "Explorer l’aperçu restaurateur", exact: true })
    ).toHaveAttribute("href", "/apercu-restaurateur");
    await expectNoHorizontalOverflow(page);
    await expectHealthyPricingPage(page, health);
  });
});
