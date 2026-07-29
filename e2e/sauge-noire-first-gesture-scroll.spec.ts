import { expect, test, type Locator, type Page } from "@playwright/test";

const MENU_ROUTE =
  "/menu/sauge-noire?view=sauge-4&lang=fr-CA&currency=CAD&table=main&zone=terrasse";
const DETAIL_ROUTE =
  "/menu/sauge-noire/dishes/canard-a-l-erable-noir?lang=fr-CA&currency=CAD&view=sauge-4&table=main&zone=terrasse";

test.use({ hasTouch: true, isMobile: false });

type RectSnapshot = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type ScrollSnapshot = {
  owner: {
    attributes: Record<string, string>;
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
  };
  markers: Record<"title" | "image" | "price" | "description", RectSnapshot | null>;
  pageScrolls: Array<{
    active: boolean;
    key: string;
    scrollTop: number;
  }>;
  documentScrolls: {
    body: number;
    documentElement: number;
    window: number;
  };
  point: {
    x: number;
    y: number;
  };
  stack: Array<{
    attributes: Record<string, string>;
    className: string;
    inert: boolean;
    overflowY: string;
    pointerEvents: string;
    position: string;
    tag: string;
    touchAction: string;
    transform: string;
    zIndex: string;
  }>;
};

type GestureEvidence = {
  after: ScrollSnapshot;
  before: ScrollSnapshot;
  input: "keyboard" | "wheel";
  events: Array<{
    cancelable: boolean;
    defaultPrevented: boolean;
    key: string | null;
    path: string[];
    phase: string;
    target: string;
    timestamp: number;
    type: string;
  }>;
  resets: Array<{
    method: string;
    target: string;
    timestamp: number;
    top: number | null;
  }>;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    type EventRecord = GestureEvidence["events"][number];
    type ResetRecord = GestureEvidence["resets"][number];
    const scope = window as typeof window & {
      __saugeFirstGestureEvents?: EventRecord[];
      __saugeScrollResets?: ResetRecord[];
    };
    scope.__saugeFirstGestureEvents = [];
    scope.__saugeScrollResets = [];

    const label = (value: EventTarget | null) => {
      if (value === window) return "window";
      if (value === document) return "document";
      if (!(value instanceof Element)) return String(value);
      const data = [...value.attributes]
        .filter((attribute) => attribute.name.startsWith("data-sauge"))
        .map((attribute) => `[${attribute.name}="${attribute.value}"]`)
        .join("");
      return `${value.tagName.toLowerCase()}${value.id ? `#${value.id}` : ""}${data}`;
    };
    const recordEvent = (phase: string) => (event: Event) => {
      scope.__saugeFirstGestureEvents?.push({
        cancelable: event.cancelable,
        defaultPrevented: event.defaultPrevented,
        key: event instanceof KeyboardEvent ? event.key : null,
        path: event.composedPath().slice(0, 12).map(label),
        phase,
        target: label(event.target),
        timestamp: performance.now(),
        type: event.type
      });
    };
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "touchstart",
      "touchmove",
      "touchend",
      "touchcancel",
      "wheel",
      "keydown",
      "scroll"
    ]) {
      document.addEventListener(type, recordEvent("capture"), {
        capture: true,
        passive: true
      });
      window.addEventListener(type, recordEvent("bubble"), {
        passive: true
      });
    }

    const resetLog = (method: string, target: unknown, top: number | null) => {
      scope.__saugeScrollResets?.push({
        method,
        target: label(target as EventTarget | null),
        timestamp: performance.now(),
        top
      });
    };
    const elementScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function patchedScrollTo(
      this: Element,
      ...args: unknown[]
    ) {
      const first = args[0] as number | ScrollToOptions | undefined;
      const top =
        typeof first === "number"
          ? ((args[1] as number | undefined) ?? null)
          : (first?.top ?? null);
      resetLog("Element.scrollTo", this, top);
      return Reflect.apply(elementScrollTo, this, args);
    } as typeof Element.prototype.scrollTo;
    const elementScroll = Element.prototype.scroll;
    Element.prototype.scroll = function patchedScroll(
      this: Element,
      ...args: unknown[]
    ) {
      const first = args[0] as number | ScrollToOptions | undefined;
      const top =
        typeof first === "number"
          ? ((args[1] as number | undefined) ?? null)
          : (first?.top ?? null);
      resetLog("Element.scroll", this, top);
      return Reflect.apply(elementScroll, this, args);
    } as typeof Element.prototype.scroll;
    const windowScrollTo = window.scrollTo.bind(window);
    window.scrollTo = ((...args: unknown[]) => {
      const first = args[0] as number | ScrollToOptions | undefined;
      const top =
        typeof first === "number"
          ? ((args[1] as number | undefined) ?? null)
          : (first?.top ?? null);
      resetLog("window.scrollTo", window, top);
      return typeof first === "number"
        ? windowScrollTo(first, Number(args[1] ?? 0))
        : windowScrollTo(first);
    }) as typeof window.scrollTo;
  });
});

