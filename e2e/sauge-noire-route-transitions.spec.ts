import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertSaugeNoirePageIdentity } from "./support/sauge-noire-page-identity";

const MENU_ROUTE = "/menu/sauge-noire?view=sauge-4&lang=fr-CA&currency=CAD&table=main&zone=terrasse";
const DETAIL_ROUTE = "/menu/sauge-noire/dishes/canard-a-l-erable-noir?lang=fr-CA&currency=CAD&view=sauge-4&table=main&zone=terrasse";
const ROW_DETAIL_ROUTE =
  "/menu/sauge-noire/dishes/fletan-roti-au-nori?lang=fr-CA&currency=CAD&view=sauge-4&table=main&zone=terrasse";
const EN_CAD_MENU_ROUTE =
  "/menu/sauge-noire?view=sauge-2&lang=en&currency=CAD&table=main&zone=terrasse";

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
  timestamp: number;
  engineRect: RectSnapshot | null;
  headerRect: RectSnapshot | null;
  imageRect: RectSnapshot | null;
  logoRect: RectSnapshot | null;
  railRect: RectSnapshot | null;
  titleRect: RectSnapshot | null;
  visibleBrandMarks: number;
  visibleEngines: number;
  visibleFallbacks: number;
  visibleSettledSurfaces: number;
};

type RectSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
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
  // `router.prefetch()` intentionally performs no network work in `next dev`.
  // Compile both deterministic fixture destinations before timing the client
  // handoff so the 500 ms budget measures route/render readiness, not dev HMR.
  for (const fixtureRoute of [MENU_ROUTE, DETAIL_ROUTE, ROW_DETAIL_ROUTE]) {
    const warmResponse = await page.request.get(fixtureRoute);
    if (!warmResponse.ok()) {
      throw new Error(`Sauge Noire fixture warmup failed: ${warmResponse.status()}`);
    }
  }
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
  if (response?.status() === 404 || body.includes("This page could not be found")) {
    throw new Error("Sauge Noire fixture setup failed: route returned 404.");
  }
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 15_000 });
  await assertSaugeNoirePageIdentity(page, `initial route ${route}`);
}

async function activeMenuLink(page: Page, selector: string): Promise<Locator> {
  const pageIndex = await page.getByTestId("sauge-noire-book").getAttribute("data-page-index");
  if (!pageIndex) throw new Error("Expected the active Sauge Noire menu page");
  return page.locator(
    `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"][data-sauge-reading-page-index="${pageIndex}"] ${selector}`
  ).first();
}

async function dispatchPrimaryClick(link: Locator) {
  await link.dispatchEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0
  });
}

