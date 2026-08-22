import { expect, test, type Browser, type Page } from "@playwright/test";

const BASE_ORIGIN = new URL(
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
).origin;
const menuPath = "/menu/sauge-noire?view=sauge-0";
const detailPath =
  "/menu/sauge-noire/dishes/truite-des-laurentides?lang=fr-CA&currency=CAD&view=sauge-3";
const paper = "rgb(250, 244, 233)";
const dark = "rgb(8, 7, 6)";
const HYDRATION_WARNING_RE =
  /hydration|hydrated|server[- ]rendered|server.*client|client.*server|did not match|content does not match|text content does not match/i;
const ERROR_OVERLAY_SELECTOR =
  "[data-nextjs-dialog], nextjs-portal, #webpack-dev-server-client-overlay, .vite-error-overlay";
const readyRouteSelector =
  '[data-sauge-route-renderer-pending-handoff="false"] [data-page-flip-state="ready"]';
const visibleReadingSurfaceSelector =
  '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"][data-sauge-reading-visible="true"]';

const routeScenarios = [
  { path: menuPath, heading: /SAUGE NOIRE/i, detail: false },
  { path: detailPath, heading: /TRUITE/i, detail: true }
] as const;

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 }
] as const;

function collectHealth(page: Page) {
  const consoleSignals: string[] = [];
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      (message.type() === "warning" && HYDRATION_WARNING_RE.test(message.text()))
    ) {
      consoleSignals.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (
      new URL(response.url()).origin === BASE_ORIGIN &&
      response.status() >= 400
    ) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "request failed";
    const url = new URL(request.url());
    const isSupersededSaugeRscNavigation =
      /(?:ERR_ABORTED|NS_BINDING_ABORTED|cancelled)/i.test(failure) &&
      url.origin === BASE_ORIGIN &&
      url.pathname === "/menu/sauge-noire" &&
      url.searchParams.has("_rsc") &&
      request.method() === "GET" &&
      request.resourceType() === "fetch" &&
      !request.isNavigationRequest();
    if (isSupersededSaugeRscNavigation) return;
    failedRequests.push(
      `${failure} ${request.url()}`
    );
  });

  return { consoleSignals, pageErrors, failedResponses, failedRequests };
}

async function readViewportTheme(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#contenu");
    const detail = document.querySelector<HTMLElement>(
      '[data-testid="sauge-noire-dish-detail"]'
    );

    return {
      themeColors: Array.from(document.querySelectorAll('meta[name="theme-color"]')).map(
        (element) => element.getAttribute("content")
      ),
      colorSchemes: Array.from(document.querySelectorAll('meta[name="color-scheme"]')).map(
        (element) => element.getAttribute("content")
      ),
      htmlRouteTheme: document.documentElement.getAttribute(
        "data-vistaire-route-theme"
      ),
      bodyRouteTheme: document.body.getAttribute("data-vistaire-route-theme"),
      htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
      htmlColorScheme: getComputedStyle(document.documentElement).colorScheme,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyColorScheme: getComputedStyle(document.body).colorScheme,
      rootBackground: root ? getComputedStyle(root).backgroundColor : null,
      detailBackground: detail ? getComputedStyle(detail).backgroundColor : null,
      hasServerMarker: Boolean(
        document.querySelector('[data-vistaire-route-theme="sauge-noire"]')
      ),
      horizontalOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
}

function expectRawServerMarker(html: string, label: string) {
  expect(
    html,
    `${label}: raw HTML owns the Sauge descendant theme marker`
  ).toMatch(/data-vistaire-route-theme=["']sauge-noire["']/i);
}

async function expectSaugeTheme(page: Page, detail: boolean) {
  await expect
    .poll(async () => (await readViewportTheme(page)).themeColors)
    .toEqual(["#faf4e9"]);
  const theme = await readViewportTheme(page);
  expect(theme.themeColors).toEqual(["#faf4e9"]);
  expect(theme.colorSchemes).toEqual(["light"]);
  expect(theme.hasServerMarker).toBe(true);
  expect(theme.htmlRouteTheme).toBe("sauge-noire");
  expect(theme.bodyRouteTheme).toBe("sauge-noire");
  expect(theme.htmlBackground).toBe(paper);
  expect(theme.htmlColorScheme).toBe("light");
  expect(theme.bodyBackground).toBe(paper);
  expect(theme.bodyColorScheme).toBe("light");
  expect(theme.rootBackground).toBe(paper);
  expect(theme.detailBackground).toBe(detail ? paper : null);
  expect(theme.horizontalOverflow).toBeLessThanOrEqual(2);
}

async function expectReadySaugeRoute(
  page: Page,
  scenario: (typeof routeScenarios)[number]
) {
  await expect(page.getByRole("heading", { name: scenario.heading }).first()).toBeVisible();
  await expect(
    page.getByTestId(
      scenario.detail ? "sauge-noire-dish-detail" : "sauge-noire-book"
    )
  ).toBeVisible();
  await expect(page.locator(readyRouteSelector)).toHaveCount(1, {
    timeout: 15_000
  });
  const visibleSurface = page
    .locator('[data-sauge-route-renderer-pending-handoff="false"]')
    .locator(visibleReadingSurfaceSelector);
  await expect(visibleSurface).toHaveCount(1, { timeout: 15_000 });
  await expect(visibleSurface).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(ERROR_OVERLAY_SELECTOR)).toHaveCount(0);
  await expectSaugeTheme(page, scenario.detail);
}

async function expectJavaScriptDisabledFirstPaint(
  browser: Browser,
  path: string,
  viewport: (typeof viewports)[number],
  detail: boolean
) {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response, `${path}: JS-disabled response`).not.toBeNull();
    expect(response?.status()).toBeLessThan(400);
    expectRawServerMarker(await response!.text(), `${path}: JS-disabled`);
    await expect(
      page.locator('[data-vistaire-route-theme="sauge-noire"]')
    ).toHaveCount(1);
    await expect(page.locator("#contenu")).toBeVisible();

    const theme = await readViewportTheme(page);
    expect(theme.themeColors).toEqual(["#faf4e9"]);
    expect(theme.colorSchemes).toEqual(["light"]);
    expect(theme.hasServerMarker).toBe(true);
    expect(theme.htmlBackground).toBe(paper);
    expect(theme.htmlColorScheme).toBe("light");
    expect(theme.bodyBackground).toBe(paper);
    expect(theme.bodyColorScheme).toBe("light");
    expect(theme.rootBackground).toBe(paper);
    expect(theme.detailBackground).toBe(detail ? paper : null);
    expect(theme.horizontalOverflow).toBeLessThanOrEqual(2);
  } finally {
    await context.close();
  }
}