async function openReady(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `fixture route ${route}`).not.toBe(404);
  await expect(page.locator('[data-page-flip-state="ready"]').first()).toBeVisible({
    timeout: 20_000
  });
}

async function slowDestinationRsc(page: Page, pathname: string) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isDestinationRsc =
      url.pathname === pathname &&
      (url.searchParams.has("_rsc") || request.headers().rsc === "1");
    if (isDestinationRsc) {
      await new Promise((resolve) => setTimeout(resolve, 1_600));
    }
    await route.continue();
  });
}

async function visibleRouteLink(page: Page, selector: string): Promise<Locator> {
  return page
    .locator(
      `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] ${selector}`
    )
    .first();
}

async function snapshotReadingSurface(page: Page): Promise<ScrollSnapshot> {
  return page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const candidates = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"], ' +
          '[data-sauge-route-scroll-owner="true"]'
      )
    ];
    for (const viewport of document.querySelectorAll<HTMLElement>(
      '[data-page-flip-state="ready"]'
    )) {
      const actualPage = viewport.getAttribute("data-page-flip-actual-page");
      if (actualPage === null) continue;
      const page = viewport.querySelector<HTMLElement>(
        `[data-sauge-flip-page-index="${actualPage}"][data-sauge-page-origin="react-original"]`
      );
      if (page) candidates.push(page);
    }
    const owner =
      candidates.find(
        (candidate) =>
          visible(candidate) &&
          getComputedStyle(candidate).pointerEvents !== "none" &&
          candidate.scrollHeight > candidate.clientHeight + 1
      ) ??
      candidates.find(
        (candidate) =>
          visible(candidate) && getComputedStyle(candidate).pointerEvents !== "none"
      );
    if (!owner) throw new Error("Expected one visible Sauge Noire reading owner");

    const measurable = (selectors: string) =>
      [...owner.querySelectorAll<HTMLElement>(selectors)].find(visible) ?? null;
    const markers = {
      title: measurable("h1, h2"),
      image: measurable("img"),
      price: measurable('[data-sauge-visible-price="true"]'),
      description:
        measurable('[class*="description"]') ??
        measurable('[data-sauge-featured-dish] p') ??
        measurable('[data-sauge-dish-row="true"]')
    };
    const rect = (element: HTMLElement | null): RectSnapshot | null => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return {
        top: value.top,
        left: value.left,
        width: value.width,
        height: value.height
      };
    };
    const ownerRect = owner.getBoundingClientRect();
    const pointTarget =
      markers.description ?? markers.image ?? markers.title ?? owner;
    const targetRect = pointTarget.getBoundingClientRect();
    const point = {
      x: Math.min(
        ownerRect.right - 4,
        Math.max(ownerRect.left + 4, targetRect.left + targetRect.width / 2)
      ),
      y: Math.min(
        ownerRect.bottom - 4,
        Math.max(ownerRect.top + 4, targetRect.top + targetRect.height / 2)
      )
    };
    const saugeAttributes = (element: Element) =>
      Object.fromEntries(
        [...element.attributes]
          .filter((attribute) => attribute.name.startsWith("data-sauge"))
          .map((attribute) => [attribute.name, attribute.value])
      );
    const stack = document.elementsFromPoint(point.x, point.y).map((element) => {
      const htmlElement = element as HTMLElement;
      const style = getComputedStyle(htmlElement);
      return {
        attributes: saugeAttributes(element),
        className:
          typeof htmlElement.className === "string" ? htmlElement.className : "",
        inert: htmlElement.hasAttribute("inert"),
        overflowY: style.overflowY,
        pointerEvents: style.pointerEvents,
        position: style.position,
        tag: htmlElement.tagName.toLowerCase(),
        touchAction: style.touchAction,
        transform: style.transform,
        zIndex: style.zIndex
      };
    });
    const pageScrolls = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-sauge-reading-surface], [data-sauge-route-scroll-owner], ' +
          '[data-sauge-page-origin], .stf__item'
      )
    ].map((element, index) => ({
      active: element === owner,
      key:
        element.getAttribute("data-sauge-page-instance-id") ??
        element.getAttribute("data-sauge-reading-kind") ??
        element.getAttribute("data-sauge-route-scroll-owner") ??
        `${element.tagName}-${index}`,
      scrollTop: element.scrollTop
    }));

    return {
      owner: {
        attributes: saugeAttributes(owner),
        clientHeight: owner.clientHeight,
        scrollHeight: owner.scrollHeight,
        scrollTop: owner.scrollTop
      },
      markers: {
        title: rect(markers.title),
        image: rect(markers.image),
        price: rect(markers.price),
        description: rect(markers.description)
      },
      pageScrolls,
      documentScrolls: {
        body: document.body.scrollTop,
        documentElement: document.documentElement.scrollTop,
        window: window.scrollY
      },
      point,
      stack
    };
  });
}

