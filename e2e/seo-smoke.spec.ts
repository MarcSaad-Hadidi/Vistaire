import { expect, test } from "@playwright/test";

const seoPages = [
  "/menu-digital-restaurant",
  "/menu-qr-code-restaurant",
  "/menu-3d-ar-restaurant",
  "/menu-pdf-vs-menu-digital"
];

const publicProductPages = [
  "/a-propos",
  "/contact",
  "/prendre-rendez-vous",
  "/apercu-restaurateur"
];

const addedPublicPages = [
  "/tarifs-menu-digital-restaurant",
  "/carte-vistaire"
];

const forbiddenJsonLdTypes = [
  "Restaurant",
  "LocalBusiness",
  "MenuItem",
  "AggregateRating",
  "Review"
];

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNoEarlyModelAssets(page: import("@playwright/test").Page) {
  const modelResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /\.(glb|usdz)(\?|$)/i.test(name))
  );
  expect(modelResources).toEqual([]);
}

async function expectCanonicalPath(
  page: import("@playwright/test").Page,
  expectedPath: string
) {
  const href = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(href).toBeTruthy();
  expect(new URL(href as string).pathname || "/").toBe(expectedPath);
}

async function collectJsonLdTypes(page: import("@playwright/test").Page) {
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

function unique(values: string[]) {
  return Array.from(new Set(values));
}

test.describe("Vistaire SEO smoke", () => {
  test("robots and sitemap expose only public SEO surfaces", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
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
      "/admin",
      "/admin/",
      "/sign-in",
      "/sign-in/",
      "/todos",
      "/todos/"
    ]) {
      expect(robotsText).toContain(`Disallow: ${path}`);
    }
    expect(robotsText).not.toContain("Disallow: /demo");

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
    const sitemapText = await sitemap.text();
    const sitemapUrls = unique(
      [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map(
        (match) => new URL(match[1]).pathname || "/"
      )
    );

    expect(sitemapUrls).toEqual([
      "/",
      ...publicProductPages,
      ...seoPages,
      "/demo",
      ...addedPublicPages
    ]);
  });

  test("public pages have canonical metadata and safe early network behavior", async ({
    page
  }) => {
    const pageErrors: string[] = [];
    const badResponses: string[] = [];
    const requestFailures: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        pageErrors.push(message.text());
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

    for (const width of [390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(page).toHaveTitle(/Menu digital QR premium/);
      await expectCanonicalPath(page, "/");
      await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
      expect(await collectJsonLdTypes(page)).toEqual(
        expect.arrayContaining(["Organization", "WebSite", "WebPage", "Service"])
      );
      await expectNoHorizontalOverflow(page);
      await expectNoEarlyModelAssets(page);

      await expect(page.getByRole("link", { name: "Prendre rendez-vous" }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Carte" }).first()).toBeVisible();

      const videoSource = await page.locator("video source").first().getAttribute("src");
      expect(videoSource).toBe("/videos/Vistaire2.mp4");
    }

    for (const path of ["/demo", ...seoPages]) {
      for (const width of [390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expectCanonicalPath(page, path);
        await expect(page.locator('meta[name="description"]')).not.toHaveAttribute(
          "content",
          ""
        );
        if (seoPages.includes(path)) {
          await expect(page).toHaveTitle(/Vistaire/);
          await expect(page.locator("h1")).toHaveCount(1);
          await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
          const jsonLdTypes = await collectJsonLdTypes(page);
          expect(jsonLdTypes).toEqual(
            expect.arrayContaining(["WebPage", "BreadcrumbList", "Service", "FAQPage"])
          );
          for (const forbiddenType of forbiddenJsonLdTypes) {
            expect(jsonLdTypes).not.toContain(forbiddenType);
          }
          const visibleFaqCount = await page.locator("article h3").count();
          expect(visibleFaqCount).toBeGreaterThanOrEqual(5);
          await expect(page.getByRole("link", { name: "Menu digital restaurant", exact: true }).first()).toBeVisible();
          await expect(page.getByRole("link", { name: "Accès interne" })).toHaveCount(0);
        }
        await expectNoHorizontalOverflow(page);
        await expectNoEarlyModelAssets(page);
      }
    }

    expect(pageErrors).toEqual([]);
    expect(badResponses).toEqual([]);
    expect(requestFailures).toEqual([]);
  });

  test("demo-sensitive surfaces load but stay noindex", async ({ page }) => {
    const pageErrors: string[] = [];
    const badResponses: string[] = [];
    const requestFailures: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        pageErrors.push(message.text());
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

    for (const path of ["/admin", "/demo/dishes/homard-bisque", "/legacy/landing"]) {
      for (const width of [390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(path, { waitUntil: "networkidle" });
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
          "content",
          /noindex/
        );
        await expectCanonicalPath(page, path);
        const jsonLdTypes = await collectJsonLdTypes(page);
        for (const forbiddenType of forbiddenJsonLdTypes) {
          expect(jsonLdTypes).not.toContain(forbiddenType);
        }
        await expectNoHorizontalOverflow(page);
        await expectNoEarlyModelAssets(page);
      }
    }

    expect(pageErrors).toEqual([]);
    expect(badResponses).toEqual([]);
    expect(requestFailures).toEqual([]);
  });
});
