import { expect, test, type Page } from "@playwright/test";
import { jsonLdPayloads, readAttributes } from "./support/staticPublicRenderingContract";

const seoPages = [
  "/menu-digital-restaurant",
  "/menu-qr-code-restaurant",
  "/menu-3d-ar-restaurant",
  "/menu-pdf-vs-menu-digital"
];

const englishSeoPages = [
  "/en/digital-restaurant-menu",
  "/en/qr-code-restaurant-menu",
  "/en/3d-ar-restaurant-menu",
  "/en/pdf-vs-digital-menu"
];

const seoGeoPages = [
  "/menu-qr-sans-pdf",
  "/menu-digital-sans-application",
  "/remplacer-menu-pdf-restaurant",
  "/alternative-menu-pdf-restaurant",
  "/fiche-plat-digitale-restaurant",
  "/menu-restaurant-photos",
  "/menu-restaurant-allergenes",
  "/menu-digital-restaurant-montreal",
  "/menu-digital-restaurant-laval",
  "/menu-digital-restaurant-brossard",
  "/menu-digital-restaurant-haut-de-gamme",
  "/menu-digital-restaurant-gastronomique"
];

const englishSeoGeoPages = [
  "/en/qr-menu-without-pdf",
  "/en/digital-menu-without-app",
  "/en/replace-restaurant-pdf-menu",
  "/en/restaurant-pdf-menu-alternative",
  "/en/digital-dish-page-restaurant",
  "/en/restaurant-menu-photos",
  "/en/restaurant-menu-allergens",
  "/en/digital-restaurant-menu-montreal",
  "/en/digital-restaurant-menu-laval",
  "/en/digital-restaurant-menu-brossard",
  "/en/high-end-restaurant-digital-menu",
  "/en/fine-dining-restaurant-digital-menu"
];

const publicProductPages = [
  "/a-propos",
  "/contact",
  "/prendre-rendez-vous",
  "/apercu-restaurateur"
];

const englishProductPages = [
  "/en/about",
  "/en/contact",
  "/en/book-a-call",
  "/en/restaurant-preview"
];

const editorialGuidePages = [
  "/guides/anatomie-menu-digital-premium",
  "/guides/menu-qr-mobile-sans-application",
  "/guides/3d-restaurant-utile-vs-gadget"
];

const englishEditorialGuidePages = [
  "/en/guides/premium-digital-menu-anatomy",
  "/en/guides/mobile-qr-menu-without-app",
  "/en/guides/restaurant-3d-useful-vs-gimmick"
];

const seoGeoSmokeRoutes = [
  {
    path: "/menu-qr-sans-pdf",
    fr: "/menu-qr-sans-pdf",
    en: "/en/qr-menu-without-pdf",
    ctaHref: "/prendre-rendez-vous"
  },
  {
    path: "/remplacer-menu-pdf-restaurant",
    fr: "/remplacer-menu-pdf-restaurant",
    en: "/en/replace-restaurant-pdf-menu",
    ctaHref: "/prendre-rendez-vous"
  },
  {
    path: "/menu-digital-restaurant-montreal",
    fr: "/menu-digital-restaurant-montreal",
    en: "/en/digital-restaurant-menu-montreal",
    ctaHref: "/prendre-rendez-vous"
  },
  {
    path: "/menu-digital-restaurant-haut-de-gamme",
    fr: "/menu-digital-restaurant-haut-de-gamme",
    en: "/en/high-end-restaurant-digital-menu",
    ctaHref: "/prendre-rendez-vous"
  },
  {
    path: "/en/qr-menu-without-pdf",
    fr: "/menu-qr-sans-pdf",
    en: "/en/qr-menu-without-pdf",
    ctaHref: "/en/book-a-call"
  },
  {
    path: "/en/replace-restaurant-pdf-menu",
    fr: "/remplacer-menu-pdf-restaurant",
    en: "/en/replace-restaurant-pdf-menu",
    ctaHref: "/en/book-a-call"
  },
  {
    path: "/en/digital-restaurant-menu-montreal",
    fr: "/menu-digital-restaurant-montreal",
    en: "/en/digital-restaurant-menu-montreal",
    ctaHref: "/en/book-a-call"
  },
  {
    path: "/en/high-end-restaurant-digital-menu",
    fr: "/menu-digital-restaurant-haut-de-gamme",
    en: "/en/high-end-restaurant-digital-menu",
    ctaHref: "/en/book-a-call"
  }
];