async function firstVerticalGesture(page: Page): Promise<GestureEvidence> {
  await page.evaluate(() => {
    const scope = window as typeof window & {
      __saugeFirstGestureEvents?: GestureEvidence["events"];
      __saugeScrollResets?: GestureEvidence["resets"];
    };
    scope.__saugeFirstGestureEvents = [];
    scope.__saugeScrollResets = [];
  });
  const before = await snapshotReadingSurface(page);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const browserName =
    page.context().browser()?.browserType().name() ?? "chromium";
  const input = browserName === "webkit" ? "keyboard" : "wheel";
  if (input === "keyboard") {
    await page.evaluate(() => {
      const candidates = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"], ' +
            '[data-sauge-route-scroll-owner="true"]'
        )
      ];
      const element = candidates.find((candidate) => {
        const style = getComputedStyle(candidate);
        const rect = candidate.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.pointerEvents !== "none" &&
          rect.width > 0 &&
          rect.height > 0 &&
          candidate.scrollHeight > candidate.clientHeight + 1
        );
      });
      if (!element) throw new Error("Expected a visible scrollable reading owner");
      element.tabIndex = -1;
      element.focus();
    });
    // Playwright cannot emit a trusted touch swipe in WebKit. ArrowDown is a
    // real browser input (not element.scrollBy) and exercises the same visible
    // canonical owner without claiming physical iOS touch coverage.
    await page.keyboard.press("ArrowDown");
  } else {
    await page.mouse.move(before.point.x, before.point.y);
    await page.mouse.wheel(0, 360);
  }
  await expect
    .poll(async () => (await snapshotReadingSurface(page)).owner.scrollTop)
    .toBeGreaterThan(before.owner.scrollTop);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const owner = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"], ' +
              '[data-sauge-route-scroll-owner="true"]'
          )
        ].find((candidate) => {
          const style = getComputedStyle(candidate);
          const rect = candidate.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.pointerEvents !== "none" &&
            rect.width > 0 &&
            rect.height > 0 &&
            candidate.scrollHeight > candidate.clientHeight + 1
          );
        });
        if (!owner) {
          resolve();
          return;
        }
        let previous = owner.scrollTop;
        let stableFrames = 0;
        const startedAt = performance.now();
        const sample = () => {
          const current = owner.scrollTop;
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
  const after = await snapshotReadingSurface(page);
  const instrumentation = await page.evaluate(() => {
    const scope = window as typeof window & {
      __saugeFirstGestureEvents?: GestureEvidence["events"];
      __saugeScrollResets?: GestureEvidence["resets"];
    };
    return {
      events: scope.__saugeFirstGestureEvents ?? [],
      resets: scope.__saugeScrollResets ?? []
    };
  });
  return { before, after, input, ...instrumentation };
}

