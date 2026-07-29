import { expect, test, type Page } from "@playwright/test";

type StaticPageKind = "cover" | "contents" | "ending";
type Viewport = { width: number; height: number };
type ResizeLifecycleProbe = {
  initialRoot: Element;
  observedRoots: Set<Element>;
  maxRootCount: number;
  sawFallback: boolean;
  sawLoading: boolean;
  bookKeys: Set<string>;
  engineStates: Set<string>;
  maxInitCount: number;
  observer: MutationObserver;
  timer: number;
};

const ROUTES: Record<StaticPageKind, string> = {
  cover: "/menu/sauge-noire?view=sauge-0&lang=fr-CA&currency=CAD",
  contents: "/menu/sauge-noire?view=sauge-1&lang=fr-CA&currency=CAD",
  ending: "/menu/sauge-noire?view=sauge-9&lang=fr-CA&currency=CAD"
};
const PAGE_INDEX: Record<StaticPageKind, number> = {
  cover: 0,
  contents: 1,
  ending: 9
};

const PORTRAIT_VIEWPORTS: Viewport[] = [
  { width: 280, height: 480 },
  { width: 320, height: 480 },
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 375, height: 705 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 480, height: 960 }
];

const LANDSCAPE_VIEWPORTS: Viewport[] = [
  { width: 480, height: 280 },
  { width: 568, height: 320 },
  { width: 640, height: 360 },
  { width: 667, height: 375 },
  { width: 812, height: 375 },
  { width: 844, height: 390 },
  { width: 852, height: 393 },
  { width: 915, height: 412 },
  { width: 932, height: 430 }
];

const LARGE_VIEWPORTS: Viewport[] = [
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 900 }
];

const REQUIRED_SELECTORS: Record<StaticPageKind, string[]> = {
  cover: [
    '[data-sauge-static-element="header"]',
    '[data-sauge-static-element="brand"]',
    'button[aria-label^="Langue:"]',
    'button[aria-label^="Devise:"]',
    '[data-sauge-static-page="cover"] [role="img"]',
    '[data-sauge-static-page="cover"] h1',
    '[data-sauge-static-element="wordmark"] p',
    '[data-sauge-static-element="rule"]',
    '[data-sauge-static-element="menu-title"]',
    '[data-sauge-static-element="underline"]',
    '[data-sauge-static-element="city"]',
    '[data-sauge-static-element="dot"]',
    '[data-sauge-static-element="year"]',
    '[data-sauge-static-element="open"]',
    '[data-sauge-static-element="arrow"]',
    '[data-sauge-static-element="cover-tap"]'
  ],
  contents: [
    '[data-sauge-static-element="header"]',
    '[data-sauge-static-element="brand"]',
    'button[aria-label^="Langue:"]',
    'button[aria-label^="Devise:"]',
    '[data-sauge-static-page="contents"] [role="img"]',
    '[data-sauge-static-page="contents"] h1',
    '[data-sauge-static-element="rule"]',
    '[data-sauge-static-element="instruction"]',
    '[data-sauge-static-page="contents"] nav',
    '[data-sauge-static-page="contents"] nav button',
    '[data-sauge-static-page="contents"] nav b',
    '[data-sauge-static-element="footer"]',
    '[data-sauge-static-element="footer"] p',
    '[data-sauge-static-element="double-arrow"]',
    '[data-sauge-static-element="previous-control"]',
    '[data-sauge-static-element="next-control"]'
  ],
  ending: [
    '[data-sauge-static-element="header"]',
    '[data-sauge-static-element="brand"]',
    'button[aria-label^="Langue:"]',
    'button[aria-label^="Devise:"]',
    '[data-sauge-static-page="ending"] h1',
    '[data-sauge-static-page="ending"] [role="img"]',
    '[data-sauge-static-element="wordmark"]',
    '[data-sauge-static-element="tagline"]',
    '[data-sauge-static-element="rule"]',
    '[data-sauge-static-element="city"]',
    '[data-sauge-static-element="dot"]',
    '[data-testid="google-review-cta"]',
    '[data-testid="google-review-mark"]',
    '[data-testid="google-review-arrow"]',
    '[data-sauge-static-element="restart"]',
    '[data-sauge-static-element="message"]'
  ]
};

