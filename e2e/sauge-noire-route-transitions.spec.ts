import { expect, test, type Locator, type Page } from "@playwright/test";

const MENU_ROUTE = "/menu/sauge-noire?view=sauge-4&lang=fr-CA&currency=CAD&table=main&zone=terrasse";
const DETAIL_ROUTE = "/menu/sauge-noire/dishes/canard-a-l-erable-noir?lang=fr-CA&currency=CAD&view=sauge-4&table=main&zone=terrasse";

type RouteTransitionSample = {
  actualPage: string | null;
  currentPage: string | null;
  destinationReady: boolean;
  engineState: string | null;
  overlay: boolean;
  pathname: string;
  phase: string | null;
  rendererHidden: boolean;
  settled: boolean;
  targetPage: string | null;
  targetReached: boolean;
  visibleBrandMarks: number;
  visibleEngines: number;
  visibleFallbacks: number;
};

type PageDiagnostics = {
  consoleErrors: string[];
  modelRequests: string[];
  networkErrors: string[];
  pageErrors: string[];
};

const pageDiagnostics = new WeakMap<Page, PageDiagnostics>();

test.beforeEach(async ({ page }) => {
  const diagnostics: PageDiagnostics = {
    consoleErrors: [],
    modelRequests: [],
    networkErrors: [],
    pageErrors: []
  };
  pageDiagnostics.set(page, diagnostics);
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/\.(?:glb|usdz)(?:[?#]|$)/i.test(request.url())) {
      diagnostics.modelRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      diagnostics.networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });
});

test.afterEach(async ({ page }) => {
  const diagnostics = pageDiagnostics.get(page);
  expect(diagnostics?.consoleErrors ?? [], "unexpected browser console errors").toEqual([]);
  expect(diagnostics?.pageErrors ?? [], "unexpected browser page errors").toEqual([]);
  expect(diagnostics?.networkErrors ?? [], "unexpected browser 4xx/5xx responses").toEqual([]);
  expect(
    diagnostics?.modelRequests ?? [],
    "3D assets must not load before explicit user intent"
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    "the mobile route must not overflow horizontally"
  ).toBe(true);
});

async function openRoute(page: Page, route: string, heading: RegExp) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
  if (response?.status() === 404 || body.includes("This page could not be found")) {
    throw new Error("Sauge Noire fixture setup failed: route returned 404.");
  }
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 15_000 });
}

async function activeMenuLink(page: Page, selector: string): Promise<Locator> {
  const pageIndex = await page.getByTestId("sauge-noire-book").getAttribute("data-page-index");
  if (!pageIndex) throw new Error("Expected the active Sauge Noire menu page");
  return page.locator(
    `[data-sauge-flip-page-index="${pageIndex}"]:not([data-sauge-flip-clone]) ${selector}`
  ).first();
}

async function dispatchPrimaryClick(link: Locator) {
  await link.dispatchEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0
  });
}