function expectFirstGestureToMoveVisibleContent(evidence: GestureEvidence) {
  const scrollDelta =
    evidence.after.owner.scrollTop - evidence.before.owner.scrollTop;
  expect(
    scrollDelta,
    "the very first browser-level vertical input must move the visible scroll owner"
  ).toBeGreaterThan(0);
  const inputEvent = evidence.events.find((event) =>
    event.phase === "bubble" &&
    (
      evidence.input === "wheel"
        ? event.type === "wheel"
        : event.type === "keydown" && event.key === "ArrowDown"
    )
  );
  expect(
    inputEvent?.defaultPrevented,
    "the first browser-level vertical input must not be cancelled"
  ).toBe(false);
  for (const marker of ["title", "image", "price", "description"] as const) {
    const before = evidence.before.markers[marker];
    const after = evidence.after.markers[marker];
    if (!before || !after) continue;
    expect(
      Math.abs(before.top - after.top - scrollDelta),
      `${marker} must move with the visible scroll owner`
    ).toBeLessThanOrEqual(3);
  }
  expect(evidence.after.documentScrolls).toEqual(evidence.before.documentScrolls);
  for (let index = 0; index < evidence.after.pageScrolls.length; index += 1) {
    const after = evidence.after.pageScrolls[index];
    const before = evidence.before.pageScrolls[index];
    if (!after || !before || after.active || before.active) continue;
    expect(
      after.scrollTop,
      `background layer ${after.key} must not scroll`
    ).toBe(before.scrollTop);
  }
  expect(
    evidence.resets.filter(
      (reset) =>
        reset.top === 0 &&
        inputEvent !== undefined &&
        reset.timestamp > inputEvent.timestamp
    ),
    "no automatic reset to zero may run after the user's first gesture starts"
  ).toEqual([]);
  expect(
    evidence.after.owner.attributes["data-sauge-reading-surface"],
    "normal reading must leave PageFlip and use the canonical surface"
  ).toBe("true");
  expect(evidence.after.owner.attributes["data-sauge-scroll-owner"]).toBe("true");
  expect(
    evidence.before.stack.some(
      (entry) =>
        entry.attributes["data-sauge-reading-surface"] === "true" &&
        entry.attributes["data-sauge-scroll-owner"] === "true"
    ),
    "elementsFromPoint must include the canonical reading owner"
  ).toBe(true);
  expect(
    evidence.before.stack.some(
      (entry) => entry.className.includes("stf__") && entry.pointerEvents !== "none"
    ),
    "no visible PageFlip layer may remain above the reading surface"
  ).toBe(false);
}

async function attachEvidence(
  evidence: GestureEvidence,
  testInfo: { attach: (name: string, options: { body: string; contentType: string }) => Promise<void> }
) {
  await testInfo.attach("first-gesture-evidence", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json"
  });
}

async function installSettlementBudgetProbe(page: Page) {
  await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>("[data-page-flip-state]");
    if (!viewport) throw new Error("Expected a PageFlip viewport");
    const scope = window as typeof window & {
      __saugeSettlementBudget?: {
        readAt: number;
        scrollableAt: number;
        delta: number;
      };
    };
    let sawFlipping = false;
    const observer = new MutationObserver(() => {
      const state = viewport.getAttribute("data-page-flip-engine-state");
      if (state === "flipping") {
        sawFlipping = true;
        return;
      }
      if (state !== "read" || !sawFlipping || scope.__saugeSettlementBudget) return;
      const readAt = performance.now();
      const recordScrollable = () => {
        const surface = document.querySelector<HTMLElement>(
          '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
        );
        if (!surface) return false;
        const scrollableAt = performance.now();
        scope.__saugeSettlementBudget = {
          readAt,
          scrollableAt,
          delta: scrollableAt - readAt
        };
        observer.disconnect();
        return true;
      };
      if (!recordScrollable()) requestAnimationFrame(recordScrollable);
    });
    observer.observe(viewport, {
      attributes: true,
      attributeFilter: ["data-page-flip-engine-state"]
    });
  });
}