async function openStaticPage(page: Page, kind: StaticPageKind, viewport: Viewport) {
  await page.setViewportSize(viewport);
  await page.goto(ROUTES[kind], { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-page-flip-state="ready"]').first()).toBeVisible({
    timeout: 15_000
  });
  await expect(page.locator('[data-page-flip-state="ready"]').first()).toHaveAttribute(
    "data-page-flip-current-page",
    String(PAGE_INDEX[kind])
  );
  await expect(page.locator('[data-page-flip-state="ready"]').first()).toHaveAttribute(
    "data-page-flip-actual-page",
    String(PAGE_INDEX[kind])
  );
  await expect(
    page.locator(
      `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"] [data-sauge-static-page="${kind}"]`
    )
  ).toHaveCount(1);
  await expect(
    page.locator(
      `[data-page-flip-state="ready"] [data-sauge-flip-page-index="${PAGE_INDEX[kind]}"]:not([data-sauge-flip-clone="true"])`
    )
  ).toHaveCount(1);
}

async function assertStaticPageFits(
  page: Page,
  { kind, viewport }: { kind: StaticPageKind; viewport: Viewport }
) {
  const sheet = page.locator(
    `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]:has([data-sauge-static-page="${kind}"])`
  );
  await expect(sheet).toBeVisible();
  await expect
    .poll(
      () =>
        sheet.evaluate((element, expectedKind) => {
          const content = element.querySelector<HTMLElement>(
            `[data-sauge-static-page="${expectedKind}"]`
          );
          if (!content) return Number.POSITIVE_INFINITY;
          return Math.max(
            element.scrollHeight - element.clientHeight,
            element.scrollWidth - element.clientWidth,
            content.scrollHeight - content.clientHeight,
            content.scrollWidth - content.clientWidth
          );
        }, kind),
      { message: `${kind} layout should settle without overflow after resize` }
    )
    .toBeLessThanOrEqual(1);
  await page.evaluate(
    async ({ expectedKind, selectors }) => {
      await document.fonts.ready;
      await new Promise<void>((resolve) => {
        let previousSignature = "";
        let stableFrames = 0;
        const sample = () => {
          const sheet = document.querySelector<HTMLElement>(
            `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]:has([data-sauge-static-page="${expectedKind}"])`
          );
          const elements = sheet
            ? [sheet, ...selectors.flatMap((selector) => [...sheet.querySelectorAll(selector)])]
            : [];
          const signature = elements
            .map((element) => {
              const htmlElement = element as HTMLElement;
              return [
                htmlElement.offsetTop,
                htmlElement.offsetLeft,
                htmlElement.offsetWidth,
                htmlElement.offsetHeight
              ].join(",");
            })
            .join("|");
          stableFrames = signature === previousSignature ? stableFrames + 1 : 0;
          previousSignature = signature;
          if (stableFrames >= 2) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
    },
    { expectedKind: kind, selectors: REQUIRED_SELECTORS[kind] }
  );
  const result = await page.evaluate(
    ({ expectedKind, selectors }) => {
      const sheet = document.querySelector<HTMLElement>(
        `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]:has([data-sauge-static-page="${expectedKind}"])`
      );
      const content = sheet?.querySelector<HTMLElement>(
        `[data-sauge-static-page="${expectedKind}"]`
      );
      if (!content || !sheet) {
        throw new Error(`Missing canonical ${expectedKind} reading surface`);
      }

      const sheetRect = sheet.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const viewportElement = sheet.closest<HTMLElement>('[data-page-flip-state="ready"]');
      const viewportRect = viewportElement?.getBoundingClientRect();
      if (!viewportRect) throw new Error(`Missing ready ${expectedKind} viewport`);
      const measured = selectors.flatMap((selector) =>
        [...sheet.querySelectorAll<HTMLElement>(selector)].map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          let ancestor: HTMLElement | null = element;
          let hiddenByAncestor = false;
          while (ancestor && ancestor !== sheet.parentElement) {
            const ancestorStyle = getComputedStyle(ancestor);
            if (
              ancestorStyle.display === "none" ||
              ancestorStyle.visibility === "hidden" ||
              Number(ancestorStyle.opacity) === 0
            ) {
              hiddenByAncestor = true;
              break;
            }
            if (ancestor === sheet) break;
            ancestor = ancestor.parentElement;
          }
          return {
            selector,
            display: style.display,
            visibility: style.visibility,
            opacity: Number(style.opacity),
            hiddenByAncestor,
            rect: {
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
              width: rect.width,
              height: rect.height
            }
          };
        })
      );

      const contentsNav = expectedKind === "contents"
        ? sheet.querySelector<HTMLElement>('[data-sauge-static-page="contents"] nav')
        : null;
      const contentsButtons = contentsNav?.querySelectorAll("button").length ?? null;
      const contentsNumbers = expectedKind === "contents"
        ? contentsNav?.querySelectorAll("button b").length ?? null
        : null;
      const contentsNavMetrics = contentsNav
        ? {
            scrollHeight: contentsNav.scrollHeight,
            scrollWidth: contentsNav.scrollWidth,
            clientHeight: contentsNav.clientHeight,
            clientWidth: contentsNav.clientWidth
          }
        : null;
      const touchTargets = [...sheet.querySelectorAll<HTMLElement>("button")].map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      const collisionCandidates = [
        sheet.querySelector<HTMLElement>('[data-sauge-static-element="brand"]'),
        sheet.querySelector<HTMLElement>("button[class*=contentsBack]"),
        ...sheet.querySelectorAll<HTMLElement>("button[class*=preferenceTrigger]"),
        ...(expectedKind === "cover"
          ? [
              sheet.querySelector<HTMLElement>('[data-sauge-static-page="cover"] [role="img"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-page="cover"] h1'),
              sheet.querySelector<HTMLElement>(
                '[data-sauge-static-element="wordmark"] > p'
              ),
              sheet.querySelector<HTMLElement>(
                '[data-sauge-static-page="cover"] > [data-sauge-static-element="rule"]'
              ),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="menu-title"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="underline"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="city"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="dot"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="year"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="open"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="arrow"]')
            ].filter((element): element is HTMLElement => element !== null)
          : []),
        ...(expectedKind === "contents"
          ? [
              sheet.querySelector<HTMLElement>(
                '[data-sauge-static-page="contents"] [role="img"]'
              ),
              sheet.querySelector<HTMLElement>('[data-sauge-static-page="contents"] h1'),
              sheet.querySelector<HTMLElement>(
                '[data-sauge-static-page="contents"] > [data-sauge-static-element="rule"]'
              ),
              sheet.querySelector<HTMLElement>(
                '[data-sauge-static-element="instruction"]'
              ),
              ...sheet.querySelectorAll<HTMLElement>(
                '[data-sauge-static-page="contents"] nav button'
              ),
              sheet.querySelector<HTMLElement>(
                '[data-sauge-static-element="footer"]'
              )
            ].filter((element): element is HTMLElement => element !== null)
          : []),
        ...(expectedKind === "ending"
          ? [
              sheet.querySelector<HTMLElement>('[data-sauge-static-page="ending"] > h1'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-page="ending"] [role="img"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="wordmark"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="tagline"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-page="ending"] > [data-sauge-static-element="rule"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="city"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="dot"]'),
              sheet.querySelector<HTMLElement>('[data-testid="google-review-cta"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="restart"]'),
              sheet.querySelector<HTMLElement>('[data-sauge-static-element="message"]')
            ].filter((element): element is HTMLElement => element !== null)
          : [])
      ].filter((element): element is HTMLElement => element !== null);
      const collisions: string[] = [];
      for (let index = 0; index < collisionCandidates.length; index += 1) {
        for (let comparison = index + 1; comparison < collisionCandidates.length; comparison += 1) {
          const first = collisionCandidates[index];
          const second = collisionCandidates[comparison];
          if (first.contains(second) || second.contains(first)) continue;
          const firstRect = first.getBoundingClientRect();
          const secondRect = second.getBoundingClientRect();
          if (
            firstRect.left < secondRect.right - 1 &&
            firstRect.right > secondRect.left + 1 &&
            firstRect.top < secondRect.bottom - 1 &&
            firstRect.bottom > secondRect.top + 1
          ) {
            collisions.push(
              `${first.getAttribute("data-sauge-static-element") ?? first.tagName} / ` +
              `${second.getAttribute("data-sauge-static-element") ?? second.tagName}`
            );
          }
        }
      }

      return {
        metrics: {
          scrollTop: sheet.scrollTop,
          scrollLeft: sheet.scrollLeft,
          scrollHeight: sheet.scrollHeight,
          scrollWidth: sheet.scrollWidth,
          clientHeight: sheet.clientHeight,
          clientWidth: sheet.clientWidth,
          overflowX: getComputedStyle(sheet).overflowX,
          overflowY: getComputedStyle(sheet).overflowY,
          contentScrollTop: content.scrollTop,
          contentScrollLeft: content.scrollLeft,
          contentScrollHeight: content.scrollHeight,
          contentScrollWidth: content.scrollWidth,
          contentClientHeight: content.clientHeight,
          contentClientWidth: content.clientWidth,
          documentScrollHeight: document.scrollingElement?.scrollHeight ?? 0,
          documentScrollWidth: document.scrollingElement?.scrollWidth ?? 0,
          documentClientHeight: document.scrollingElement?.clientHeight ?? 0,
          documentClientWidth: document.scrollingElement?.clientWidth ?? 0,
          sheetRect: {
            top: sheetRect.top,
            right: sheetRect.right,
            bottom: sheetRect.bottom,
            left: sheetRect.left,
            width: sheetRect.width,
            height: sheetRect.height
          },
          contentRect: {
            top: contentRect.top,
            right: contentRect.right,
            bottom: contentRect.bottom,
            left: contentRect.left,
            width: contentRect.width,
            height: contentRect.height
          },
          viewportRect: {
            top: viewportRect.top,
            right: viewportRect.right,
            bottom: viewportRect.bottom,
            left: viewportRect.left,
            width: viewportRect.width,
            height: viewportRect.height
          },
          windowScrollX: window.scrollX,
          windowScrollY: window.scrollY
        },
        measured,
        contentsButtons,
        contentsNumbers,
        contentsNavMetrics,
        collisions,
        touchTargets
      };
    },
    { expectedKind: kind, selectors: REQUIRED_SELECTORS[kind] }
  );

  expect(
    result.metrics.scrollTop,
    `${kind} scrollTop at ${viewport.width}x${viewport.height}`
  ).toBe(0);
  expect(result.metrics.scrollLeft).toBe(0);
  expect(result.metrics.scrollHeight).toBeLessThanOrEqual(result.metrics.clientHeight + 1);
  expect(result.metrics.scrollWidth).toBeLessThanOrEqual(result.metrics.clientWidth + 1);
  expect(result.metrics.contentScrollTop).toBe(0);
  expect(result.metrics.contentScrollLeft).toBe(0);
  expect(result.metrics.contentScrollHeight).toBeLessThanOrEqual(
    result.metrics.contentClientHeight + 1
  );
  expect(result.metrics.contentScrollWidth).toBeLessThanOrEqual(
    result.metrics.contentClientWidth + 1
  );
  expect(result.metrics.documentScrollHeight).toBeLessThanOrEqual(
    result.metrics.documentClientHeight + 1
  );
  expect(result.metrics.documentScrollWidth).toBeLessThanOrEqual(
    result.metrics.documentClientWidth + 1
  );
  expect(result.metrics.windowScrollX).toBe(0);
  expect(result.metrics.windowScrollY).toBe(0);
  expect(result.metrics.sheetRect.top).toBeGreaterThanOrEqual(
    result.metrics.viewportRect.top - 1
  );
  expect(result.metrics.sheetRect.left).toBeGreaterThanOrEqual(
    result.metrics.viewportRect.left - 1
  );
  expect(result.metrics.sheetRect.right).toBeLessThanOrEqual(
    result.metrics.viewportRect.right + 1
  );
  expect(result.metrics.sheetRect.bottom).toBeLessThanOrEqual(
    result.metrics.viewportRect.bottom + 1
  );
  expect(Math.abs(result.metrics.sheetRect.width - result.metrics.viewportRect.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(result.metrics.sheetRect.height - result.metrics.viewportRect.height)).toBeLessThanOrEqual(1);

  for (const selector of REQUIRED_SELECTORS[kind]) {
    expect(
      result.measured.some((element) => element.selector === selector),
      `${kind} must render ${selector} at ${viewport.width}x${viewport.height}`
    ).toBe(true);
  }
  for (const element of result.measured) {
    expect(element.display, `${element.selector} display`).not.toBe("none");
    expect(element.visibility, `${element.selector} visibility`).not.toBe("hidden");
    expect(element.opacity, `${element.selector} opacity`).not.toBe(0);
    expect(element.hiddenByAncestor, `${element.selector} ancestor visibility`).toBe(false);
    expect(element.rect.width, `${element.selector} width`).toBeGreaterThan(0);
    expect(element.rect.height, `${element.selector} height`).toBeGreaterThan(0);
    expect(element.rect.top, `${element.selector} top containment`).toBeGreaterThanOrEqual(
      result.metrics.sheetRect.top - 1
    );
    expect(element.rect.left, `${element.selector} left containment`).toBeGreaterThanOrEqual(
      result.metrics.sheetRect.left - 1
    );
    expect(element.rect.right, `${element.selector} right containment`).toBeLessThanOrEqual(
      result.metrics.sheetRect.right + 1
    );
    expect(element.rect.bottom, `${element.selector} bottom containment`).toBeLessThanOrEqual(
      result.metrics.sheetRect.bottom + 1
    );
  }

  if (kind === "contents") {
    expect(result.contentsButtons).toBeGreaterThan(0);
    expect(result.contentsNumbers).toBe(result.contentsButtons);
    expect(result.contentsNavMetrics).not.toBeNull();
    expect(result.contentsNavMetrics!.scrollHeight).toBeLessThanOrEqual(
      result.contentsNavMetrics!.clientHeight + 1
    );
    expect(result.contentsNavMetrics!.scrollWidth).toBeLessThanOrEqual(
      result.contentsNavMetrics!.clientWidth + 1
    );
  }
  expect(
    result.collisions,
    `${kind} mandatory elements must not overlap at ${viewport.width}x${viewport.height}`
  ).toEqual([]);
  for (const target of result.touchTargets) {
    expect(target.width).toBeGreaterThanOrEqual(40);
    expect(target.height).toBeGreaterThanOrEqual(40);
  }

  const initialPageState = await page.locator('[data-page-flip-state="ready"]').evaluate(
    (element) => ({
      actual: element.getAttribute("data-page-flip-actual-page"),
      current: element.getAttribute("data-page-flip-current-page")
    })
  );
  expect(initialPageState).toEqual({
    actual: String(PAGE_INDEX[kind]),
    current: String(PAGE_INDEX[kind])
  });
  await sheet.hover({ position: { x: 10, y: 10 } });
  await page.mouse.wheel(0, 320).catch((error: Error) => {
    if (!error.message.includes("Mouse wheel is not supported in mobile WebKit")) throw error;
  });
  await page.evaluate(() => {
    window.addEventListener("keydown", (event) => event.stopImmediatePropagation(), {
      capture: true,
      once: true
    });
  });
  await page.keyboard.press("PageDown");
  await page.evaluate(() => {
    window.addEventListener("keydown", (event) => event.stopImmediatePropagation(), {
      capture: true,
      once: true
    });
  });
  await page.keyboard.press("ArrowDown");
  await sheet.evaluate((element) => {
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: 320, bubbles: true }));
    element.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: 12,
      clientY: 12,
      pointerId: 41,
      pointerType: "touch"
    }));
    element.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      clientX: 12,
      clientY: 92,
      pointerId: 41,
      pointerType: "touch"
    }));
    element.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      clientX: 12,
      clientY: 92,
      pointerId: 41,
      pointerType: "touch"
    }));
    element.scrollTop = 10;
    element.scrollLeft = 10;
  });
  await expect.poll(async () => sheet.evaluate((element) => ({
    top: element.scrollTop,
    left: element.scrollLeft
  }))).toEqual({ top: 0, left: 0 });
  expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual({
    x: 0,
    y: 0
  });
  expect(
    await page.locator('[data-page-flip-state="ready"]').evaluate((element) => ({
      actual: element.getAttribute("data-page-flip-actual-page"),
      current: element.getAttribute("data-page-flip-current-page")
    }))
  ).toEqual(initialPageState);
}

