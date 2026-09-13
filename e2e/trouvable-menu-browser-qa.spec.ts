import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { privacyRejectedStorageState } from "./support/privacy-consent";

const BASE_ORIGIN = new URL(
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
).origin;
const MODEL_ASSET_RE =
  /\.(?:glb|usdz)(?:$|[?#])|model-viewer|babylon|three(?:\.module)?(?:\.min)?\.js|raw\.githubusercontent\.com/i;
const LOCAL_FONT_RESOURCE_RE =
  /\/_next\/static\/media\/[^/?#]+\.(?:woff2?|ttf|otf)(?:[?#].*)?$/i;
const HYDRATION_WARNING_RE =
  /hydration|hydrated|server[- ]rendered|server.*client|client.*server|did not match|content does not match|text content does not match/i;
const ERROR_OVERLAY_SELECTOR =
  "[data-nextjs-dialog], nextjs-portal, #webpack-dev-server-client-overlay, .vite-error-overlay";
const VIEWPORTS = [
  { name: "390px", size: { width: 390, height: 844 } },
  { name: "430px", size: { width: 430, height: 932 } },
  { name: "desktop", size: { width: 1440, height: 900 } }
] as const;

function collectBrowserQaSignals(
  page: Page,
  expectedFontAborts: ReadonlySet<string> = new Set()
) {
  const consoleSignals: string[] = [];
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];
  const failedRequests: string[] = [];
  const modelRequests: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      (message.type() === "warning" && HYDRATION_WARNING_RE.test(message.text()))
    ) {
      consoleSignals.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (MODEL_ASSET_RE.test(request.url())) modelRequests.push(request.url());
  });
  page.on("requestfailed", (request) => {
    if (expectedFontAborts.has(request.url())) return;
    failedRequests.push(
      `${request.failure()?.errorText ?? "request failed"} ${request.url()}`
    );
  });
  page.on("response", (response) => {
    if (
      new URL(response.url()).origin === BASE_ORIGIN &&
      response.status() >= 400
    ) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  return {
    consoleSignals,
    failedRequests,
    failedResponses,
    modelRequests,
    pageErrors
  };
}

async function settleFonts(page: Page) {
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => window.setTimeout(resolve, 5_000))
    ]);
  });
}

async function expectNoOverflow(page: Page, root: Locator, label: string) {
  const overflow = await page.evaluate(() => ({
    document:
      document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  const rootOverflow = await root.evaluate(
    (element) => element.scrollWidth - element.clientWidth
  );
  expect(overflow.document, `${label}: document overflow`).toBeLessThanOrEqual(2);
  expect(rootOverflow, `${label}: Trouvable root overflow`).toBeLessThanOrEqual(2);
}

async function expectLegibleText(
  locator: Locator,
  root: Locator,
  label: string
) {
  await locator.evaluate((element) => {
    element.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
  });
  await expect(locator, `${label}: visible text element`).toBeVisible();
  const measurement = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const root = element.closest(
      'main[data-menu-ui="trouvable"][data-public-menu-renderer="trouvable"]'
    )?.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
      rect: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      },
      root: root
        ? { left: root.left, right: root.right, top: root.top, bottom: root.bottom }
        : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      style: {
        display: style.display,
        visibility: style.visibility,
        opacity: Number.parseFloat(style.opacity),
        color: style.color,
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: Number.parseFloat(style.lineHeight),
        fontFamily: style.fontFamily,
        overflowX: style.overflowX,
        overflowY: style.overflowY
      },
      clientHeight: (element as HTMLElement).clientHeight,
      scrollHeight: (element as HTMLElement).scrollHeight
    };
  });

  expect(measurement.text, `${label}: non-empty text`).not.toBe("");
  expect(measurement.rect.width, `${label}: non-zero width`).toBeGreaterThan(0);
  expect(measurement.rect.height, `${label}: non-zero height`).toBeGreaterThan(0);
  expect(measurement.root, `${label}: contained by the Trouvable root`).not.toBeNull();
  expect(measurement.rect.left, `${label}: left viewport bound`).toBeGreaterThanOrEqual(-2);
  expect(measurement.rect.right, `${label}: right viewport bound`).toBeLessThanOrEqual(
    measurement.viewport.width + 2
  );
  expect(measurement.rect.top, `${label}: top viewport bound`).toBeGreaterThanOrEqual(-2);
  expect(measurement.rect.bottom, `${label}: bottom viewport bound`).toBeLessThanOrEqual(
    measurement.viewport.height + 2
  );
  expect(measurement.rect.left, `${label}: left root bound`).toBeGreaterThanOrEqual(
    (measurement.root?.left ?? 0) - 2
  );
  expect(measurement.rect.right, `${label}: right root bound`).toBeLessThanOrEqual(
    (measurement.root?.right ?? measurement.viewport.width) + 2
  );
  expect(measurement.style.display, `${label}: display`).not.toBe("none");
  expect(measurement.style.visibility, `${label}: visibility`).toBe("visible");
  expect(measurement.style.opacity, `${label}: opacity`).toBeGreaterThan(0);
  expect(measurement.style.color, `${label}: color`).not.toMatch(
    /rgba\([^)]*,\s*0(?:\.0+)?\)|transparent/i
  );
  expect(measurement.style.fontSize, `${label}: font size`).toBeGreaterThan(0);
  expect(measurement.style.lineHeight, `${label}: line height`).toBeGreaterThan(0);
  expect(measurement.clientHeight, `${label}: non-collapsed line box`).toBeGreaterThan(0);
  if (/^(?:clip|hidden)$/.test(measurement.style.overflowY)) {
    expect(
      measurement.scrollHeight,
      `${label}: a clipped text block must contain its line box`
    ).toBeLessThanOrEqual(measurement.clientHeight + 2);
  }
  return measurement.style.fontFamily;
}

