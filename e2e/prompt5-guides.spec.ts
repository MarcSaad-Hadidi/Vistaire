import { expect, test, type Page } from "@playwright/test";

const routes = [
  {
    path: "/guides/anatomie-menu-digital-premium",
    fr: "/guides/anatomie-menu-digital-premium",
    en: "/en/guides/premium-digital-menu-anatomy",
    lang: "fr-CA",
    h1: "L’anatomie d’un menu digital premium"
  },
  {
    path: "/en/guides/premium-digital-menu-anatomy",
    fr: "/guides/anatomie-menu-digital-premium",
    en: "/en/guides/premium-digital-menu-anatomy",
    lang: "en-CA",
    h1: "The anatomy of a premium digital restaurant menu"
  },
  {
    path: "/guides/menu-qr-mobile-sans-application",
    fr: "/guides/menu-qr-mobile-sans-application",
    en: "/en/guides/mobile-qr-menu-without-app",
    lang: "fr-CA",
    h1: "Un menu QR mobile sans application"
  },
  {
    path: "/en/guides/mobile-qr-menu-without-app",
    fr: "/guides/menu-qr-mobile-sans-application",
    en: "/en/guides/mobile-qr-menu-without-app",
    lang: "en-CA",
    h1: "A mobile QR menu without an app"
  },
  {
    path: "/guides/3d-restaurant-utile-vs-gadget",
    fr: "/guides/3d-restaurant-utile-vs-gadget",
    en: "/en/guides/restaurant-3d-useful-vs-gimmick",
    lang: "fr-CA",
    h1: "La 3D au restaurant : utile ou gadget ?"
  },
  {
    path: "/en/guides/restaurant-3d-useful-vs-gimmick",
    fr: "/guides/3d-restaurant-utile-vs-gadget",
    en: "/en/guides/restaurant-3d-useful-vs-gimmick",
    lang: "en-CA",
    h1: "Restaurant 3D: useful tool or gimmick?"
  }
] as const;

function pathOf(href: string | null) {
  return new URL(href ?? "", "https://www.vistaire.ca").pathname;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

test("six bilingual guides render complete, crawlable editorial pages", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const badResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("/__nextjs")) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  for (const route of routes) {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 1366, height: 900 }
    ]) {
      await page.setViewportSize(viewport);
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), route.path).toBeLessThan(400);
      await expect(page.locator("html")).toHaveAttribute("lang", route.lang);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(route.h1);
      await expect(page.getByRole("navigation", { name: /fil d’ariane|breadcrumb/i })).toBeVisible();
      await expect(page.locator("article")).toBeVisible();
      expect(await page.locator("article h2").count()).toBeGreaterThanOrEqual(7);
      await expect(page.locator("article li")).not.toHaveCount(0);
      await expect(page.locator("footer")).toHaveCount(1);

      const tableRegions = page.locator("[data-guide-table-scroll]");
      for (let index = 0; index < (await tableRegions.count()); index += 1) {
        const region = tableRegions.nth(index);
        await expect(region).toHaveAttribute("role", "region");
        await expect(region).toHaveAttribute("tabindex", "0");
        expect(await region.getAttribute("aria-label")).toBeTruthy();
      }

      const canonical = page.locator('link[rel="canonical"]');
      expect(pathOf(await canonical.getAttribute("href"))).toBe(route.path);
      const alternates = await page.locator('link[rel="alternate"]').evaluateAll((links) =>
        Object.fromEntries(links.map((link) => [
          link.getAttribute("hreflang"),
          link.getAttribute("href")
        ]))
      );
      expect(pathOf(alternates["fr-CA"])).toBe(route.fr);
      expect(pathOf(alternates["en-CA"])).toBe(route.en);
      expect(pathOf(alternates["x-default"])).toBe(route.fr);

      const types = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
        scripts.flatMap((script) => {
          const value = JSON.parse(script.textContent || "null");
          const queue = Array.isArray(value) ? [...value] : [value];
          const found: string[] = [];
          while (queue.length) {
            const item = queue.shift();
            if (!item || typeof item !== "object") continue;
            if (typeof item["@type"] === "string") found.push(item["@type"]);
            queue.push(...Object.values(item).filter((child) => child && typeof child === "object"));
          }
          return found;
        })
      );
      expect(types.filter((type) => type === "Article")).toHaveLength(1);
      expect(types.filter((type) => type === "BreadcrumbList")).toHaveLength(1);
      await expectNoHorizontalOverflow(page);
    }
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(badResponses).toEqual([]);
});

test("localized landing pages expose all three editorial guides", async ({ page }) => {
  for (const [path, localeRoutes] of [
    ["/", routes.filter((route) => route.lang === "fr-CA")],
    ["/en", routes.filter((route) => route.lang === "en-CA")]
  ] as const) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const section = page.locator("#guides");
    await expect(section).toBeVisible();
    for (const route of localeRoutes) {
      await expect(section.locator(`a[href="${route.path}"]`)).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
  }
});
