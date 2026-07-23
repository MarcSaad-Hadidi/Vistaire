import { expect, type Page, test } from "@playwright/test";

const DEMO_RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const LANDING_VIDEO_ROUTE = "/videos/Vistaire2.mp4";

type PageHealth = {
  expectClean: () => void;
  networkIssues: string[];
  consoleErrors: string[];
};

type StatusResponse = {
  status: () => number;
};

function isRedirectStatus(status: number) {
  return [302, 303, 307, 308].includes(status);
}

function expectNotSuccessfulStatus(status: number) {
  expect(status < 200 || status >= 300).toBe(true);
}

function shouldTrackPageUrl(page: Page, url: string) {
  if (url.startsWith("data:") || url.startsWith("blob:")) return false;

  try {
    const target = new URL(url);
    const currentUrl = page.url();
    if (!currentUrl.startsWith("http")) return true;

    return target.origin === new URL(currentUrl).origin;
  } catch {
    return true;
  }
}

function installPageHealth(page: Page): PageHealth {
  const networkIssues: string[] = [];
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;

    const text = message.text();
    if (text.includes("Failed to load resource")) return;
    consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!shouldTrackPageUrl(page, url)) return;

    const status = response.status();
    if (status === 404 || status >= 500) {
      networkIssues.push(`${status} ${url}`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? "request failed";

    if (failure === "net::ERR_ABORTED") return;
    if (!shouldTrackPageUrl(page, url)) return;
    networkIssues.push(`${failure} ${url}`);
  });

  return {
    consoleErrors,
    networkIssues,
    expectClean() {
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      expect(networkIssues, networkIssues.join("\n")).toEqual([]);
    }
  };
}

async function stubAnalytics(page: Page) {
  await page.route("**/api/analytics/events", async (route) => {
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ ok: true })
    });
  });
}

function collectModelAssetRequests(page: Page) {
  const requests: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;

    if (MODEL_ASSET_RE.test(pathname)) {
      requests.push(request.url());
    }
  });

  return requests;
}

async function expectHealthyResponse(response: StatusResponse | null) {
  expect(response, "route should return a response").not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNoForbiddenPublicText(page: Page) {
  const inspectedText = await page.evaluate(() => {
    const metadata = [
      document.title,
      document.querySelector('meta[name="description"]')?.getAttribute("content") ?? ""
    ];
    const structuredData = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => script.textContent ?? "");

    return [document.body.innerText, ...metadata, ...structuredData].join("\n");
  });

  for (const term of [
    "demo",
    "Demo",
    "démo",
    "Démo",
    "démonstration",
    "démonstratif",
    "fictif",
    "fictive"
  ]) {
    expect(inspectedText).not.toContain(term);
  }
}

async function collectStructuredDataTypes(page: Page) {
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

async function expectPromotedLanding(page: Page) {
  const video = page.locator("main video").first();

  await expect(
    page.getByRole("heading", { level: 1, name: /VISTAIRE/ })
  ).toBeVisible();
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate((element) => {
        const media = element as HTMLVideoElement;
        return {
          autoplay: media.autoplay,
          controls: media.controls,
          loop: media.loop,
          muted: media.muted,
          paused: media.paused,
          playsInline: media.playsInline,
          src: media.currentSrc || media.querySelector("source")?.src || ""
        };
      })
    )
    .toEqual(
      expect.objectContaining({
        autoplay: true,
        controls: false,
        loop: true,
        muted: true,
        paused: false,
        playsInline: true
      })
    );
  await expect
    .poll(() =>
      video.evaluate(
        (element) =>
          (element as HTMLVideoElement).currentSrc ||
          element.querySelector("source")?.src ||
          ""
      )
    )
    .toContain(LANDING_VIDEO_ROUTE);
  await expect(page.getByText(/Demander une demo|Demander une démo/i)).toHaveCount(0);
}