async function scrollRouteOwnerWithBrowserInput(
  page: Page,
  owner: Locator,
  browserName: string,
  amount: number
) {
  const initialScrollTop = await owner.evaluate((element) => element.scrollTop);
  if (browserName === "webkit") {
    await owner.evaluate((element) => {
      element.tabIndex = -1;
      element.focus();
    });
    const presses = Math.max(1, Math.ceil(amount / 40));
    for (let index = 0; index < presses; index += 1) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(24);
    }
  } else {
    await owner.hover();
    await page.mouse.wheel(0, amount);
  }
  await expect
    .poll(() => owner.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialScrollTop);
  await owner.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        let previous = element.scrollTop;
        let stableFrames = 0;
        const startedAt = performance.now();
        const sample = () => {
          const current = element.scrollTop;
          stableFrames = Math.abs(current - previous) < 0.5
            ? stableFrames + 1
            : 0;
          previous = current;
          if (stableFrames >= 4 || performance.now() - startedAt > 2_000) {
            resolve();
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      })
  );
  return owner.evaluate((element) => element.scrollTop);
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
    const rectSnapshot = (element: Element | null): RectSnapshot | null => {
      if (!element || !isVisible(element)) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    };
    const capture = () => {
      const overlay = document.querySelector<HTMLElement>(
        '[data-sauge-route-transition="true"]'
      );
      const renderer = document.querySelector<HTMLElement>(
        "[data-sauge-route-renderer-hidden]"
      );
      const engine = overlay?.querySelector<HTMLElement>("[data-page-flip-engine-state]");
      const settledSurface = overlay?.querySelector<HTMLElement>(
        '[data-sauge-route-settled-surface-visible="true"]'
      );
      const targetPage = overlay?.getAttribute("data-sauge-route-transition-target") ?? null;
      const destinationEngine =
        engine ??
        renderer?.querySelector<HTMLElement>('[data-page-flip-state="ready"]') ??
        null;
      const actualPage =
        destinationEngine?.getAttribute("data-page-flip-actual-page") ?? targetPage;
      const visualRoot = overlay ?? renderer ?? document.body;
      const canonicalSurface = visualRoot.querySelector<HTMLElement>(
        '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
      );
      const activeSheet =
        settledSurface ??
        canonicalSurface ??
        (actualPage === null
          ? null
          : visualRoot.querySelector<HTMLElement>(
              `[data-sauge-flip-page-index="${actualPage}"]:not([data-sauge-flip-clone])`
            ));
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
        targetPage,
        targetReached:
          overlay?.getAttribute("data-sauge-route-transition-target-reached") === "true",
        timestamp: performance.now(),
        engineRect: rectSnapshot(
          settledSurface ??
            canonicalSurface ??
            destinationEngine?.querySelector(".stf__parent") ??
            visualRoot.querySelector(".stf__parent")
        ),
        headerRect: rectSnapshot(activeSheet?.querySelector("header") ?? null),
        imageRect: rectSnapshot(
          activeSheet?.querySelector("article img, [data-photo-slot]") ?? null
        ),
        logoRect: rectSnapshot(
          activeSheet?.querySelector('[aria-label="Sauge Noire"]') ?? null
        ),
        railRect: rectSnapshot(visualRoot.querySelector('[data-sauge-book-rail="true"]')),
        titleRect: rectSnapshot(activeSheet?.querySelector("h1") ?? null),
        visibleBrandMarks: activeSheet
          ? [...activeSheet.querySelectorAll('[aria-label="Sauge Noire"]')].filter(isVisible).length
          : 0,
        visibleEngines: [...document.querySelectorAll(".stf__parent")].filter(isVisible).length,
        visibleFallbacks: [
          ...document.querySelectorAll("[data-page-flip-fallback]")
        ].filter(isVisible).length,
        visibleSettledSurfaces: [
          ...document.querySelectorAll(
            '[data-sauge-route-settled-surface-visible="true"]'
          )
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
        "data-sauge-route-settled-surface-visible",
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
  destination: Locator,
  duringAwaiting?: (transition: Locator) => Promise<void>
) {
  expect(page.url(), "the route must remain on the source before the flip").toBe(initialUrl);
  const transition = page.locator('[data-sauge-route-transition="true"]');
  await expect(transition).toBeVisible();
  await expect(transition).toHaveAttribute("aria-hidden", "true");
  expect(
    await transition.evaluate((overlay) => {
      const items = [...overlay.querySelectorAll<HTMLElement>(".stf__item")];
      const phase = overlay.getAttribute("data-sauge-route-transition-phase");
      const target = overlay.querySelector<HTMLElement>(
        '[data-sauge-route-scroll-owner="true"]'
      );
      const engine = overlay.querySelector<HTMLElement>(
        '[data-sauge-route-flip-engine="true"]'
      );
      const physicalPagesAreInert = items.every(
        (item) => getComputedStyle(item).pointerEvents === "none"
      );
      if (phase !== "awaiting-destination") {
        return target === null && physicalPagesAreInert;
      }
      return (
        target !== null &&
        getComputedStyle(target).pointerEvents === "auto" &&
        engine?.getAttribute("data-sauge-route-flip-engine-visible") === "false" &&
        physicalPagesAreInert
      );
    })
  ).toBe(true);
  await expect(destination.first()).toBeAttached();

  const before = await transition.locator(".stf__item").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).transform)
  );
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

  if (duringAwaiting) {
    await expect(transition).toHaveAttribute(
      "data-sauge-route-transition-phase",
      "awaiting-destination",
      { timeout: 10_000 }
    );
    await duringAwaiting(transition);
  }

  try {
    await expect(transition).toHaveCount(0, { timeout: 15_000 });
  } catch (error) {
    const handoffState = await page.evaluate(() => {
      const overlay = document.querySelector<HTMLElement>(
        '[data-sauge-route-transition="true"]'
      );
      const renderer = document.querySelector<HTMLElement>(
        '[data-sauge-route-renderer-hidden="true"]'
      );
      const viewport = renderer?.querySelector<HTMLElement>("[data-page-flip-state]");
      const actualPage = viewport?.getAttribute("data-page-flip-actual-page") ?? null;
      const activePage =
        renderer?.querySelector<HTMLElement>(
          '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
        ) ?? null;
      return {
        overlay: {
          phase: overlay?.getAttribute("data-sauge-route-transition-phase") ?? null,
          settled: overlay?.getAttribute("data-sauge-route-transition-settled") ?? null,
          targetReached:
            overlay?.getAttribute("data-sauge-route-transition-target-reached") ?? null
        },
        renderer: {
          hidden: renderer?.getAttribute("data-sauge-route-renderer-hidden") ?? null,
          pathname: `${location.pathname}${location.search}`
        },
        viewport: {
          state: viewport?.getAttribute("data-page-flip-state") ?? null,
          engineState: viewport?.getAttribute("data-page-flip-engine-state") ?? null,
          currentPage: viewport?.getAttribute("data-page-flip-current-page") ?? null,
          actualPage
        },
        activePage: activePage
          ? {
              connected: activePage.isConnected,
              scrollTop: activePage.scrollTop,
              clientHeight: activePage.clientHeight,
              scrollHeight: activePage.scrollHeight,
              images: [...activePage.querySelectorAll<HTMLImageElement>("img")].map((image) => {
                const rect = image.getBoundingClientRect();
                return {
                  complete: image.complete,
                  naturalWidth: image.naturalWidth,
                  rect: { width: rect.width, height: rect.height },
                  src: image.currentSrc || image.src
                };
              })
            }
          : null
      };
    });
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
      `Sauge Noire handoff state: ${JSON.stringify(handoffState)}`
    );
  }
  await assertSaugeNoirePageIdentity(page, `route handoff from ${initialUrl}`);

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
      (sample.actualPage === target || sample.targetReached)
  );
  expect(firstTargetIndex, "the route overlay must reach its target page").toBeGreaterThanOrEqual(0);

  const firstOverlayIndex = samples.findIndex((sample) => sample.overlay);
  const transitionTimeline = samples.slice(firstOverlayIndex);
  const afterTarget = samples.slice(firstTargetIndex);
  const sourceUrl = new URL(initialUrl);
  const sourceLocation = `${sourceUrl.pathname}${sourceUrl.search}`;
  expect(
    overlaySamples
      .filter((sample) => sample.phase === "preparing" || sample.phase === "animating")
      .every((sample) => sample.pathname === sourceLocation),
    "the route must remain on the source until PageFlip reaches read"
  ).toBe(true);
  expect(
    afterTarget.filter((sample) => sample.overlay).map((sample) => sample.currentPage),
    "the overlay must never request the start page after reaching the target"
  ).toEqual(
    afterTarget.filter((sample) => sample.overlay).map(() => target)
  );
  const firstReportedTargetIndex = samples.findIndex(
    (sample) => sample.overlay && sample.actualPage === target
  );
  if (firstReportedTargetIndex >= 0) {
    const afterReportedTarget = samples.slice(firstReportedTargetIndex);
    expect(
      afterReportedTarget
        .filter((sample) => sample.overlay)
        .map((sample) => sample.actualPage),
      "the real PageFlip index must never return to the start page after reaching the target"
    ).toEqual(
      afterReportedTarget.filter((sample) => sample.overlay).map(() => target)
    );
  }

  const engineStates = overlaySamples
    .map((sample) => sample.engineState)
    .filter((state, index, states) => state !== states[index - 1]);
  const phases = overlaySamples
    .map((sample) => sample.phase)
    .filter((phase, index, allPhases) => phase !== allPhases[index - 1]);
  const phaseOrder = ["preparing", "animating", "awaiting-destination"];
  expect(phases.at(0), "the transition must start in preparing").toBe("preparing");
  expect(phases.at(-1), "the transition must end in awaiting-destination").toBe(
    "awaiting-destination"
  );
  expect(
    phases.every(
      (phase, index) =>
        phase !== null &&
        phaseOrder.indexOf(phase) >=
          phaseOrder.indexOf(phases[index - 1] ?? "preparing")
    ),
    "observed route transition phases must never move backwards"
  ).toBe(true);
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
  expect(
    transitionTimeline.every((sample) => {
      if (!sample.overlay) {
        return sample.visibleEngines === 0 && sample.visibleSettledSurfaces === 0;
      }
      if (sample.phase === "awaiting-destination") {
        return sample.visibleEngines === 0 && sample.visibleSettledSurfaces === 1;
      }
      if (sample.phase === "animating") {
        return sample.visibleEngines === 1 && sample.visibleSettledSurfaces === 0;
      }
      return sample.visibleEngines === 0 && sample.visibleSettledSurfaces === 0;
    }),
    "PageFlip must own animation only; the settled surface must own awaiting-destination"
  ).toBe(true);
  expect(
    transitionTimeline.every((sample) => sample.visibleBrandMarks <= 1),
    "the active PageFlip sheet must never expose duplicate SN brand marks"
  ).toBe(true);
  expect(
    transitionTimeline.some((sample) => sample.visibleBrandMarks === 1),
    "the active PageFlip sheet must expose its SN brand mark"
  ).toBe(true);
  expect(transitionTimeline.every((sample) => sample.visibleFallbacks === 0)).toBe(true);
  expect(
    afterTarget.every(
      (sample) =>
        (sample.overlay && sample.rendererHidden) ||
        (!sample.overlay && !sample.rendererHidden)
    ),
    "the overlay-to-route handoff must be atomic"
  ).toBe(true);

  const firstSettledSample = samples.find(
    (sample) =>
      sample.overlay &&
      sample.settled &&
      (sample.actualPage === target || sample.targetReached)
  );
  const finalOverlaySample = samples.findLast(
    (sample) =>
      sample.overlay &&
      sample.settled &&
      (sample.actualPage === target || sample.targetReached)
  );
  const firstDestinationSample = samples.find(
    (sample) =>
      firstSettledSample !== undefined &&
      !sample.overlay &&
      sample.timestamp >= firstSettledSample.timestamp
  );
  if (!firstSettledSample || !finalOverlaySample || !firstDestinationSample) {
    throw new Error("Expected settled overlay and first destination frame samples");
  }
  expect(
    firstDestinationSample.timestamp,
    "the destination frame must follow the settled overlay"
  ).toBeGreaterThanOrEqual(firstSettledSample.timestamp);

  const expectRectContinuity = (
    label: string,
    before: RectSnapshot | null,
    after: RectSnapshot | null
  ) => {
    expect(before, `${label} must exist on the final overlay frame`).not.toBeNull();
    expect(after, `${label} must exist on the first destination frame`).not.toBeNull();
    for (const field of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs(before![field] - after![field]),
        `${label}.${field} must remain within one CSS pixel at handoff`
      ).toBeLessThanOrEqual(1);
    }
  };
  expectRectContinuity(
    "PageFlip engine",
    finalOverlaySample.engineRect,
    firstDestinationSample.engineRect
  );
  expectRectContinuity("rail", finalOverlaySample.railRect, firstDestinationSample.railRect);
  expectRectContinuity("title", finalOverlaySample.titleRect, firstDestinationSample.titleRect);
  expectRectContinuity("image", finalOverlaySample.imageRect, firstDestinationSample.imageRect);
  if (finalOverlaySample.headerRect || firstDestinationSample.headerRect) {
    expectRectContinuity(
      "header",
      finalOverlaySample.headerRect,
      firstDestinationSample.headerRect
    );
  }
  if (finalOverlaySample.logoRect || firstDestinationSample.logoRect) {
    expectRectContinuity(
      "SN logo",
      finalOverlaySample.logoRect,
      firstDestinationSample.logoRect
    );
  }

  const finalUrl = new URL(page.url());
  for (const parameter of ["lang", "currency", "view", "table", "zone"]) {
    expect(finalUrl.searchParams.get(parameter)).toBe(sourceUrl.searchParams.get(parameter));
  }
  await expect
    .poll(() =>
      page.evaluate(() => {
        const activeElement = document.activeElement;
        return activeElement?.matches(
          '[data-sauge-route-renderer-hidden="false"] h1, [data-sauge-route-renderer-hidden="false"] h2'
        ) ?? false;
      })
    )
    .toBe(true);
}