const mobileViewports = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 }
] as const;

const desktopViewport = { name: "desktop", width: 1366, height: 900 } as const;

const forbiddenJsonLdTypes = [
  "Restaurant",
  "LocalBusiness",
  "MenuItem",
  "AggregateRating",
  "Review"
];

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function pathnameFromHref(href: string | null | undefined) {
  expect(href).toBeTruthy();
  return new URL(href as string, "https://www.vistaire.ca").pathname || "/";
}

function attachPageGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const badResponses: string[] = [];
  const requestFailures: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (!failure.includes("ERR_ABORTED")) {
      requestFailures.push(`${failure} ${request.url()}`);
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes("/__nextjs")) {
      badResponses.push(`${status} ${url}`);
    }
  });

  return () => {
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(badResponses).toEqual([]);
    expect(requestFailures).toEqual([]);
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNoEarlyModelAssets(page: Page) {
  const modelResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /\.(glb|usdz)(\?|$)/i.test(name))
  );
  expect(modelResources).toEqual([]);
}

async function expectCanonicalPath(page: Page, expectedPath: string) {
  const href = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(pathnameFromHref(href)).toBe(expectedPath);
}

async function expectLanguageAlternates(page: Page, frPath: string, enPath: string) {
  const alternates = await page.locator('link[rel="alternate"]').evaluateAll((links) =>
    links.map((link) => ({
      href: link.getAttribute("href"),
      hreflang: link.getAttribute("hreflang")
    }))
  );
  const byLanguage = new Map(
    alternates.map((entry) => [entry.hreflang, entry.href])
  );

  expect(pathnameFromHref(byLanguage.get("fr-CA"))).toBe(frPath);
  expect(pathnameFromHref(byLanguage.get("en-CA"))).toBe(enPath);
  expect(pathnameFromHref(byLanguage.get("x-default"))).toBe(frPath);
}

async function expectSeoMetadata(page: Page, expectedPath: string) {
  await expectCanonicalPath(page, expectedPath);
  const title = await page.title();
  const description = await page.locator('meta[name="description"]').getAttribute("content");

  expect(title).toContain("Vistaire");
  expect(description?.trim().length ?? 0).toBeGreaterThan(80);
  expect(description?.trim().length ?? 0).toBeLessThanOrEqual(170);
}

async function collectJsonLdTypes(page: Page) {
  return page.evaluate(() => {
    function visit(value: unknown, types: string[]) {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item, types);
        return;
      }

      const record = value as Record<string, unknown>;
      const type = record["@type"];
      if (typeof type === "string") types.push(type);
      if (Array.isArray(type)) {
        for (const item of type) {
          if (typeof item === "string") types.push(item);
        }
      }
      for (const child of Object.values(record)) visit(child, types);
    }

    const types: string[] = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      visit(JSON.parse(script.textContent || "null"), types);
    }
    return types;
  });
}