function expectNoHealthFailures(
  health: ReturnType<typeof collectHealth>,
  label: string
) {
  expect(health.consoleSignals, `${label}: console/hydration`).toEqual([]);
  expect(health.pageErrors, `${label}: page errors`).toEqual([]);
  expect(health.failedResponses, `${label}: HTTP failures`).toEqual([]);
  expect(health.failedRequests, `${label}: request failures`).toEqual([]);
}

for (const viewport of viewports) {
  for (const scenario of routeScenarios) {
    test(`keeps ${scenario.detail ? "detail" : "menu"} direct, reload, and first paint beige at ${viewport.width}px`, async ({
      browser,
      page
    }) => {
      await page.setViewportSize(viewport);
      const health = collectHealth(page);

      const response = await page.goto(scenario.path, {
        waitUntil: "domcontentloaded"
      });
      expect(response, `${scenario.path}: direct response`).not.toBeNull();
      expect(response?.status()).toBeLessThan(400);
      expectRawServerMarker(await response!.text(), `${scenario.path}: direct`);
      await expectReadySaugeRoute(page, scenario);
      await page.waitForLoadState("load");

      const reloadResponse = await page.reload({ waitUntil: "domcontentloaded" });
      expect(reloadResponse, `${scenario.path}: reload response`).not.toBeNull();
      expect(reloadResponse?.status()).toBeLessThan(400);
      expectRawServerMarker(await reloadResponse!.text(), `${scenario.path}: reload`);
      await expectReadySaugeRoute(page, scenario);
      expectNoHealthFailures(health, `${scenario.path} at ${viewport.width}px`);

      await expectJavaScriptDisabledFirstPaint(
        browser,
        scenario.path,
        viewport,
        scenario.detail
      );
    });
  }
}

test("cleans and reapplies the Sauge theme during client transitions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const health = collectHealth(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  let theme = await readViewportTheme(page);
  expect(theme.themeColors).toEqual(["#080706"]);
  expect(theme.htmlBackground).toBe(dark);
  expect(theme.htmlColorScheme).toBe("dark");
  expect(theme.htmlRouteTheme).toBeNull();
  expect(theme.bodyRouteTheme).toBeNull();

  const enterSauge = async (sentinel: string) => {
    const link = page
      .getByTestId("landing-experiences")
      .locator('a[href^="/menu/sauge-noire"]')
      .first();
    await expect(link).toBeVisible();
    await link.evaluate((element) => element.removeAttribute("target"));
    await page.evaluate((value) => {
      (window as Window & { __vistaireSaugeTransition?: string })
        .__vistaireSaugeTransition = value;
    }, sentinel);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/menu/sauge-noire"),
      link.click()
    ]);
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __vistaireSaugeTransition?: string })
            .__vistaireSaugeTransition
      )
    ).toBe(sentinel);
    await expectReadySaugeRoute(page, routeScenarios[0]);
  };

  await enterSauge("first-entry");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expect(page.getByTestId("landing-experiences")).toBeVisible();
  await expect
    .poll(async () => {
      const landingTheme = await readViewportTheme(page);
      return {
        html: landingTheme.htmlRouteTheme,
        body: landingTheme.bodyRouteTheme,
        colorScheme: landingTheme.htmlColorScheme,
        background: landingTheme.htmlBackground
      };
    })
    .toEqual({ html: null, body: null, colorScheme: "dark", background: dark });

  await enterSauge("second-entry");
  theme = await readViewportTheme(page);
  expect(theme.htmlRouteTheme).toBe("sauge-noire");
  expect(theme.bodyRouteTheme).toBe("sauge-noire");
  expectNoHealthFailures(health, "landing to Sauge transition round trip");
});
