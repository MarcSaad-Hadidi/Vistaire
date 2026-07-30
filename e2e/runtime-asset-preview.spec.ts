import { expect, test, type Page, type Response } from "@playwright/test";

const E2E_ENABLED = process.env.VISTAIRE_RUNTIME_E2E === "1";
const MENU_PATH =
  process.env.VISTAIRE_RUNTIME_MENU_PATH ??
  "/menu/trouvable?menu=principal&lang=fr-CA";
const DISH_PATH = process.env.VISTAIRE_RUNTIME_DISH_PATH ?? "";
const DISH_ID = process.env.VISTAIRE_RUNTIME_DISH_ID ?? "";
const ASSET_VERSION = process.env.VISTAIRE_RUNTIME_ASSET_VERSION ?? "";
const EXPECTED_STORAGE_HOST =
  process.env.VISTAIRE_RUNTIME_STORAGE_HOST ?? "";
const DISH_HEADING = process.env.VISTAIRE_RUNTIME_DISH_HEADING ?? "";
const VIEW_3D_LABEL = new RegExp(
  process.env.VISTAIRE_RUNTIME_VIEW_3D_LABEL ??
    "Voir en 3D|VIEW IN 3D|VOIR EN 3D",
  "i"
);
const MODEL_ROUTE_RE = /\/model\/(?:glb|usdz)(?:\/|$)|\.(?:glb|usdz)$/i;
const VIEWPORTS = [
  { label: "390px", width: 390, height: 844 },
  { label: "430px", width: 430, height: 932 },
  { label: "desktop", width: 1280, height: 900 }
];

type PageSignals = {
  consoleIssues: string[];
  modelRequests: string[];
  networkIssues: string[];
  reset(): void;
};

type GlbResponseEvidence = {
  contentType: string;
  cors: string;
  host: string;
  locationHost: string;
  locationPath: string;
  path: string;
  status: number;
  versionMatches: boolean;
};

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.search ? "?<redacted>" : ""}`;
  } catch {
    return "[redacted URL]";
  }
}

function sanitizeMessage(value: string) {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => sanitizeUrl(url))
    .replace(
      /([?&](?:token|signature|sig|jwt|key|secret|credential)=)[^&\s]+/gi,
      "$1<redacted>"
    );
}

function installPageSignals(page: Page): PageSignals {
  const consoleIssues: string[] = [];
  const modelRequests: string[] = [];
  const networkIssues: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleIssues.push(sanitizeMessage(message.text()));
    }
  });
  page.on("pageerror", (error) => {
    consoleIssues.push(sanitizeMessage(error.message));
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (MODEL_ROUTE_RE.test(url.pathname)) {
      modelRequests.push(url.pathname);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "request failed";
    if (failure === "net::ERR_ABORTED") return;
    networkIssues.push(`${failure} ${sanitizeUrl(request.url())}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status === 404 || status >= 500) {
      networkIssues.push(`${status} ${sanitizeUrl(response.url())}`);
    }
  });

  return {
    consoleIssues,
    modelRequests,
    networkIssues,
    reset() {
      consoleIssues.length = 0;
      modelRequests.length = 0;
      networkIssues.length = 0;
    }
  };
}

function expectSignalsClean(signals: PageSignals) {
  expect(signals.consoleIssues, signals.consoleIssues.join("\n")).toEqual([]);
  expect(signals.networkIssues, signals.networkIssues.join("\n")).toEqual([]);
}

async function expectHealthyNavigation(response: Response | null) {
  expect(response, "route should return an HTTP response").not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
}

async function expectVisibleLoadedPhoto(page: Page) {
  await expect
    .poll(
      () =>
        page.locator("main img").evaluateAll((images) =>
          images.some((image) => {
            if (!(image instanceof HTMLImageElement)) return false;
            const rect = image.getBoundingClientRect();
            return (
              image.complete &&
              image.naturalWidth > 0 &&
              rect.width > 8 &&
              rect.height > 8 &&
              rect.bottom > 0 &&
              rect.top < window.innerHeight
            );
          })
        ),
      { message: "at least one visible menu/dish photo should load" }
    )
    .toBe(true);
}