async function expectSeoGeoRoute(
  page: Page,
  route: (typeof seoGeoSmokeRoutes)[number]
) {
  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), route.path).toBeLessThan(400);

  await expectSeoMetadata(page, route.path);
  await expectLanguageAlternates(page, route.fr, route.en);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
  await expect(page.locator('[aria-label="Langue"], [aria-label="Language"]').first()).toBeVisible();
  await expect(page.locator(`a[href="${route.ctaHref}"]`).first()).toBeVisible();

  const slug = route.path.split("/").filter(Boolean).at(-1);
  await expect(page.locator(`#${slug}-faq-title`)).toBeVisible();
  const visibleFaqCount = await page
    .locator(`section[aria-labelledby="${slug}-faq-title"] article h3`)
    .count();
  expect(visibleFaqCount, route.path).toBeGreaterThanOrEqual(5);

  const jsonLdTypes = await collectJsonLdTypes(page);
  expect(jsonLdTypes).toEqual(
    expect.arrayContaining(["WebPage", "BreadcrumbList", "Service", "FAQPage"])
  );
  for (const forbiddenType of forbiddenJsonLdTypes) {
    expect(jsonLdTypes).not.toContain(forbiddenType);
  }

  await expectNoHorizontalOverflow(page);
  await expectNoEarlyModelAssets(page);
}