async function expectReadInvariants(page: Page) {
  const counts = await page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    return {
      engines: [
        ...document.querySelectorAll<HTMLElement>(
          '[data-page-flip-engine-visible="true"], [data-sauge-route-flip-engine-visible="true"]'
        )
      ].filter(visible).length,
      owners: [
        ...document.querySelectorAll<HTMLElement>(
          '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
        )
      ].filter(visible).length,
      surfaces: [
        ...document.querySelectorAll<HTMLElement>(
          '[data-sauge-reading-surface="true"][data-sauge-reading-visible="true"]'
        )
      ].filter(visible).length
    };
  });
  expect(counts).toEqual({ engines: 0, owners: 1, surfaces: 1 });
}

test("the first gesture after opening a section moves the visible section", async ({
  page
}, testInfo) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, MENU_ROUTE);
  await page.getByRole("button", { name: /Table des mati/i }).click();
  const viewport = page.locator('[data-page-flip-state="ready"]').first();
  await expect(viewport).toHaveAttribute("data-page-flip-actual-page", "1");
  await installSettlementBudgetProbe(page);
  await page.getByRole("button", { name: /À côté & desserts 05/i }).click();
  await expect(viewport).toHaveAttribute("data-page-flip-actual-page", "6", {
    timeout: 15_000
  });
  await expect(viewport).toHaveAttribute("data-page-flip-engine-state", "read");

  const evidence = await firstVerticalGesture(page);
  await attachEvidence(evidence, testInfo);
  expectFirstGestureToMoveVisibleContent(evidence);
  const settlementBudget = await page.evaluate(() => {
    const scope = window as typeof window & {
      __saugeSettlementBudget?: { delta: number };
    };
    return scope.__saugeSettlementBudget?.delta ?? null;
  });
  expect(settlementBudget, "read must expose the scroll owner in one frame").not.toBeNull();
  expect(settlementBudget!).toBeLessThanOrEqual(100);
  await expectReadInvariants(page);
});

test("the first gesture scrolls the visible dish while its RSC route is slow", async ({
  page
}, testInfo) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, MENU_ROUTE);
  await slowDestinationRsc(
    page,
    "/menu/sauge-noire/dishes/canard-a-l-erable-noir"
  );
  await (await visibleRouteLink(page, "[data-sauge-featured-dish]")).click();
  const transition = page.locator('[data-sauge-route-transition="true"]');
  await expect(transition).toHaveAttribute(
    "data-sauge-route-transition-phase",
    "awaiting-destination",
    { timeout: 15_000 }
  );

  const evidence = await firstVerticalGesture(page);
  await attachEvidence(evidence, testInfo);
  expectFirstGestureToMoveVisibleContent(evidence);
});

test("the first gesture after returning from a dish moves the visible section", async ({
  page
}, testInfo) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, DETAIL_ROUTE);
  await slowDestinationRsc(page, "/menu/sauge-noire");
  await page
    .locator(
      '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] article:not([data-transition-preview="true"]) header a'
    )
    .first()
    .click();
  const transition = page.locator('[data-sauge-route-transition="true"]');
  await expect(transition).toHaveAttribute(
    "data-sauge-route-transition-phase",
    "awaiting-destination",
    { timeout: 15_000 }
  );

  const evidence = await firstVerticalGesture(page);
  await attachEvidence(evidence, testInfo);
  expectFirstGestureToMoveVisibleContent(evidence);
});