async function scrollActiveSheet(page: Page, amount: number) {
  await page.evaluate((target) => {
    const activePage = document.querySelector<HTMLElement>(
      '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]:has(article)'
    );
    if (!activePage) throw new Error("Expected an active Sauge Noire sheet");
    activePage.scrollTop = Math.min(target, activePage.scrollHeight - activePage.clientHeight);
  }, amount);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 900 }
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
        '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
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
      '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] article:not([data-transition-preview="true"]) a'
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

test("a broken main image cannot lock the atomic route handoff", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const failedDishImageRequests: string[] = [];
  page.on("requestfailed", (request) => {
    if (request.url().includes("/images/demo/dishes/")) {
      failedDishImageRequests.push(request.url());
    }
  });
  await page.route("**/images/demo/dishes/**", (route) => route.abort());
  await openRoute(page, MENU_ROUTE, /CANARD|SAUGE NOIRE/i);

  const link = await activeMenuLink(page, "[data-sauge-featured-dish]");
  const initialUrl = page.url();
  await installRouteTransitionProbe(page);
  await dispatchPrimaryClick(link);
  await assertRealRouteFlip(
    page,
    initialUrl,
    page.locator('[data-sauge-route-transition] article[data-transition-preview="true"]')
  );
  const diagnostics = pageDiagnostics.get(page);
  const expectedImageErrors = diagnostics?.consoleErrors.splice(0) ?? [];
  expect(
    failedDishImageRequests.length,
    "the broken-image fixture must exercise an image request failure"
  )
    .toBeGreaterThan(0);
  expect(
    expectedImageErrors.every((message) =>
      message === "Failed to load resource: net::ERR_FAILED"
    ),
    "the broken-image fixture must not hide unrelated console failures"
  ).toBe(true);
  await expect(page).toHaveURL(/\/menu\/sauge-noire\/dishes\/canard-a-l-erable-noir/);
});