async function installRouteTransitionProbe(page: Page) {
  await page.evaluate(() => {
    const browserWindow = window as typeof window & {
      __saugeRouteTransitionObserver?: MutationObserver;
      __saugeRouteTransitionSamples?: RouteTransitionSample[];
    };
    browserWindow.__saugeRouteTransitionObserver?.disconnect();
    browserWindow.__saugeRouteTransitionSamples = [];

    const isVisible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const style = getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0;
    };
    const capture = () => {
      const overlay = document.querySelector<HTMLElement>(
        '[data-sauge-route-transition="true"]'
      );
      const renderer = document.querySelector<HTMLElement>(
        "[data-sauge-route-renderer-hidden]"
      );
      const engine = overlay?.querySelector<HTMLElement>("[data-page-flip-engine-state]");
      const sample: RouteTransitionSample = {
        actualPage: engine?.getAttribute("data-page-flip-actual-page") ?? null,
        currentPage:
          overlay?.getAttribute("data-sauge-route-transition-current-page") ??
          engine?.getAttribute("data-page-flip-current-page") ??
          null,
        destinationReady:
          renderer?.querySelector('[data-page-flip-state="ready"]') !== null,
        engineState: engine?.getAttribute("data-page-flip-engine-state") ?? null,
        overlay: overlay !== null,
        pathname: `${location.pathname}${location.search}`,
        phase: overlay?.getAttribute("data-sauge-route-transition-phase") ?? null,
        rendererHidden:
          renderer?.getAttribute("data-sauge-route-renderer-hidden") === "true" &&
          renderer.hasAttribute("inert") &&
          renderer.getAttribute("aria-hidden") === "true" &&
          getComputedStyle(renderer).visibility === "hidden",
        settled:
          overlay?.getAttribute("data-sauge-route-transition-settled") === "true",
        targetPage:
          overlay?.getAttribute("data-sauge-route-transition-target") ?? null,
        targetReached:
          overlay?.getAttribute("data-sauge-route-transition-target-reached") === "true",
        visibleBrandMarks: [
          ...document.querySelectorAll('[aria-label="Sauge Noire"]')
        ].filter(isVisible).length,
        visibleEngines: [...document.querySelectorAll(".stf__parent")].filter(isVisible).length,
        visibleFallbacks: [
          ...document.querySelectorAll("[data-page-flip-fallback]")
        ].filter(isVisible).length
      };
      const samples = browserWindow.__saugeRouteTransitionSamples!;
      const previous = samples.at(-1);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(sample)) {
        samples.push(sample);
      }
    };

    capture();
    const observer = new MutationObserver(capture);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        "aria-hidden",
        "class",
        "data-page-flip-actual-page",
        "data-page-flip-current-page",
        "data-page-flip-engine-state",
        "data-page-flip-state",
        "data-sauge-route-renderer-hidden",
        "data-sauge-route-transition-current-page",
        "data-sauge-route-transition-phase",
        "data-sauge-route-transition-settled",
        "data-sauge-route-transition-target-reached",
        "inert",
        "style"
      ]
    });
    browserWindow.__saugeRouteTransitionObserver = observer;
  });
}