test.describe("Vistaire SEO smoke", () => {
  test("public HTML exposes crawlable social images and the Vistaire logo", async ({ request }) => {
    for (const [path, imagePath] of [
      ["/", "/social-image/fr"],
      ["/en", "/social-image/en"],
      ["/contact", "/social-image/fr"],
      ["/en/contact", "/social-image/en"],
      ["/menu-digital-restaurant-montreal", "/images/demo/dishes/maison-elyse-n1.png"],
      ["/en/digital-restaurant-menu-montreal", "/images/demo/dishes/pave-boeuf-mature-bordelaise.png"],
      ["/tarifs-menu-digital-restaurant", "/images/pricing/vistaire-acrylique.jpg"]
    ]) {
      const response = await request.get(path, { headers: { accept: "text/html" } });
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      const tags = (html.match(/<meta\b[^>]*>/gi) ?? []).map(readAttributes);
      const image = tags.find((tag) => tag.get("property") === "og:image")?.get("content");
      expect(image, `${path}: social image in raw HTML`).toBeTruthy();
      const url = new URL(image as string);
      expect(url.origin).toBe("https://www.vistaire.ca");
      expect(url.pathname).toBe(imagePath);
      expect(tags.some((tag) => tag.get("name") === "twitter:image"), path).toBe(true);
      expect(tags.find((tag) => tag.get("property") === "og:image:alt")?.get("content"), path)
        .toBeTruthy();

      if (path === "/") {
        const globalEntities = jsonLdPayloads(html).flat().filter(
          (entity): entity is Record<string, unknown> => Boolean(entity) && typeof entity === "object"
        );
        const organization = globalEntities.find((entity) => entity["@type"] === "Organization");
        expect(organization?.logo).toBe("https://www.vistaire.ca/icon.svg");
      }
    }

    for (const path of ["/social-image/fr", "/social-image/en"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"], path).toContain("image/png");
      const bytes = await response.body();
      expect(bytes.subarray(1, 4).toString(), path).toBe("PNG");
      expect(bytes.readUInt32BE(16), `${path}: width`).toBe(1200);
      expect(bytes.readUInt32BE(20), `${path}: height`).toBe(630);
    }

    const logo = await request.get("/icon.svg");
    expect(logo.status()).toBe(200);
    expect(logo.headers()["content-type"]).toContain("image/svg+xml");
  });

  test("robots, llms, sitemap and legacy redirect expose only public SEO surfaces", async ({
    request
  }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(robots.headers()["content-type"]).toContain("text/plain");
    const robotsText = await robots.text();

    expect(robotsText).toContain("Sitemap:");
    expect(robotsText).toContain(
      "Content-Signal: search=yes,ai-input=yes,ai-train=yes"
    );
    for (const userAgent of [
      "GPTBot",
      "ClaudeBot",
      "CCBot",
      "Google-Extended",
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot"
    ]) {
      expect(robotsText).toContain(`User-agent: ${userAgent}`);
    }
    for (const path of [
      "/api",
      "/api/",
      "/api/*",
      "/owner",
      "/owner/",
      "/owner/*",
      "/admin",
      "/admin/",
      "/admin/*",
      "/sign-in",
      "/sign-in/",
      "/todos",
      "/todos/"
    ]) {
      expect(robotsText).toContain(`Disallow: ${path}`);
    }
    expect(robotsText).not.toContain("Disallow: /demo");

    const removedCardRoute = await request.get("/carte-vistaire", {
      maxRedirects: 0
    });
    expect(removedCardRoute.status()).toBe(308);
    expect(
      new URL(removedCardRoute.headers()["location"] ?? "", "https://www.vistaire.ca")
        .pathname
    ).toBe("/demo");

    const llms = await request.get("/llms.txt");
    expect(llms.status()).toBe(200);
    expect(llms.headers()["content-type"]).toContain("text/plain");
    const llmsText = await llms.text();
    expect(llmsText).toContain("# Vistaire");
    expect(llmsText).toContain("contact@vistaire.ca");
    expect(llmsText).toContain("514-715-2421");
    expect(llmsText).toContain("https://www.vistaire.ca/menu-digital-restaurant");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()["content-type"]).toContain("xml");
    const sitemapText = await sitemap.text();
    const sitemapUrls = unique(
      [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map(
        (match) => new URL(match[1]).pathname || "/"
      )
    );

    expect(sitemapUrls).toEqual([
      "/",
      "/en",
      "/demo",
      "/en/vistaire-menu",
      "/tarifs-menu-digital-restaurant",
      "/en/pricing-digital-restaurant-menu",
      ...seoPages.flatMap((path, index) => [path, englishSeoPages[index]]),
      ...publicProductPages.flatMap((path, index) => [
        path,
        englishProductPages[index]
      ]),
      ...editorialGuidePages.flatMap((path, index) => [
        path,
        englishEditorialGuidePages[index]
      ]),
      ...seoGeoPages.flatMap((path, index) => [path, englishSeoGeoPages[index]])
    ]);
    expect(sitemapText).not.toContain("/carte-vistaire");
    expect(sitemapText).not.toContain("/admin");
    expect(sitemapText).not.toContain("/owner");
  });

  test("homepage loads with canonical metadata on required mobile viewports", async ({
    page
  }) => {
    const assertNoUnexpectedBrowserIssues = attachPageGuards(page);

    for (const viewport of mobileViewports) {
      await page.setViewportSize(viewport);
      const response = await page.goto("/", { waitUntil: "domcontentloaded" });
      expect(response?.status(), viewport.name).toBeLessThan(400);

      await expect(page).toHaveTitle(/Menu digital QR premium/);
      await expectCanonicalPath(page, "/");
      await expectLanguageAlternates(page, "/", "/en");
      await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
      expect(await collectJsonLdTypes(page)).toEqual(
        expect.arrayContaining(["Organization", "WebSite", "WebPage", "Service"])
      );
      await expectNoHorizontalOverflow(page);
      await expectNoEarlyModelAssets(page);

      await expect(page.locator('a[href="/prendre-rendez-vous"]').first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Carte" }).first()).toBeVisible();

      const videoSource = await page.locator("video source").first().getAttribute("src");
      expect(videoSource).toBe("/videos/Vistaire2.mp4");
    }

    assertNoUnexpectedBrowserIssues();
  });

  test("key FR/EN SEO GEO pages have metadata, hreflang, FAQ and safe network behavior", async ({
    page
  }) => {
    const assertNoUnexpectedBrowserIssues = attachPageGuards(page);

    for (const route of seoGeoSmokeRoutes) {
      for (const viewport of [...mobileViewports, desktopViewport]) {
        await page.setViewportSize(viewport);
        await expectSeoGeoRoute(page, route);
      }
    }

    assertNoUnexpectedBrowserIssues();
  });
});