test("frame polling observes an image that becomes complete without a DOM mutation", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, MENU_ROUTE, /CANARD|SAUGE NOIRE/i);
  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "complete"
    );
    if (!descriptor?.get || !descriptor.configurable) {
      throw new Error("Expected a configurable HTMLImageElement.complete getter");
    }
    const state = {
      holding: true,
      released: false,
      started: false,
      releaseScheduled: false,
      overlayAtRelease: false,
      startedPathname: null as string | null
    };
    const originalGetter = descriptor.get;
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      ...descriptor,
      get() {
        if (
          state.holding &&
          location.pathname ===
            "/menu/sauge-noire/dishes/canard-a-l-erable-noir" &&
          document
            .querySelector('[data-sauge-route-transition="true"]')
            ?.getAttribute("data-sauge-route-transition-phase") ===
            "awaiting-destination" &&
          this.closest('[data-sauge-route-renderer-hidden="true"]')
        ) {
          state.started = true;
          state.startedPathname = location.pathname;
          if (!state.releaseScheduled) {
            state.releaseScheduled = true;
            window.setTimeout(() => {
              state.holding = false;
              state.released = true;
              state.overlayAtRelease = Boolean(
                document.querySelector('[data-sauge-route-transition="true"]')
              );
              Object.defineProperty(
                HTMLImageElement.prototype,
                "complete",
                descriptor
              );
            }, 600);
          }
          return false;
        }
        return originalGetter.call(this);
      }
    });
    (window as typeof window & { __saugeLateImageState?: typeof state })
      .__saugeLateImageState = state;
  });

  const link = await activeMenuLink(page, "[data-sauge-featured-dish]");
  const initialUrl = page.url();
  await installRouteTransitionProbe(page);
  await dispatchPrimaryClick(link);
  await assertRealRouteFlip(
    page,
    initialUrl,
    page.locator('[data-sauge-route-transition] article[data-transition-preview="true"]')
  );
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & {
          __saugeLateImageState?: {
            overlayAtRelease: boolean;
            released: boolean;
            started: boolean;
            startedPathname: string | null;
          };
        }).__saugeLateImageState
    )
  ).toMatchObject({
    overlayAtRelease: true,
    released: true,
    started: true,
    startedPathname: "/menu/sauge-noire/dishes/canard-a-l-erable-noir"
  });
});

test("frame polling corrects a late hidden destination scroll mismatch", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, MENU_ROUTE, /CANARD|SAUGE NOIRE/i);
  await page.evaluate(() => {
    const state = {
      started: false,
      startedPageIndex: null as string | null,
      startedPathname: null as string | null
    };
    const injectDestinationMismatch = () => {
      const overlay = document.querySelector<HTMLElement>(
        '[data-sauge-route-transition="true"]'
      );
      const destinationCommitted =
        location.pathname ===
          "/menu/sauge-noire/dishes/canard-a-l-erable-noir" &&
        overlay?.getAttribute("data-sauge-route-transition-phase") ===
          "awaiting-destination";
      const activePage = document.querySelector<HTMLElement>(
        '[data-sauge-route-renderer-hidden="true"] [data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
      );
      if (destinationCommitted && activePage) {
        state.started = true;
        state.startedPageIndex =
          activePage.getAttribute("data-sauge-reading-page-index");
        state.startedPathname = location.pathname;
        activePage.scrollTop = 48;
        return;
      }
      requestAnimationFrame(injectDestinationMismatch);
    };
    requestAnimationFrame(injectDestinationMismatch);
    (window as typeof window & { __saugeLateScrollState?: typeof state })
      .__saugeLateScrollState = state;
  });

  const link = await activeMenuLink(page, "[data-sauge-featured-dish]");
  const initialUrl = page.url();
  await installRouteTransitionProbe(page);
  await dispatchPrimaryClick(link);
  await assertRealRouteFlip(
    page,
    initialUrl,
    page.locator('[data-sauge-route-transition] article[data-transition-preview="true"]')
  );
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & {
          __saugeLateScrollState?: {
            started: boolean;
            startedPageIndex: string | null;
            startedPathname: string | null;
          };
        }).__saugeLateScrollState
    )
  ).toMatchObject({
    started: true,
    startedPageIndex: "1",
    startedPathname: "/menu/sauge-noire/dishes/canard-a-l-erable-noir"
  });
  expect(
    await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>(
        '[data-page-flip-state="ready"]'
      );
      return viewport
        ?.querySelector<HTMLElement>(
          '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
        )
        ?.scrollTop ?? -1;
    })
  ).toBe(0);
});