async function assertRealRouteFlip(
  page: Page,
  initialUrl: string,
  destination: Locator
) {
  const transition = page.locator('[data-sauge-route-transition="true"]');
  await expect(transition).toBeVisible();
  await expect(transition).toHaveAttribute("aria-hidden", "true");
  expect(
    await transition.locator(".stf__item").evaluateAll((items) =>
      items.every((item) => getComputedStyle(item).pointerEvents === "none")
    )
  ).toBe(true);
  await expect(destination).toBeAttached();
  await expect(page).toHaveURL(initialUrl);

  const before = await transition.locator(".stf__item").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).transform)
  );
  await page.waitForTimeout(120);
  expect(page.url(), "the route must remain on the source during the flip").toBe(initialUrl);
  await expect
    .poll(
      async () => {
        const after = await transition.locator(".stf__item").evaluateAll((items) =>
          items.map((item) => getComputedStyle(item).transform)
        );
        const state = await transition
          .locator("[data-page-flip-engine-state]")
          .getAttribute("data-page-flip-engine-state");
        const flipStarted = await transition.getAttribute(
          "data-sauge-route-transition-flip-started"
        );
        return after.some((transform, index) => transform !== before[index]) ||
          state === "flipping" ||
          flipStarted === "true";
      },
      { timeout: 8_000, intervals: [40, 80, 120, 240] }
    )
    .toBe(true);

  await expect(transition).toHaveCount(0, { timeout: 15_000 });

  const samples = await page.evaluate(() => {
    const browserWindow = window as typeof window & {
      __saugeRouteTransitionObserver?: MutationObserver;
      __saugeRouteTransitionSamples?: RouteTransitionSample[];
    };
    browserWindow.__saugeRouteTransitionObserver?.disconnect();
    return browserWindow.__saugeRouteTransitionSamples ?? [];
  });
  const overlaySamples = samples.filter((sample) => sample.overlay);
  const target = overlaySamples[0]?.targetPage;
  if (target !== "0" && target !== "1") {
    throw new Error("Expected the route overlay target page");
  }
  const firstTargetIndex = samples.findIndex(
    (sample) =>
      sample.overlay &&
      sample.targetReached &&
      sample.currentPage === target &&
      sample.actualPage === target
  );
  expect(firstTargetIndex, "the route overlay must reach its target page").toBeGreaterThanOrEqual(0);

  const afterTarget = samples.slice(firstTargetIndex);
  expect(
    afterTarget.filter((sample) => sample.overlay).map((sample) => sample.currentPage),
    "the overlay must never request the start page after reaching the target"
  ).toEqual(
    afterTarget.filter((sample) => sample.overlay).map(() => target)
  );
  expect(
    afterTarget.filter((sample) => sample.overlay).map((sample) => sample.actualPage),
    "the real PageFlip index must never return to the start page after reaching the target"
  ).toEqual(
    afterTarget.filter((sample) => sample.overlay).map(() => target)
  );

  const engineStates = overlaySamples
    .map((sample) => sample.engineState)
    .filter((state, index, states) => state !== states[index - 1]);
  const phases = overlaySamples
    .map((sample) => sample.phase)
    .filter((phase, index, allPhases) => phase !== allPhases[index - 1]);
  expect(phases, "route transition phases must advance monotonically").toEqual([
    "preparing",
    "animating",
    "awaiting-destination"
  ]);
  expect(
    engineStates.filter((state) => state === "flipping"),
    "the route transition must enter flipping exactly once"
  ).toHaveLength(1);
  const firstFlipping = engineStates.indexOf("flipping");
  expect(
    engineStates.slice(firstFlipping + 1).filter((state) => state === "read"),
    "the route transition must return to read exactly once"
  ).toHaveLength(1);

  const awaitingSamples = overlaySamples.filter(
    (sample) => sample.phase === "awaiting-destination"
  );
  expect(awaitingSamples.length).toBeGreaterThan(0);
  expect(awaitingSamples.every((sample) => sample.currentPage === target)).toBe(true);

  const initialPath = new URL(initialUrl).pathname;
  expect(
    samples.some(
      (sample) => sample.overlay && new URL(sample.pathname, initialUrl).pathname !== initialPath
    ),
    "the overlay must remain mounted after the pathname changes"
  ).toBe(true);
  expect(
    samples.some(
      (sample) =>
        sample.overlay &&
        sample.rendererHidden &&
        sample.destinationReady &&
        new URL(sample.pathname, initialUrl).pathname !== initialPath
    ),
    "the real destination must be ready behind the overlay before handoff"
  ).toBe(true);
  expect(afterTarget.every((sample) => sample.visibleEngines === 1)).toBe(true);
  expect(
    afterTarget.map((sample) => sample.visibleBrandMarks),
    "exactly one SN brand mark must remain visible through handoff"
  ).toEqual(afterTarget.map(() => 1));
  expect(afterTarget.every((sample) => sample.visibleFallbacks === 0)).toBe(true);
  expect(
    afterTarget.every(
      (sample) =>
        (sample.overlay && sample.rendererHidden) ||
        (!sample.overlay && !sample.rendererHidden)
    ),
    "the overlay-to-route handoff must be atomic"
  ).toBe(true);

  const sourceUrl = new URL(initialUrl);
  const finalUrl = new URL(page.url());
  for (const parameter of ["lang", "currency", "view", "table", "zone"]) {
    expect(finalUrl.searchParams.get(parameter)).toBe(sourceUrl.searchParams.get(parameter));
  }
}