async function openDish3d(page: Page) {
  const view3d = page.getByRole("button", { name: "Voir en 3D" });

  await expect(view3d).toBeVisible();
  await expect(view3d).toBeEnabled();
  await expect(page.locator("model-viewer")).toHaveCount(0);
  await view3d.scrollIntoViewIfNeeded();
  await view3d.click();
  await expect
    .poll(() => page.locator("model-viewer").count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
}

async function openDemoDish(page: Page, dishName: RegExp) {
  await expectHealthyResponse(
    await page.goto("/demo", {
      waitUntil: "domcontentloaded"
    })
  );

  const phoneViewport = page.getByTestId("demo-phone-viewport");
  await expect(phoneViewport.getByText("LA COLLECTION")).toBeVisible();
  await expect(phoneViewport.getByRole("heading", { name: "LA CARTE" })).toBeVisible();
  const dishButton = phoneViewport.getByRole("button", { name: dishName });
  await dishButton.scrollIntoViewIfNeeded();
  await expect(dishButton).toBeVisible();
  await dishButton.click();
  await expect(phoneViewport.getByRole("heading", { level: 1, name: dishName })).toBeVisible();
}

test.describe("Vistaire MVP smoke", () => {
  test("landing production keeps the promoted Framer video hero healthy", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await stubAnalytics(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expectHealthyResponse(
      await page.goto("/", { waitUntil: "domcontentloaded" })
    );

    await expectPromotedLanding(page);
    await expect(
      page.getByRole("link", { name: "Prendre rendez-vous" }).first()
    ).toHaveAttribute("href", "/prendre-rendez-vous");
    await expect(
      page.getByRole("link", { name: "Tarifs", exact: true })
    ).toHaveAttribute("href", "/tarifs-menu-digital-restaurant");
    await expectNoHorizontalOverflow(page);
    expect(modelRequests).toEqual([]);
    health.expectClean();
  });

  for (const viewport of [
    { label: "375", width: 375, height: 812 },
    { label: "390", width: 390, height: 844 },
    { label: "430", width: 430, height: 932 }
  ]) {
    test(`landing mobile ${viewport.label}px keeps the promoted video loop`, async ({
      page
    }) => {
      const health = installPageHealth(page);
      const modelRequests = collectModelAssetRequests(page);

      await stubAnalytics(page);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });
      await expectHealthyResponse(
        await page.goto("/", { waitUntil: "domcontentloaded" })
      );

      await expectPromotedLanding(page);
      await expectNoHorizontalOverflow(page);
      expect(modelRequests).toEqual([]);
      health.expectClean();
    });
  }

  test("demo menu loads, searches, and avoids early model assets", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await stubAnalytics(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectHealthyResponse(
      await page.goto("/demo", { waitUntil: "domcontentloaded" })
    );

    const phoneViewport = page.getByTestId("demo-phone-viewport");
    await expect(phoneViewport.getByText("LA COLLECTION")).toBeVisible();
    await expect(phoneViewport.getByRole("heading", { name: "LA CARTE" })).toBeVisible();
    await expect(
      phoneViewport.getByRole("heading", { level: 1, name: /Bienvenue chez Maison/i })
    ).toHaveCount(0);
    await expect(
      phoneViewport.getByRole("button", { name: "Voir toute la carte" })
    ).toHaveCount(0);
    await expect(page.getByText(/D.mo interactive Vistaire/i)).toHaveCount(0);
    const visibleDishButton = phoneViewport.getByRole("button", { name: /Ravioles/i });
    await expect(visibleDishButton).toBeVisible();

    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);
    health.expectClean();

    await visibleDishButton.click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(
      phoneViewport.getByRole("heading", { level: 1, name: /Ravioles/i })
    ).toBeVisible();
    await expect(phoneViewport.getByRole("button", { name: /Retour . la carte/i })).toBeVisible();
  });

  test("pricing and card routes expose the clean public Vistaire offer", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await stubAnalytics(page);

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 }
    ]) {
      await page.setViewportSize(viewport);
      await expectHealthyResponse(
        await page.goto("/tarifs-menu-digital-restaurant", {
          waitUntil: "domcontentloaded"
        })
      );

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Tarifs Vistaire : menu digital premium avec plats 3D inclus"
        })
      ).toBeVisible();
      for (const offer of ["Vistaire Base", "Vistaire Premium", "Vistaire Signature"]) {
        await expect(page.getByRole("heading", { name: offer })).toBeVisible();
      }
      for (const count of ["5 plats 3D", "10 plats 3D", "20 plats 3D"]) {
        await expect(page.getByText(count).first()).toBeVisible();
      }
      await expect(
        page.getByRole("link", { name: "Parler de votre menu" }).first()
      ).toHaveAttribute("href", "/prendre-rendez-vous");
      await expect(
        page.getByRole("link", { name: "Voir le menu exemple" }).first()
      ).toHaveAttribute("href", "/demo");
      await expect(
        page.getByRole("link", { name: "514-715-2421" })
      ).toHaveAttribute("href", "tel:+15147152421");
      expect(await collectStructuredDataTypes(page)).toEqual(
        expect.arrayContaining([
          "WebPage",
          "Service",
          "OfferCatalog",
          "FAQPage",
          "BreadcrumbList"
        ])
      );
      await expectNoForbiddenPublicText(page);
      await expectNoHorizontalOverflow(page);
    }

    expect(modelRequests).toEqual([]);
    health.expectClean();
  });

  test("homard dish loads 3D only after user intent", async ({ page }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await stubAnalytics(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemoDish(page, /Homard/i);

    await expect(page.getByRole("heading", { level: 1 }).last()).toBeVisible();
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);

    await openDish3d(page);
    await expect
      .poll(() =>
        modelRequests.some((url) => {
          const pathname = new URL(url).pathname;
          return pathname.endsWith(".glb") && pathname.includes("homard-bisque");
        })
      )
      .toBe(true);
    expect(
      modelRequests.some((url) => new URL(url).pathname.endsWith(".usdz"))
    ).toBe(false);
    health.expectClean();
  });

  test("admin rejects restaurant query bypass and preserves QR access entry", async ({
    page
  }) => {
    const health = installPageHealth(page);

    await stubAnalytics(page);
    await expectHealthyResponse(
      await page.goto("/admin?restaurantId=not-demo", {
        waitUntil: "domcontentloaded"
      })
    );

    await expect(page).toHaveURL(/\/admin(?:\?|$)/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Accès dashboard restaurant requis/i })
    ).toBeVisible();
    await expect(page.getByLabel(/Code ou lien QR admin/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Accéder au dashboard/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    health.expectClean();
  });

  test("owner route and private owner APIs stay protected when signed out", async ({
    request
  }, testInfo) => {
    const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
    const ownerResponse = await request.get("/owner", { maxRedirects: 0 });

    expectNotSuccessfulStatus(ownerResponse.status());
    const location = ownerResponse.headers().location;
    if (isRedirectStatus(ownerResponse.status())) {
      expect(location).toBeTruthy();
      expect(new URL(location!, baseURL).pathname).toMatch(/^\/sign-in/);
    }
    const ownerBody = await ownerResponse.text();
    expect(ownerBody).not.toContain("Pilotage Vistaire");
    expect(ownerBody).not.toContain("Restaurants total");

    const protectedResponses = await Promise.all([
      request.get("/api/restaurants", {
        maxRedirects: 0
      }),
      request.get(`/api/analytics/summary?restaurantId=${DEMO_RESTAURANT_ID}`, {
        maxRedirects: 0
      }),
      request.get("/api/owner/insights", {
        maxRedirects: 0
      })
    ]);

    for (const response of protectedResponses) {
      expectNotSuccessfulStatus(response.status());
      const protectedLocation = response.headers().location;
      if (isRedirectStatus(response.status())) {
        expect(protectedLocation).toBeTruthy();
        expect(new URL(protectedLocation!, baseURL).pathname).toMatch(
          /^\/sign-in/
        );
      }
    }
  });

  test("metadata routes respond for robots and sitemap", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    const sitemap = await request.get("/sitemap.xml");
    const sitemapText = await sitemap.text();

    expect(robots.status()).toBe(200);
    const robotsText = await robots.text();
    expect(robotsText).toContain("Sitemap:");
    expect(robotsText).toContain("Content-Signal: search=yes,ai-input=yes,ai-train=yes");
    expect(robotsText).toContain("User-agent: GPTBot");
    expect(robotsText).toContain("Disallow: /admin");
    expect(sitemap.status()).toBe(200);
    expect(sitemapText).toContain("<urlset");
    expect(sitemapText).toContain("/prendre-rendez-vous");
    expect(sitemapText).not.toContain("/vistaire-preview");
  });
});