for (const slowTransition of [
  {
    name: "forward",
    route: MENU_ROUTE,
    heading: /CANARD|SAUGE NOIRE/i,
    destinationPathname: "/menu/sauge-noire/dishes/canard-a-l-erable-noir",
    destinationPreview: 'article[data-transition-preview="true"]',
    link: async (page: Page) => activeMenuLink(page, "[data-sauge-featured-dish]")
  },
  {
    name: "reverse",
    route: DETAIL_ROUTE,
    heading: /CANARD/i,
    destinationPathname: "/menu/sauge-noire",
    destinationPreview: 'section[data-transition-preview="true"]',
    link: async (page: Page) =>
      page
        .locator(
          '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] article:not([data-transition-preview="true"]) a'
        )
        .first()
  }
]) {
  test(`slow RSC keeps the ${slowTransition.name} destination preview scrollable and preserves its scroll`, async ({
    browserName,
    page
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, slowTransition.route, slowTransition.heading);
    await page.evaluate(() => document.fonts.ready);
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const isDestinationRsc =
        url.pathname === slowTransition.destinationPathname &&
        (url.searchParams.has("_rsc") || request.headers().rsc === "1");
      if (!isDestinationRsc) {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      await route.continue();
    });

    const link = await slowTransition.link(page);
    const initialUrl = page.url();
    let previewScrollTop = 0;
    let animatedTypography: Record<string, Record<string, string>> = {};
    let previewTypography: Record<string, Record<string, string>> = {};
    await installRouteTransitionProbe(page);
    await dispatchPrimaryClick(link);
    const routeTransition = page.locator(
      '[data-sauge-route-transition="true"]'
    );
    await expect
      .poll(() =>
        routeTransition.getAttribute("data-sauge-route-transition-phase")
      )
      .toMatch(/^(?:animating|awaiting-destination)$/);
    await expect(routeTransition).toHaveAttribute(
      "data-sauge-route-transition-flip-started",
      "true"
    );
    animatedTypography = await routeTransition
      .locator(
        '[data-sauge-route-flip-engine="true"] [data-sauge-page-origin="react-original"]'
      )
      .filter({ has: page.locator(slowTransition.destinationPreview) })
      .first()
      .evaluate((element) =>
        Object.fromEntries(
          [
            ...element.querySelectorAll<HTMLElement>(
              "[data-sauge-typography-role]"
            )
          ].map((node) => {
            const style = getComputedStyle(node);
            return [
              node.dataset.saugeTypographyRole ?? "",
              {
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                fontStyle: style.fontStyle,
                fontWeight: style.fontWeight,
                letterSpacing: style.letterSpacing,
                lineHeight: style.lineHeight
              }
            ];
          })
        )
      );
    expect(Object.keys(animatedTypography).length).toBeGreaterThanOrEqual(2);
    await assertRealRouteFlip(
      page,
      initialUrl,
      page.locator(
        `[data-sauge-route-transition] ${slowTransition.destinationPreview}`
      ),
      async (transition) => {
        await expect(transition).toHaveAttribute(
          "data-sauge-route-transition-scrollable",
          "true"
        );
        await expect(transition).not.toHaveAttribute("inert", "");
        const target = transition.locator(
          '[data-sauge-route-scroll-owner="true"]'
        );
        await expect(target).toBeAttached();
        expect(
          await target.locator(":scope > *").evaluateAll((children) =>
            children.every((child) => !child.hasAttribute("inert"))
          )
        ).toBe(true);
        expect(
          await target
            .locator("a, button, input, select, textarea")
            .evaluateAll((controls) =>
              controls.every(
                (control) =>
                  getComputedStyle(control as HTMLElement).pointerEvents === "none"
              )
            )
        ).toBe(true);
        const beforeState = await target.evaluate((element) => {
          const measurable = (selector: string) =>
            [...element.querySelectorAll<HTMLElement>(selector)].find((node) => {
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }) ?? null;
          const title = measurable("h1");
          const image = measurable("img");
          const price = measurable('[data-sauge-visible-price="true"]');
          const description =
            measurable(
              '[class*="description"], [data-sauge-featured-dish] p'
            ) ?? measurable('[data-sauge-dish-row="true"]');
          const ownerRect = element.getBoundingClientRect();
          const originalScrollTop = element.scrollTop;
          const probe = (role: string, node: HTMLElement | null) => {
            if (!node) {
              return {
                role,
                present: false,
                topmostBelongsToOwner: false,
                ownerInStack: false
              };
            }
            const initialRect = node.getBoundingClientRect();
            const ownerCenter = ownerRect.top + ownerRect.height / 2;
            const initialCenter = initialRect.top + initialRect.height / 2;
            if (
              initialCenter < ownerRect.top ||
              initialCenter > ownerRect.bottom
            ) {
              element.scrollTop += initialCenter - ownerCenter;
            }
            const rect = node.getBoundingClientRect();
            const point = {
              x: Math.min(ownerRect.right - 2, Math.max(ownerRect.left + 2, rect.left + rect.width / 2)),
              y: Math.min(ownerRect.bottom - 2, Math.max(ownerRect.top + 2, rect.top + rect.height / 2))
            };
            const stack = document.elementsFromPoint(point.x, point.y);
            const topmost = document.elementFromPoint(point.x, point.y);
            const firstDestinationOwner = stack
              .map((node) =>
                node.closest<HTMLElement>(
                  '[data-sauge-route-scroll-owner="true"]'
                )
              )
              .find(Boolean);
            return {
              role,
              present: true,
              topmostBelongsToOwner:
                topmost === element || (topmost !== null && element.contains(topmost)),
              ownerInStack:
                firstDestinationOwner === element && stack.includes(element)
            };
          };
          const hitTests = [
            probe("title", title),
            probe("image", image),
            probe("description", description),
            probe("paper", element as HTMLElement)
          ];
          element.scrollTop = originalScrollTop;
          const backgroundScrollTops = [
            ...document.querySelectorAll<HTMLElement>(
              '[data-sauge-route-renderer-hidden="true"] [data-sauge-page-origin="react-original"], [data-sauge-route-renderer-hidden="true"] [data-sauge-reading-surface="true"], [data-sauge-route-flip-engine-visible="false"] [data-sauge-page-origin="react-original"], [data-sauge-route-flip-engine-visible="false"] [data-sauge-reading-surface="true"]'
            )
          ].map((node, index) => ({
            key:
              node.getAttribute("data-sauge-page-instance-id") ??
              `${node.getAttribute("data-sauge-flip-page-index") ?? "unknown"}-${index}`,
            scrollTop: node.scrollTop
          }));
          return {
            titleTop: title?.getBoundingClientRect().top ?? null,
            imageTop: image?.getBoundingClientRect().top ?? null,
            priceTop: price?.getBoundingClientRect().top ?? null,
            descriptionTop: description?.getBoundingClientRect().top ?? null,
            scrollTop: element.scrollTop,
            hitTests,
            backgroundScrollTops
          };
        });
        expect(beforeState.hitTests.every((result) => result.present)).toBe(true);
        expect(
          beforeState.hitTests.every(
            (result) => result.topmostBelongsToOwner && result.ownerInStack
          )
        ).toBe(true);
        previewTypography = await target.evaluate((element) =>
          Object.fromEntries(
            [
              ...element.querySelectorAll<HTMLElement>(
                "[data-sauge-typography-role]"
              )
            ].map((node) => {
              const style = getComputedStyle(node);
              return [
                node.dataset.saugeTypographyRole ?? "",
                {
                  fontFamily: style.fontFamily,
                  fontSize: style.fontSize,
                  fontStyle: style.fontStyle,
                  fontWeight: style.fontWeight,
                  letterSpacing: style.letterSpacing,
                  lineHeight: style.lineHeight
                }
              ];
            })
          )
        );
        expect(previewTypography).toEqual(animatedTypography);
        await scrollRouteOwnerWithBrowserInput(
          page,
          target,
          browserName,
          320
        );
        const afterState = await target.evaluate((element) => {
          const measurable = (selector: string) =>
            [...element.querySelectorAll<HTMLElement>(selector)].find((node) => {
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }) ?? null;
          const title = measurable("h1");
          const image = measurable("img");
          const price = measurable('[data-sauge-visible-price="true"]');
          const description =
            measurable(
              '[class*="description"], [data-sauge-featured-dish] p'
            ) ?? measurable('[data-sauge-dish-row="true"]');
          return {
            titleTop: title?.getBoundingClientRect().top ?? null,
            imageTop: image?.getBoundingClientRect().top ?? null,
            priceTop: price?.getBoundingClientRect().top ?? null,
            descriptionTop: description?.getBoundingClientRect().top ?? null,
            scrollTop: element.scrollTop,
            windowScrollY: window.scrollY,
            documentScrollTop: document.documentElement.scrollTop,
            bodyScrollTop: document.body.scrollTop,
            backgroundScrollTops: [
              ...document.querySelectorAll<HTMLElement>(
                '[data-sauge-route-renderer-hidden="true"] [data-sauge-page-origin="react-original"], [data-sauge-route-renderer-hidden="true"] [data-sauge-reading-surface="true"], [data-sauge-route-flip-engine-visible="false"] [data-sauge-page-origin="react-original"], [data-sauge-route-flip-engine-visible="false"] [data-sauge-reading-surface="true"]'
              )
            ].map((node, index) => ({
              key:
                node.getAttribute("data-sauge-page-instance-id") ??
                `${node.getAttribute("data-sauge-flip-page-index") ?? "unknown"}-${index}`,
              scrollTop: node.scrollTop
            }))
          };
        });
        const scrollDelta = afterState.scrollTop - beforeState.scrollTop;
        expect(scrollDelta).toBeGreaterThan(0);
        for (const key of [
          "titleTop",
          "imageTop",
          "priceTop",
          "descriptionTop"
        ] as const) {
          expect(beforeState[key]).not.toBeNull();
          expect(afterState[key]).not.toBeNull();
          expect(
            Math.abs(
              ((beforeState[key] as number) - (afterState[key] as number)) -
                scrollDelta
            ),
            `${key} must move with the canonical scroll owner`
          ).toBeLessThanOrEqual(3);
        }
        expect(afterState.windowScrollY).toBe(0);
        expect(afterState.documentScrollTop).toBe(0);
        expect(afterState.bodyScrollTop).toBe(0);
        expect(afterState.backgroundScrollTops).toEqual(
          beforeState.backgroundScrollTops
        );
        const maxScroll = await target.evaluate((element) => {
          for (let index = 0; index < 3; index += 1) {
            element.scrollBy({ top: element.scrollHeight * 2 });
          }
          const firstBottom = element.scrollTop;
          element.scrollBy({ top: element.scrollHeight * 2 });
          return {
            max: Math.max(0, element.scrollHeight - element.clientHeight),
            scrollTop: element.scrollTop,
            firstBottom,
            windowScrollY: window.scrollY,
            documentScrollTop: document.documentElement.scrollTop,
            bodyScrollTop: document.body.scrollTop
          };
        });
        expect(maxScroll.scrollTop).toBeGreaterThanOrEqual(0);
        expect(maxScroll.scrollTop).toBeLessThanOrEqual(maxScroll.max + 1);
        expect(Math.abs(maxScroll.scrollTop - maxScroll.max)).toBeLessThanOrEqual(1);
        expect(maxScroll.scrollTop).toBe(maxScroll.firstBottom);
        expect(maxScroll.windowScrollY).toBe(0);
        expect(maxScroll.documentScrollTop).toBe(0);
        expect(maxScroll.bodyScrollTop).toBe(0);
        previewScrollTop = await target.evaluate((element) => element.scrollTop);
      }
    );

    const destinationState = await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>(
        '[data-page-flip-state="ready"]'
      );
      const activePage = viewport?.querySelector<HTMLElement>(
        '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
      );
      const typography = activePage
        ? Object.fromEntries(
            [
              ...activePage.querySelectorAll<HTMLElement>(
                "[data-sauge-typography-role]"
              )
            ].map((node) => {
              const style = getComputedStyle(node);
              return [
                node.dataset.saugeTypographyRole ?? "",
                {
                  fontFamily: style.fontFamily,
                  fontSize: style.fontSize,
                  fontStyle: style.fontStyle,
                  fontWeight: style.fontWeight,
                  letterSpacing: style.letterSpacing,
                  lineHeight: style.lineHeight
                }
              ];
            })
          )
        : {};
      return {
        scrollTop: activePage?.scrollTop ?? -1,
        typography
      };
    });
    expect(
      Math.abs(destinationState.scrollTop - previewScrollTop)
    ).toBeLessThanOrEqual(1);
    expect(destinationState.typography).toEqual(previewTypography);
  });
}