async function scrollActiveSheet(page: Page, amount: number) {
  await page.evaluate((target) => {
    const activePage = document.querySelector<HTMLElement>(
      '[data-page-flip-state="ready"] [data-sauge-flip-page-index]:not([data-sauge-flip-clone]):has(article)'
    );
    if (!activePage) throw new Error("Expected an active Sauge Noire sheet");
    activePage.scrollTop = Math.min(target, activePage.scrollHeight - activePage.clientHeight);
  }, amount);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 }
]) {
  test(`featured dish uses a real menu-to-detail page flip at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openRoute(page, MENU_ROUTE, /CANARD|SAUGE NOIRE/i);

    const link = await activeMenuLink(page, '[data-sauge-featured-dish]');
    const initialUrl = page.url();
    await installRouteTransitionProbe(page);
    await dispatchPrimaryClick(link);
    await assertRealRouteFlip(
      page,
      initialUrl,
      page.locator('[data-sauge-route-transition] article[data-transition-preview="true"]')
    );

    await expect(page).toHaveURL(/\/menu\/sauge-noire\/dishes\/canard-a-l-erable-noir/);
    await expect(page).toHaveURL(/lang=fr-CA/);
    await expect(page).toHaveURL(/currency=CAD/);
    await expect(page).toHaveURL(/table=main/);
    await expect(page).toHaveURL(/zone=terrasse/);
    await expect.poll(async () => {
      return page.locator(
        '[data-page-flip-state="ready"] [data-sauge-flip-page-index]:not([data-sauge-flip-clone])'
      ).filter({ has: page.locator('article:not([data-transition-preview="true"])') }).first().evaluate(
        (element) => element.scrollTop
      );
    }).toBe(0);
  });

  test(`dish row uses a real menu-to-detail page flip at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openRoute(page, MENU_ROUTE, /CANARD|SAUGE NOIRE/i);

    const link = await activeMenuLink(page, '[data-sauge-dish-row]');
    const initialUrl = page.url();
    const href = await link.getAttribute("href");
    await installRouteTransitionProbe(page);
    await dispatchPrimaryClick(link);
    await assertRealRouteFlip(
      page,
      initialUrl,
      page.locator('[data-sauge-route-transition] article[data-transition-preview="true"]')
    );
    await expect(page).toHaveURL(new RegExp(new URL(href!, "http://localhost").pathname));
  });

  test(`detail back links use a real reverse page flip at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openRoute(page, DETAIL_ROUTE, /CANARD/);
    await scrollActiveSheet(page, 360);

    const initialUrl = page.url();
    const backLink = page.locator(
      '[data-page-flip-state="ready"] [data-sauge-flip-page-index]:not([data-sauge-flip-clone]) article:not([data-transition-preview="true"]) a'
    ).first();
    await installRouteTransitionProbe(page);
    await dispatchPrimaryClick(backLink);
    await assertRealRouteFlip(
      page,
      initialUrl,
      page.locator('[data-sauge-route-transition] section[data-transition-preview="true"]')
    );
    await expect(page).toHaveURL(/\/menu\/sauge-noire\?/);
    await expect(page).toHaveURL(/view=sauge-4/);
    await expect(page.getByRole("heading", { name: /CANARD|SAUGE NOIRE/i }).first()).toBeVisible();
  });

  test(`La Carte uses the same reverse page flip at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openRoute(page, DETAIL_ROUTE, /CANARD/);
    await scrollActiveSheet(page, 360);

    const initialUrl = page.url();
    const menuLink = page.getByRole("link", { name: "La Carte" }).first();
    await installRouteTransitionProbe(page);
    await dispatchPrimaryClick(menuLink);
    await assertRealRouteFlip(
      page,
      initialUrl,
      page.locator('[data-sauge-route-transition] section[data-transition-preview="true"]')
    );
    await expect(page).toHaveURL(/view=sauge-4/);
  });
}

test("direct detail loading never creates a route transition overlay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, DETAIL_ROUTE, /CANARD/);
  await expect(page.locator('[data-sauge-route-transition="true"]')).toHaveCount(0);
});