async function installResizeLifecycleProbe(page: Page) {
  await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('[data-page-flip-state="ready"]');
    const root = viewport?.querySelector(".stf__parent");
    if (!viewport || !root) throw new Error("Expected stable PageFlip root");

    const isVisible = (element: HTMLElement) => {
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
    const scope = window as typeof window & {
      __staticResizeLifecycleProbe?: ResizeLifecycleProbe;
    };
    const probe: ResizeLifecycleProbe = {
      initialRoot: root,
      observedRoots: new Set([root]),
      maxRootCount: 1,
      sawFallback: false,
      sawLoading: false,
      bookKeys: new Set(),
      engineStates: new Set(),
      maxInitCount: 0,
      observer: null as unknown as MutationObserver,
      timer: 0
    };
    const sample = () => {
      const roots = document.querySelectorAll(".stf__parent");
      probe.maxRootCount = Math.max(probe.maxRootCount, roots.length);
      roots.forEach((candidate) => {
        probe.observedRoots.add(candidate);
      });
      if (document.querySelector('[data-page-flip-state="loading"]')) {
        probe.sawLoading = true;
      }
      if (
        [...document.querySelectorAll<HTMLElement>("[data-page-flip-fallback]")].some(isVisible)
      ) {
        probe.sawFallback = true;
      }
      const bookKey = viewport.getAttribute("data-page-flip-book-key");
      const engineState = viewport.getAttribute("data-page-flip-engine-state");
      const initCount = Number(viewport.getAttribute("data-page-flip-init-count") ?? 0);
      if (bookKey) probe.bookKeys.add(bookKey);
      if (engineState) probe.engineStates.add(engineState);
      probe.maxInitCount = Math.max(probe.maxInitCount, initCount);
    };
    probe.observer = new MutationObserver(sample);
    probe.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-page-flip-state",
        "data-page-flip-book-key",
        "data-page-flip-engine-state",
        "data-page-flip-init-count"
      ],
      childList: true,
      subtree: true
    });
    probe.timer = window.setInterval(sample, 8);
    sample();
    scope.__staticResizeLifecycleProbe = probe;
  });
}