test("an immediate dish tap after CAD to EUR keeps one canonical currency snapshot", async ({
  browserName,
  page
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, EN_CAD_MENU_ROUTE, /BETTERAVE|FIRST|GESTES|SAUGE NOIRE/i);
  let delayMenuRsc = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isRsc = url.searchParams.has("_rsc") || request.headers().rsc === "1";
    const isDestinationRsc =
      ((url.pathname.includes("/menu/sauge-noire/dishes/") && !delayMenuRsc) ||
        (url.pathname === "/menu/sauge-noire" && delayMenuRsc)) &&
      isRsc;
    if (isDestinationRsc) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
    await route.continue();
  });

  const pageIndex = await page
    .getByTestId("sauge-noire-book")
    .getAttribute("data-page-index");
  if (!pageIndex) throw new Error("Expected an active Sauge Noire page");
  const activePage = page.locator(
    `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"][data-sauge-reading-page-index="${pageIndex}"]`
  );
  await activePage.getByRole("button", { name: "Devise: CAD" }).click();
  const euroOption = activePage.getByRole("menuitemradio", { name: "EUR" });
  await expect(euroOption).toBeVisible();
  await euroOption.evaluate((option) => {
    const browserWindow = window as typeof window & {
      __saugeCurrencySamples?: Array<{
        currencies: string[];
        layers: string[];
        prices: string[];
      }>;
      __saugeStopCurrencySamples?: boolean;
    };
    option.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    );
    requestAnimationFrame(() => {
      browserWindow.__saugeCurrencySamples = [];
      browserWindow.__saugeStopCurrencySamples = false;
      const sample = () => {
        const visible = (element: HTMLElement) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const cssVisible =
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.right > 0 &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.top < window.innerHeight &&
            !element.closest('[data-sauge-route-renderer-hidden="true"]') &&
            !element.closest('[data-sauge-route-settled-surface-visible="false"]') &&
            !element.closest('[data-sauge-route-flip-engine-visible="false"]');
          if (!cssVisible) return false;
          const points = [
            [rect.left + rect.width / 2, rect.top + rect.height / 2],
            [rect.left + 2, rect.top + 2],
            [rect.right - 2, rect.top + 2],
            [rect.left + 2, rect.bottom - 2],
            [rect.right - 2, rect.bottom - 2]
          ];
          return points.some(([x, y]) => {
            const px = Math.min(window.innerWidth - 1, Math.max(0, x));
            const py = Math.min(window.innerHeight - 1, Math.max(0, y));
            return document
              .elementsFromPoint(px, py)
              .some((painted) => painted === element || element.contains(painted));
          });
        };
        const currencyNodes = [
          ...document.querySelectorAll<HTMLElement>(
            "[data-rendered-currency], [data-active-currency]"
          )
        ].filter(visible);
        browserWindow.__saugeCurrencySamples?.push({
          currencies: currencyNodes
            .map(
              (node) =>
                node.getAttribute("data-rendered-currency") ??
                node.getAttribute("data-active-currency") ??
                ""
            )
            .filter(Boolean),
          layers: currencyNodes.map((node) => {
            const pageLayer = node.closest<HTMLElement>(
              "[data-sauge-page-origin], [data-sauge-route-scroll-owner], [data-sauge-route-renderer-hidden]"
            );
            return [
              node.tagName.toLowerCase(),
              node.getAttribute("data-rendered-currency") ??
                node.getAttribute("data-active-currency") ??
                "",
              pageLayer?.getAttribute("data-sauge-page-origin") ?? "",
              pageLayer?.getAttribute("data-sauge-flip-page-index") ?? "",
              node.closest<HTMLElement>("[data-sauge-route-transition-phase]")
                ?.getAttribute("data-sauge-route-transition-phase") ?? "final"
            ].join(":");
          }),
          prices: [
            ...document.querySelectorAll<HTMLElement>(
              '[data-sauge-visible-price="true"]'
            )
          ]
            .filter(visible)
            .map((node) => node.textContent?.trim() ?? "")
        });
        if (!browserWindow.__saugeStopCurrencySamples) requestAnimationFrame(sample);
      };
      sample();
      const book = document.querySelector<HTMLElement>(
        '[data-testid="sauge-noire-book"]'
      );
      const activeIndex = book?.getAttribute("data-page-index");
      const link =
        activeIndex === null || activeIndex === undefined
          ? null
          : document.querySelector<HTMLElement>(
              `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"][data-sauge-reading-page-index="${activeIndex}"] [data-sauge-featured-dish]`
            );
      link?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
      );
    });
  });

  const transition = page.locator('[data-sauge-route-transition="true"]');
  await expect(transition).toHaveAttribute("data-sauge-transition-currency", "EUR");
  await expect(transition).toHaveAttribute("data-sauge-transition-locale", "en");
  await expect(transition).toHaveAttribute(
    "data-sauge-transition-href",
    /currency=EUR/
  );
  await expect(transition).toHaveAttribute(
    "data-sauge-route-transition-phase",
    "awaiting-destination",
    { timeout: 10_000 }
  );
  const settled = transition.locator('[data-sauge-route-scroll-owner="true"]');
  await expect(settled).toBeVisible();
  await expect(
    settled.locator('article[data-rendered-currency="EUR"]')
  ).toBeVisible();
  await expect(page).toHaveURL(/currency=EUR/, { timeout: 15_000 });
  await expect(transition).toHaveCount(0, { timeout: 15_000 });
  await expect(
    page.locator('[data-sauge-route-renderer-hidden="false"] [data-active-currency="EUR"]')
  ).toBeAttached();
  await expect(
    page.locator(
      '[data-sauge-route-renderer-hidden="false"] [data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] article:not([data-transition-preview="true"])[data-rendered-currency="EUR"]'
    )
  ).toBeAttached();
  await expect(
    page
      .locator(
        '[data-sauge-route-renderer-hidden="false"] [data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] article:not([data-transition-preview="true"]) [data-sauge-visible-price="true"]'
      )
      .first()
  ).toHaveText(/€\s*9[.,]96|9[.,]96\s*€/);

  const samples = await page.evaluate(() => {
    const browserWindow = window as typeof window & {
      __saugeCurrencySamples?: Array<{
        currencies: string[];
        layers: string[];
        prices: string[];
      }>;
      __saugeStopCurrencySamples?: boolean;
    };
    browserWindow.__saugeStopCurrencySamples = true;
    return browserWindow.__saugeCurrencySamples ?? [];
  });
  expect(samples.length).toBeGreaterThan(0);
  const currencySamples = samples.filter(
    (sample) => sample.currencies.length > 0
  );
  const priceSamples = samples.filter((sample) => sample.prices.length > 0);
  expect(currencySamples.length).toBeGreaterThan(0);
  expect(priceSamples.length).toBeGreaterThan(0);
  for (const sample of currencySamples) {
    expect(
      sample.currencies,
      `painted currency layers: ${sample.layers.join(", ")}`
    ).toEqual(sample.currencies.map(() => "EUR"));
  }
  for (const sample of priceSamples) {
    expect(sample.prices.some((price) => /16\s*\$/.test(price))).toBe(false);
  }

  delayMenuRsc = true;
  const detailViewport = page.locator(
    '[data-sauge-route-renderer-hidden="false"] [data-page-flip-state="ready"]'
  ).first();
  const backLink = detailViewport.locator(
    '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] [data-sauge-typography-role="back-control"]'
  );
  await expect(backLink).toContainText(/Back to/i);
  await dispatchPrimaryClick(backLink);
  const returnTransition = page.locator(
    '[data-sauge-route-transition="true"]'
  );
  await expect(returnTransition).toHaveAttribute(
    "data-sauge-transition-currency",
    "EUR"
  );
  await expect(returnTransition).toHaveAttribute(
    "data-sauge-transition-locale",
    /^en(?:-CA)?$/
  );
  await expect(returnTransition).toHaveAttribute(
    "data-sauge-route-transition-phase",
    "awaiting-destination",
    { timeout: 10_000 }
  );
  const returnSettled = returnTransition.locator(
    '[data-sauge-route-scroll-owner="true"]'
  );
  const returnPreviewScrollTop = await scrollRouteOwnerWithBrowserInput(
    page,
    returnSettled,
    browserName,
    260
  );
  expect(returnPreviewScrollTop).toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/menu\/sauge-noire\?/, { timeout: 15_000 });
  await expect(page).toHaveURL(/currency=EUR/);
  await expect(returnTransition).toHaveCount(0, { timeout: 15_000 });
  const returnedState = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>(
      '[data-page-flip-state="ready"]'
    );
    const activePage = viewport?.querySelector<HTMLElement>(
      '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
    );
    return {
      currency: document
        .querySelector<HTMLElement>(
          '[data-sauge-route-renderer-hidden="false"] [data-active-currency]'
        )
        ?.getAttribute("data-active-currency"),
      locale: document
        .querySelector<HTMLElement>(
          '[data-sauge-route-renderer-hidden="false"] [data-active-locale]'
        )
        ?.getAttribute("data-active-locale"),
      scrollTop: activePage?.scrollTop ?? -1
    };
  });
  expect(returnedState.currency).toBe("EUR");
  expect(returnedState.locale).toMatch(/^en(?:-CA)?$/);
  expect(
    Math.abs(returnedState.scrollTop - returnPreviewScrollTop)
  ).toBeLessThanOrEqual(1);
});