for (const direction of ["next", "previous"] as const) {
  test(`the first gesture moves the ${direction} dish after its internal flip`, async ({
    page
  }, testInfo) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openReady(page, DETAIL_ROUTE);
    const title = page
      .locator(
        '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] h1'
      )
      .first();
    const sourceTitle = await title.textContent();
    const link = page.getByRole("link", {
      name:
        direction === "next"
          ? /prochain plat/i
          : /plat.*dent/i
    });
    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
    await link.click();
    await expect(page).toHaveURL(new RegExp(new URL(href!, "http://vistaire.local").pathname));
    await expect(title).not.toHaveText(sourceTitle ?? "", { timeout: 15_000 });
    const viewport = page.locator('[data-page-flip-state="ready"]').first();
    await expect(viewport).toHaveAttribute("data-page-flip-engine-state", "read");
    await expect(viewport).toHaveAttribute("data-page-flip-actual-page", "1");

    const evidence = await firstVerticalGesture(page);
    await attachEvidence(evidence, testInfo);
    expectFirstGestureToMoveVisibleContent(evidence);
    await expectReadInvariants(page);
  });
}

test("direct dish loading exposes the canonical surface without waiting for PageFlip", async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto(DETAIL_ROUTE, { waitUntil: "domcontentloaded" });
  expect(response?.status()).not.toBe(404);
  await expect(
    page.locator(
      '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
    )
  ).toBeVisible();

  const evidence = await firstVerticalGesture(page);
  await attachEvidence(evidence, testInfo);
  expectFirstGestureToMoveVisibleContent(evidence);
  await expectReadInvariants(page);
});

test("browser back and forward keep the canonical dish scroll owner", async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, DETAIL_ROUTE);
  const sourcePathname = new URL(page.url()).pathname;
  const nextLink = page.getByRole("link", { name: /prochain plat/i });
  const nextHref = await nextLink.getAttribute("href");
  expect(nextHref).toBeTruthy();
  await nextLink.click();
  await expect(page).toHaveURL(
    new RegExp(new URL(nextHref!, "http://vistaire.local").pathname)
  );
  await expect(
    page.locator('[data-page-flip-state="ready"]').first()
  ).toHaveAttribute("data-page-flip-actual-page", "1");

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(sourcePathname));
  const backEvidence = await firstVerticalGesture(page);
  await attachEvidence(backEvidence, testInfo);
  expectFirstGestureToMoveVisibleContent(backEvidence);

  await page.goForward();
  await expect(page).toHaveURL(
    new RegExp(new URL(nextHref!, "http://vistaire.local").pathname)
  );
  const forwardEvidence = await firstVerticalGesture(page);
  await attachEvidence(forwardEvidence, testInfo);
  expectFirstGestureToMoveVisibleContent(forwardEvidence);
});

test("title, image, description, and paper hit the canonical owner", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, DETAIL_ROUTE);
  const selectors = [
    "h1",
    "img",
    '[class*="description"]',
    "article"
  ];
  for (const selector of selectors) {
    const target = page
      .locator(
        `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] ${selector}`
      )
      .first();
    await target.scrollIntoViewIfNeeded();
    const hit = await target.evaluate((element) => {
      const owner = element.closest<HTMLElement>(
        '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
      );
      if (!owner) throw new Error("Expected canonical owner");
      const rect = element.getBoundingClientRect();
      const ownerRect = owner.getBoundingClientRect();
      const x = Math.min(
        ownerRect.right - 6,
        Math.max(ownerRect.left + 6, rect.left + rect.width / 2)
      );
      const y = Math.min(
        ownerRect.bottom - 6,
        Math.max(ownerRect.top + 6, rect.top + rect.height / 2)
      );
      const stack = document.elementsFromPoint(x, y);
      return {
        ownerInStack: stack.includes(owner),
        closestOwner: element.closest('[data-sauge-reading-surface="true"]') === owner,
        pageFlipAbove: stack.some((candidate) => {
          if (!(candidate instanceof HTMLElement)) return false;
          return (
            candidate.className.includes("stf__") &&
            getComputedStyle(candidate).pointerEvents !== "none" &&
            getComputedStyle(candidate).visibility !== "hidden"
          );
        })
      };
    });
    expect(hit).toEqual({
      ownerInStack: true,
      closestOwner: true,
      pageFlipAbove: false
    });
  }
});