async function readResizeLifecycleProbe(page: Page) {
  return page.evaluate(() => {
    const scope = window as typeof window & {
      __staticResizeLifecycleProbe?: ResizeLifecycleProbe;
    };
    const probe = scope.__staticResizeLifecycleProbe;
    if (!probe) throw new Error("Expected resize lifecycle probe");
    probe.observer.disconnect();
    window.clearInterval(probe.timer);
    return {
      rootCount: document.querySelectorAll(".stf__parent").length,
      observedRootCount: probe.observedRoots.size,
      maxRootCount: probe.maxRootCount,
      sameRoot:
        probe.initialRoot ===
        document.querySelector('[data-page-flip-state="ready"] .stf__parent'),
      sawFallback: probe.sawFallback,
      sawLoading: probe.sawLoading,
      bookKeys: [...probe.bookKeys],
      engineStates: [...probe.engineStates],
      maxInitCount: probe.maxInitCount
    };
  });
}

async function assertMatrix(page: Page, viewports: Viewport[]) {
  for (const viewport of viewports) {
    for (const kind of ["cover", "contents", "ending"] as const) {
      await test.step(`${kind} ${viewport.width}x${viewport.height}`, async () => {
        await openStaticPage(page, kind, viewport);
        await assertStaticPageFits(page, { kind, viewport });
      });
    }
  }
}