function requiredConfigurationMissing() {
  return [
    ["VISTAIRE_RUNTIME_DISH_PATH", DISH_PATH],
    ["VISTAIRE_RUNTIME_DISH_ID", DISH_ID],
    ["VISTAIRE_RUNTIME_ASSET_VERSION", ASSET_VERSION],
    ["VISTAIRE_RUNTIME_STORAGE_HOST", EXPECTED_STORAGE_HOST]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function expectedGlbPath() {
  return `/api/public/menu-dishes/${encodeURIComponent(DISH_ID)}/model/glb`;
}

function collectGlbResponseEvidence(page: Page, baseOrigin: string) {
  const publicResponses: GlbResponseEvidence[] = [];
  const storageResponses: GlbResponseEvidence[] = [];

  page.on("response", (response) => {
    const url = new URL(response.url());
    const headers = response.headers();
    if (url.origin === baseOrigin && url.pathname === expectedGlbPath()) {
      let location: URL | null = null;
      try {
        location = headers.location ? new URL(headers.location, baseOrigin) : null;
      } catch {
        location = null;
      }
      publicResponses.push({
        contentType: headers["content-type"] ?? "",
        cors: headers["access-control-allow-origin"] ?? "",
        host: url.host,
        locationHost: location?.host ?? "",
        locationPath: location?.pathname ?? "",
        path: url.pathname,
        status: response.status(),
        versionMatches: url.searchParams.get("v") === ASSET_VERSION
      });
      return;
    }
    if (url.host === EXPECTED_STORAGE_HOST) {
      const contentType = headers["content-type"] ?? "";
      if (contentType.toLowerCase().includes("model/gltf-binary")) {
        storageResponses.push({
          contentType,
          cors: headers["access-control-allow-origin"] ?? "",
          host: url.host,
          locationHost: "",
          locationPath: "",
          path: url.pathname,
          status: response.status(),
          versionMatches: true
        });
      }
    }
  });

  return { publicResponses, storageResponses };
}

test.describe("runtime asset Preview browser proof", () => {
  test.skip(
    !E2E_ENABLED,
    "Set VISTAIRE_RUNTIME_E2E=1 and the documented read-only Preview variables."
  );

  test.beforeAll(() => {
    const missing = requiredConfigurationMissing();
    if (missing.length > 0) {
      throw new Error(`Missing runtime E2E configuration: ${missing.join(", ")}`);
    }
  });

  for (const viewport of VIEWPORTS) {
    test(`menu and dish stay healthy before 3D intent at ${viewport.label}`, async ({
      page
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });
      const signals = installPageSignals(page);

      await expectHealthyNavigation(
        await page.goto(MENU_PATH, { waitUntil: "domcontentloaded" })
      );
      await expect(page.locator("main")).toBeVisible();
      await expectVisibleLoadedPhoto(page);
      await expectNoHorizontalOverflow(page);
      expect(signals.modelRequests).toEqual([]);
      expectSignalsClean(signals);

      signals.reset();
      await expectHealthyNavigation(
        await page.goto(DISH_PATH, { waitUntil: "domcontentloaded" })
      );
      const heading = page.getByRole("heading", { level: 1 });
      await expect(
        (
          DISH_HEADING
            ? heading.filter({ hasText: new RegExp(DISH_HEADING, "i") })
            : heading
        ).first()
      ).toBeVisible();
      await expectVisibleLoadedPhoto(page);
      await expectNoHorizontalOverflow(page);
      await expect(page.locator("model-viewer")).toHaveCount(0);
      expect(signals.modelRequests).toEqual([]);
      expectSignalsClean(signals);
    });
  }

  test("3D intent yields a public 307 then a GLB response from the expected Storage host", async ({
    baseURL,
    page
  }) => {
    const baseOrigin = new URL(baseURL ?? page.url()).origin;
    await page.setViewportSize({ width: 430, height: 932 });
    const signals = installPageSignals(page);
    const glbEvidence = collectGlbResponseEvidence(page, baseOrigin);

    await expectHealthyNavigation(
      await page.goto(DISH_PATH, { waitUntil: "domcontentloaded" })
    );
    await expectVisibleLoadedPhoto(page);
    expect(signals.modelRequests).toEqual([]);

    await page.getByRole("button", { name: VIEW_3D_LABEL, exact: true }).click();
    await expect(page.locator("model-viewer")).toHaveCount(1, {
      timeout: 20_000
    });
    await expect
      .poll(() => glbEvidence.publicResponses.length, {
        message: "the public GLB route should be requested after explicit intent"
      })
      .toBeGreaterThan(0);
    await expect
      .poll(() => glbEvidence.storageResponses.length, {
        message: "the redirected GLB should load from Storage"
      })
      .toBeGreaterThan(0);

    const publicGlb = glbEvidence.publicResponses.at(-1);
    const storageGlb = glbEvidence.storageResponses.at(-1);
    expect(publicGlb).toMatchObject({
      locationHost: EXPECTED_STORAGE_HOST,
      path: expectedGlbPath(),
      status: 307,
      versionMatches: true
    });
    expect(publicGlb?.locationPath).toBeTruthy();
    expect(storageGlb).toMatchObject({
      host: EXPECTED_STORAGE_HOST
    });
    expect([200, 206]).toContain(storageGlb?.status);
    expect(storageGlb?.contentType.toLowerCase()).toContain("model/gltf-binary");
    expect(["*", baseOrigin]).toContain(storageGlb?.cors);
    expect(
      signals.modelRequests.some((pathname) => pathname === expectedGlbPath())
    ).toBe(true);
    expect(
      signals.modelRequests.some((pathname) =>
        /\/model\/usdz(?:\/|$)|\.usdz$/i.test(pathname)
      )
    ).toBe(false);

    const quickLookLink = page.locator('a[rel~="ar"]').first();
    await expect(quickLookLink).toBeVisible();
    const quickLookHref = await quickLookLink.getAttribute("href");
    expect(quickLookHref).toBeTruthy();
    const quickLookUrl = new URL(quickLookHref ?? "", baseOrigin);
    expect(quickLookUrl.origin).toBe(baseOrigin);
    expect(quickLookUrl.pathname).toBe(
      `/api/public/menu-dishes/${encodeURIComponent(DISH_ID)}/model/usdz`
    );

    await expectNoHorizontalOverflow(page);
    expectSignalsClean(signals);
  });
});