test("the awaiting-destination watchdog resolves when readiness cannot be accepted", async ({
  page
}) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, MENU_ROUTE, /CANARD|SAUGE NOIRE/i);
  await page.evaluate(() => {
    const originalGetAttribute = Element.prototype.getAttribute;
    const state = { forcedReads: 0 };
    Element.prototype.getAttribute = function patchedGetAttribute(name: string) {
      if (
        name === "data-page-flip-engine-state" &&
        this instanceof HTMLElement &&
        this.closest('[data-sauge-route-renderer-hidden="true"]')
      ) {
        state.forcedReads += 1;
        return "flipping";
      }
      return originalGetAttribute.call(this, name);
    };
    (window as typeof window & { __saugeWatchdogState?: typeof state })
      .__saugeWatchdogState = state;
  });

  const link = await activeMenuLink(page, "[data-sauge-featured-dish]");
  await installRouteTransitionProbe(page);
  await dispatchPrimaryClick(link);
  const transition = page.locator('[data-sauge-route-transition="true"]');
  await expect(transition).toHaveAttribute(
    "data-sauge-route-transition-phase",
    "awaiting-destination",
    { timeout: 10_000 }
  );
  await page.waitForTimeout(4_000);
  await expect(transition).toHaveCount(1);
  await expect(transition).toHaveCount(0, {
    timeout: 3_000
  });
  const samples = await page.evaluate(() => {
    const browserWindow = window as typeof window & {
      __saugeRouteTransitionObserver?: MutationObserver;
      __saugeRouteTransitionSamples?: RouteTransitionSample[];
    };
    browserWindow.__saugeRouteTransitionObserver?.disconnect();
    return browserWindow.__saugeRouteTransitionSamples ?? [];
  });
  const awaitingSample = samples.find(
    (sample) => sample.overlay && sample.phase === "awaiting-destination"
  );
  const handoffSample = samples.find(
    (sample) =>
      awaitingSample !== undefined &&
      sample.timestamp >= awaitingSample.timestamp &&
      !sample.overlay
  );
  expect(awaitingSample, "the probe must observe awaiting-destination").toBeDefined();
  expect(handoffSample, "the probe must observe watchdog handoff").toBeDefined();
  const watchdogDuration =
    handoffSample!.timestamp - awaitingSample!.timestamp;
  expect(watchdogDuration).toBeGreaterThanOrEqual(5_000);
  expect(watchdogDuration).toBeLessThanOrEqual(8_000);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & {
          __saugeWatchdogState?: { forcedReads: number };
        }).__saugeWatchdogState?.forcedReads ?? 0
    )
  ).toBeGreaterThan(0);
});