for (const viewport of PORTRAIT_VIEWPORTS) {
  test(`portrait ${viewport.width}x${viewport.height} keeps static pages contained`, async ({
    page
  }) => {
    await assertMatrix(page, [viewport]);
  });
}

for (const viewport of LANDSCAPE_VIEWPORTS) {
  test(`landscape ${viewport.width}x${viewport.height} keeps static pages contained`, async ({
    page
  }) => {
    await assertMatrix(page, [viewport]);
  });
}

for (const viewport of LARGE_VIEWPORTS) {
  test(`large ${viewport.width}x${viewport.height} keeps static pages contained`, async ({
    page
  }) => {
    await assertMatrix(page, [viewport]);
  });
}

for (const kind of ["cover", "contents", "ending"] as const) {
  test(`${kind} survives height changes without remounting PageFlip`, async ({ page }) => {
    const initial = { width: 390, height: 844 };
    await openStaticPage(page, kind, initial);
    await installResizeLifecycleProbe(page);
    await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>('[data-page-flip-state="ready"]');
      const root = viewport?.querySelector(".stf__parent");
      if (!viewport || !root) throw new Error("Expected stable PageFlip root");
      (window as typeof window & { __staticPageRoot?: Element }).__staticPageRoot = root;
    });
    const bookKey = await page
      .locator('[data-page-flip-state="ready"]')
      .getAttribute("data-page-flip-book-key");

    for (const viewport of [
      initial,
      { width: 390, height: 780 },
      { width: 390, height: 748 },
      initial
    ]) {
      await page.setViewportSize(viewport);
      await assertStaticPageFits(page, { kind, viewport });
      await expect(page.locator("[data-page-flip-fallback]:visible")).toHaveCount(0);
      await expect(page.locator(".stf__parent")).toHaveCount(1);
      await expect(page.locator('[data-page-flip-state="ready"]')).toHaveAttribute(
        "data-page-flip-book-key",
        bookKey!
      );
      expect(
        await page.evaluate(
          () =>
            (window as typeof window & { __staticPageRoot?: Element }).__staticPageRoot ===
            document.querySelector('[data-page-flip-state="ready"] .stf__parent')
        )
      ).toBe(true);
    }
    expect(await readResizeLifecycleProbe(page)).toEqual({
      rootCount: 1,
      observedRootCount: 1,
      maxRootCount: 1,
      sameRoot: true,
      sawFallback: false,
      sawLoading: false,
      bookKeys: [bookKey],
      engineStates: ["read"],
      maxInitCount: 1
    });
  });
}