test("repeated gestures stay bounded inside the canonical surface", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, DETAIL_ROUTE);
  const before = await snapshotReadingSurface(page);
  await page.mouse.move(before.point.x, before.point.y);
  for (let index = 0; index < 8; index += 1) {
    await page.mouse.wheel(0, 900);
  }
  await page.waitForTimeout(100);
  const after = await snapshotReadingSurface(page);
  const maximum = after.owner.scrollHeight - after.owner.clientHeight;
  expect(after.owner.scrollTop).toBeGreaterThan(0);
  expect(after.owner.scrollTop).toBeGreaterThanOrEqual(-1);
  expect(after.owner.scrollTop).toBeLessThanOrEqual(maximum + 1);
  expect(after.documentScrolls).toEqual({ body: 0, documentElement: 0, window: 0 });
  const atBottom = after.owner.scrollTop;
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(80);
  const bounded = await snapshotReadingSurface(page);
  expect(bounded.owner.scrollTop).toBe(atBottom);
  expect(bounded.documentScrolls).toEqual(after.documentScrolls);
});

test("animation and read expose mutually exclusive layers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, MENU_ROUTE);
  await page.getByRole("button", { name: /Table des mati/i }).click();
  const viewport = page.locator('[data-page-flip-state="ready"]').first();
  await expect(viewport).toHaveAttribute("data-page-flip-actual-page", "1");
  await page.getByRole("button", { name: /05/i }).click();
  await expect(viewport).toHaveAttribute("data-page-flip-engine-state", "flipping");
  const animationCounts = await page.evaluate(() => ({
    engines: document.querySelectorAll('[data-page-flip-engine-visible="true"]').length,
    owners: document.querySelectorAll(
      '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
    ).length,
    surfaces: document.querySelectorAll(
      '[data-sauge-reading-surface="true"][data-sauge-reading-visible="true"]'
    ).length
  }));
  expect(animationCounts).toEqual({ engines: 1, owners: 0, surfaces: 0 });
  await expect(viewport).toHaveAttribute("data-page-flip-engine-state", "read", {
    timeout: 15_000
  });
  await expectReadInvariants(page);
});

test("Safari-like viewport height changes preserve the reading node and engine", async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await openReady(page, MENU_ROUTE);
  await page.getByRole("button", { name: /Table des mati/i }).click();
  const viewport = page.locator('[data-page-flip-state="ready"]').first();
  await expect(viewport).toHaveAttribute("data-page-flip-actual-page", "1");
  const initialEngineCount = await viewport.getAttribute("data-page-flip-init-count");
  const surface = page.locator(
    '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
  );
  const surfaceHandle = await surface.elementHandle();
  expect(surfaceHandle).not.toBeNull();
  await page.setViewportSize({ width: 430, height: 780 });
  await expect(viewport).toHaveAttribute(
    "data-page-flip-init-count",
    initialEngineCount ?? "1"
  );
  expect(
    await surfaceHandle!.evaluate(
      (element) =>
        element.isConnected &&
        element ===
          document.querySelector(
            '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
          )
    )
  ).toBe(true);
  await page.getByRole("button", { name: /05/i }).click();
  await expect(viewport).toHaveAttribute("data-page-flip-actual-page", "6", {
    timeout: 15_000
  });
  await expect(viewport).toHaveAttribute("data-page-flip-engine-state", "read", {
    timeout: 15_000
  });
  const evidence = await firstVerticalGesture(page);
  await attachEvidence(evidence, testInfo);
  expectFirstGestureToMoveVisibleContent(evidence);
});

for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 900 }
]) {
  test(`canonical first gesture works at ${viewport.width}x${viewport.height}`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openReady(page, DETAIL_ROUTE);
    const evidence = await firstVerticalGesture(page);
    await attachEvidence(evidence, testInfo);
    expectFirstGestureToMoveVisibleContent(evidence);
    await expectReadInvariants(page);
  });
}