test("the watchdog hard navigates when the client destination never commits", async ({
  page
}) => {
  test.setTimeout(35_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, MENU_ROUTE, /CANARD|SAUGE NOIRE/i);

  let blockedDestinationRscRequests = 0;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isDestinationRsc =
      url.pathname === "/menu/sauge-noire/dishes/canard-a-l-erable-noir" &&
      (
        url.searchParams.has("_rsc") ||
        request.headers().rsc === "1"
      );
    if (!isDestinationRsc) {
      await route.continue();
      return;
    }

    blockedDestinationRscRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    await route.abort().catch(() => undefined);
  });

  const link = await activeMenuLink(page, "[data-sauge-featured-dish]");
  await dispatchPrimaryClick(link);
  const transition = page.locator('[data-sauge-route-transition="true"]');
  await expect(transition).toHaveAttribute(
    "data-sauge-route-transition-phase",
    "awaiting-destination",
    { timeout: 10_000 }
  );
  await expect(page).toHaveURL(/\/menu\/sauge-noire\?/, { timeout: 5_000 });
  await expect(page).toHaveURL(
    /\/menu\/sauge-noire\/dishes\/canard-a-l-erable-noir/,
    { timeout: 10_000 }
  );
  expect(
    blockedDestinationRscRequests,
    "the fixture must stall at least one client RSC navigation"
  ).toBeGreaterThan(0);
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({
    timeout: 15_000
  });
  const diagnostics = pageDiagnostics.get(page);
  const expectedRscFallback = /Failed to fetch RSC payload .*Falling back to browser navigation\./;
  if (diagnostics) {
    diagnostics.consoleErrors = diagnostics.consoleErrors.filter(
      (message) => !expectedRscFallback.test(message)
    );
    diagnostics.pageErrors = diagnostics.pageErrors.filter(
      (message) => !/due to access control checks\.$/.test(message)
    );
  }
});

for (const intent of [
  {
    name: "menu dish",
    route: MENU_ROUTE,
    heading: /CANARD|SAUGE NOIRE/i,
    link: async (page: Page) => activeMenuLink(page, "[data-sauge-featured-dish]")
  },
  {
    name: "detail back",
    route: DETAIL_ROUTE,
    heading: /CANARD/i,
    link: async (page: Page) =>
      page
        .locator(
          '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] article:not([data-transition-preview="true"]) a'
        )
        .first()
  }
]) {
  test(`mobile pointer intent prefetches the ${intent.name} route before click`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, intent.route, intent.heading);
    const link = await intent.link(page);
    const href = await link.getAttribute("href");
    if (!href) throw new Error("Expected a destination href");
    await page.evaluate(() => {
      const scope = window as unknown as {
        next?: {
          router?: {
            prefetch: (
              href: string,
              options?: { kind?: string; onInvalidate?: () => void }
            ) => void;
          };
        };
        __saugePrefetchCalls?: Array<{ href: string; kind: string | null }>;
      };
      const router = scope.next?.router;
      if (!router) throw new Error("Expected the installed Next App Router instance");
      const originalPrefetch = router.prefetch.bind(router);
      scope.__saugePrefetchCalls = [];
      router.prefetch = (targetHref, options) => {
        scope.__saugePrefetchCalls?.push({
          href: targetHref,
          kind: options?.kind ?? null
        });
        originalPrefetch(targetHref, options);
      };
    });

    await link.dispatchEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerType: "touch"
    });
    await link.dispatchEvent("pointerenter", { bubbles: true });
    await link.focus();
    await link.dispatchEvent("touchstart", { bubbles: true, cancelable: true });

    const prefetchCalls = await page.evaluate(
      () =>
        (
          window as unknown as {
            __saugePrefetchCalls?: Array<{ href: string; kind: string | null }>;
          }
        ).__saugePrefetchCalls ?? []
    );
    expect(prefetchCalls).toEqual([
      {
        href: new URL(href, page.url()).pathname + new URL(href, page.url()).search,
        kind: "full"
      }
    ]);
    expect(page.url()).toBe(new URL(intent.route, page.url()).href);
    await expect(page.locator('[data-sauge-route-transition="true"]')).toHaveCount(0);
  });
}