for (const [portrait, landscape] of [
  [{ width: 390, height: 844 }, { width: 844, height: 390 }],
  [{ width: 430, height: 932 }, { width: 932, height: 430 }]
] as const) {
  test(`static pages fit across ${portrait.width}x${portrait.height} orientation change`, async ({
    page
  }) => {
    for (const kind of ["cover", "contents", "ending"] as const) {
      await openStaticPage(page, kind, portrait);
      await installResizeLifecycleProbe(page);
      const bookKey = await page
        .locator('[data-page-flip-state="ready"]')
        .getAttribute("data-page-flip-book-key");
      await assertStaticPageFits(page, { kind, viewport: portrait });
      await page.setViewportSize(landscape);
      await assertStaticPageFits(page, { kind, viewport: landscape });
      await expect(page.locator("[data-page-flip-fallback]:visible")).toHaveCount(0);
      await expect(page.locator(".stf__parent")).toHaveCount(1);
      await expect(page.locator('[data-page-flip-state="ready"]')).toHaveAttribute(
        "data-page-flip-book-key",
        bookKey!
      );
      expect(await readResizeLifecycleProbe(page)).toEqual({
        rootCount: 1,
        observedRootCount: 1,
        maxRootCount: 1,
        sameRoot: true,
        sawFallback: false,
        sawLoading: false,
        bookKeys: [bookKey],
        engineStates: ["read"],
        maxInitCount: 1
      });
    }
  });
}