function expectCleanSignals(
  signals: ReturnType<typeof collectBrowserQaSignals>,
  label: string
) {
  expect(signals.consoleSignals, `${label}: console/hydration`).toEqual([]);
  expect(signals.pageErrors, `${label}: page errors`).toEqual([]);
  expect(signals.failedResponses, `${label}: HTTP failures`).toEqual([]);
  expect(signals.failedRequests, `${label}: request failures`).toEqual([]);
  expect(signals.modelRequests, `${label}: eager model/runtime requests`).toEqual([]);
}

async function expectTrouvableGeometry(page: Page, label: string) {
  const root = page.locator(
    'main[data-menu-ui="trouvable"][data-public-menu-renderer="trouvable"][data-display-mode="public"]'
  );
  await expect(root).toBeVisible();
  const menuRegion = page.getByRole("region", {
    name: /Carte Trouvable|Trouvable menu/i
  });
  await expect(menuRegion).toBeVisible();
  await expect(menuRegion.getByRole("navigation")).toBeVisible();
  const results = page.locator("#trouvable-dish-results");
  await expect(results).toBeVisible();
  const firstDishControl = results.locator('button[aria-haspopup="dialog"]').first();
  await expect(firstDishControl).toBeVisible();

  await expectLegibleText(
    root.locator('strong[aria-label="Vistaire"]'),
    root,
    `${label}: brand`
  );
  const uiFont = await root.evaluate((element) => getComputedStyle(element).fontFamily);
  const displayFont = await expectLegibleText(
    page.locator("#trouvable-hero-title"),
    root,
    `${label}: hero heading`
  );
  await expectLegibleText(menuRegion.locator("h2").first(), root, `${label}: section heading`);
  await expectLegibleText(firstDishControl.locator("strong").first(), root, `${label}: first dish name`);
  await expectLegibleText(
    firstDishControl.locator('span[class*="dishPrice"]').first(),
    root,
    `${label}: first visible price`
  );

  expect(uiFont, `${label}: UI fallback stack`).toMatch(/Arial|sans-serif/i);
  expect(displayFont, `${label}: display fallback stack`).toMatch(/Georgia|serif/i);
  await expectNoOverflow(page, root, label);
  await expect(page.locator(ERROR_OVERLAY_SELECTOR)).toHaveCount(0);
}

async function configureExactLocalFontAbort(
  context: BrowserContext,
  expectedFontAborts: Set<string>
) {
  await context.route(LOCAL_FONT_RESOURCE_RE, async (route) => {
    const url = route.request().url();
    if (!LOCAL_FONT_RESOURCE_RE.test(url)) {
      await route.continue();
      return;
    }
    expectedFontAborts.add(url);
    await route.abort("failed");
  });
}

test.describe("Trouvable menu browser QA", () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps normal and local-font-blocked text legible at ${viewport.name}`, async ({
      browser,
      page
    }) => {
      await page.setViewportSize(viewport.size);
      const signals = collectBrowserQaSignals(page);
      const response = await page.goto("/menu/trouvable", {
        waitUntil: "domcontentloaded"
      });
      expect(response?.status()).toBeLessThan(400);
      await settleFonts(page);
      await expectTrouvableGeometry(page, `${viewport.name} normal`);
      expectCleanSignals(signals, `${viewport.name} normal`);

      const expectedFontAborts = new Set<string>();
      const context = await browser.newContext({
        storageState: privacyRejectedStorageState(BASE_ORIGIN),
        viewport: viewport.size
      });
      await configureExactLocalFontAbort(context, expectedFontAborts);
      const fallbackPage = await context.newPage();
      try {
        const fallbackSignals = collectBrowserQaSignals(
          fallbackPage,
          expectedFontAborts
        );
        const fallbackResponse = await fallbackPage.goto("/menu/trouvable", {
          waitUntil: "domcontentloaded"
        });
        expect(fallbackResponse?.status()).toBeLessThan(400);
        await settleFonts(fallbackPage);
        await expectTrouvableGeometry(
          fallbackPage,
          `${viewport.name} blocked local fonts`
        );

        for (const url of expectedFontAborts) {
          expect(url, `${viewport.name}: only exact local font resources are induced failures`)
            .toMatch(LOCAL_FONT_RESOURCE_RE);
        }
        expectCleanSignals(
          fallbackSignals,
          `${viewport.name} blocked local fonts`
        );
      } finally {
        await context.close();
      }
    });
  }
});