test("simulated safe-area insets keep static controls and content contained", async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  for (const kind of ["cover", "contents", "ending"] as const) {
    await openStaticPage(page, kind, viewport);
    await page.getByTestId("sauge-noire-book").evaluate((book) => {
      book.style.setProperty("--sn-safe-top", "20px");
      book.style.setProperty("--sn-safe-right", "14px");
      book.style.setProperty("--sn-safe-bottom", "24px");
      book.style.setProperty("--sn-safe-left-in-page", "10px");
    });
    await assertStaticPageFits(page, { kind, viewport });
    const safeAreaViolations = await page
      .locator(
        `[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]:has([data-sauge-static-page="${kind}"])`
      )
      .evaluate((sheet) => {
        const sheetRect = sheet.getBoundingClientRect();
        return [...sheet.querySelectorAll<HTMLElement>("button")].flatMap((button) => {
          const rect = button.getBoundingClientRect();
          return rect.top < sheetRect.top + 20 - 1 ||
            rect.right > sheetRect.right - 14 + 1 ||
            rect.bottom > sheetRect.bottom - 24 + 1 ||
            rect.left < sheetRect.left + 10 - 1
            ? [button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "button"]
            : [];
        });
      });
    expect(safeAreaViolations, `${kind} controls must avoid simulated safe areas`).toEqual([]);
  }
});
