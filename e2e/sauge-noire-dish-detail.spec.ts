import { expect, test, type Locator, type Page } from "@playwright/test";

const detailPath =
  "/menu/sauge-noire/dishes/truite-des-laurentides?lang=fr-CA&currency=CAD&view=sauge-3&table=main&zone=terrasse";
const cocktailDetailPath =
  "/menu/sauge-noire/dishes/cendre-rose?lang=fr-CA&currency=CAD&view=sauge-7&table=main&zone=terrasse";
const activeDetailPageSelector =
  '[data-sauge-flip-page-index="1"]:not([data-sauge-flip-clone="true"]):not([aria-hidden="true"])';

type DetailState = {
  route: string;
  currentScrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  stfTransforms: string[];
  logoRect: { top: number; left: number } | null;
  headerRect: { top: number; left: number } | null;
  titleRect: { top: number; left: number } | null;
  titleCenter: number | null;
  backRect: { top: number; left: number } | null;
  visibleLogoCount: number;
  externalFloatingLogoCount: number;
  activePageIndex: string | null;
  activePageLogoCount: number;
  activeHeaderLogoCount: number;
  fallbackVisible: boolean;
  physicalPageCount: number;
  windowScrollY: number;
  documentElementScrollTop: number;
  detailPageRect: { top: number; left: number; width: number; height: number } | null;
  detailSurfaceRect: { top: number; left: number; width: number; height: number } | null;
  visualViewport: { offsetTop: number; height: number; width: number } | null;
  pageScrollTops: Array<{ scrollTop: number; isCurrent: boolean; isVisible: boolean; isClone: boolean }>;
  detailPageScrollTop: number;
  detailSurfaceScrollTop: number;
  detailPageOverflow: string | null;
  detailPageOverscrollBehavior: string | null;
  detailPagePosition: string | null;
  detailPageInset: string | null;
  detailPageIsolation: string | null;
  detailSurfaceOverflow: string | null;
  pageOverflow: string | null;
};

type FlipProbeSample = {
  phase: "armed" | "before-click" | "after-click" | "mutation" | "animation-frame";
  timestamp: number;
  route: string;
  scrollTop: number;
  pageScrollTops: number[];
  transforms: string[];
  engineState: string | null;
  currentPageIndex: string | null;
  actualPageIndex: string | null;
  activePageIndex: string | null;
  activePageLogoCount: number;
  activeHeaderLogoCount: number;
  externalFloatingLogoCount: number;
  visibleLogoCount: number;
  fallbackVisible: boolean;
};

function nextDishLink(page: Page) {
  return page.getByRole("link", { name: /prochain plat/i });
}

function previousDishLink(page: Page) {
  return page.getByRole("link", { name: /plat.*dent/i });
}

async function openDetail(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  const response = await page.goto(detailPath, { waitUntil: "domcontentloaded" });
  const notFoundContent = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
  if (response?.status() === 404 || notFoundContent.includes("This page could not be found")) {
    throw new Error("Sauge Noire fixture setup failed: route returned 404.");
  }
  await expect(page.getByRole("heading", { name: /TRUITE/i })).toBeVisible();
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible();
  await expect.poll(async () => (await detailState(page)).currentScrollTop).toBe(0);
}

async function openCocktailDetail(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  const response = await page.goto(cocktailDetailPath, { waitUntil: "domcontentloaded" });
  const notFoundContent = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
  if (response?.status() === 404 || notFoundContent.includes("This page could not be found")) {
    throw new Error("Sauge Noire fixture setup failed: route returned 404.");
  }
  await expect(page.getByRole("heading", { name: /CENDRE ROSE/i })).toBeVisible();
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible();
}

async function detailState(page: Page): Promise<DetailState> {
  return page.evaluate(() => {
    const isVisible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        !element.closest('[aria-hidden="true"]')
      );
    };
    const physicalPages = Array.from(
      document.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]')
    );
    const currentPage = physicalPages.find(
      (element) =>
        isVisible(element) &&
        Boolean(element.querySelector('article:not([data-transition-preview="true"])'))
    );
    const currentArticle = currentPage?.querySelector<HTMLElement>(
      'article:not([data-transition-preview="true"])'
    );
    const currentHeader = currentArticle?.querySelector<HTMLElement>("header");
    const currentTitle = currentArticle?.querySelector<HTMLElement>("h1");
    const currentBack = currentHeader?.querySelector<HTMLElement>("a");
    const stfTransforms = Array.from(
      document.querySelectorAll<HTMLElement>(".stf__item")
    ).map((element) => getComputedStyle(element).transform);
    const logos = Array.from(
      document.querySelectorAll<HTMLElement>('[aria-label="Sauge Noire"]')
    );
    const visibleLogoCount = logos.filter(isVisible).length;
    const logo = currentHeader?.querySelector<HTMLElement>('[aria-label="Sauge Noire"]');
    const logoRect = logo?.getBoundingClientRect();
    const detailPage = document.querySelector<HTMLElement>(
      '[data-testid="sauge-noire-dish-detail"]'
    );
    const detailSurface = detailPage?.querySelector<HTMLElement>(
      '[data-detail-page-flip="true"]'
    );
    const detailPageStyle = detailPage ? getComputedStyle(detailPage) : null;
    const detailSurfaceStyle = detailSurface ? getComputedStyle(detailSurface) : null;
    const pageStyle = currentPage ? getComputedStyle(currentPage) : null;
    const rect = (element: Element | null) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { top: value.top, left: value.left, width: value.width, height: value.height };
    };
    const externalFloatingLogoCount = [
      ...(detailPage ? Array.from(detailPage.children) : []),
      ...(detailSurface ? Array.from(detailSurface.children) : [])
    ].filter((element) => element.matches('[aria-label="Sauge Noire"]')).length;
    const cssValue = (style: CSSStyleDeclaration | null, property: string) =>
      style?.getPropertyValue(property) || null;
    const fallbackVisible = Array.from(
      document.querySelectorAll<HTMLElement>('[data-page-flip-fallback]')
    ).some(isVisible);

    return {
      route: window.location.href,
      currentScrollTop: currentPage?.scrollTop ?? -1,
      scrollHeight: currentPage?.scrollHeight ?? 0,
      clientHeight: currentPage?.clientHeight ?? 0,
      stfTransforms,
      logoRect: logoRect ? { top: logoRect.top, left: logoRect.left } : null,
      visibleLogoCount,
      fallbackVisible,
      physicalPageCount: physicalPages.length,
      windowScrollY: window.scrollY,
      documentElementScrollTop: document.documentElement.scrollTop,
      detailPageRect: rect(detailPage),
      detailSurfaceRect: rect(detailSurface ?? null),
      visualViewport: window.visualViewport
        ? {
            offsetTop: window.visualViewport.offsetTop,
            height: window.visualViewport.height,
            width: window.visualViewport.width
          }
        : null,
      pageScrollTops: physicalPages.map((element) => ({
        scrollTop: element.scrollTop,
        isCurrent: element === currentPage,
        isVisible: isVisible(element),
        isClone: Boolean(element.closest('[data-sauge-flip-clone]'))
      })),
      headerRect: currentHeader
        ? { top: currentHeader.getBoundingClientRect().top, left: currentHeader.getBoundingClientRect().left }
        : null,
      titleRect: currentTitle
        ? { top: currentTitle.getBoundingClientRect().top, left: currentTitle.getBoundingClientRect().left }
        : null,
      titleCenter: currentTitle
        ? currentTitle.getBoundingClientRect().left + currentTitle.getBoundingClientRect().width / 2
        : null,
      backRect: currentBack
        ? { top: currentBack.getBoundingClientRect().top, left: currentBack.getBoundingClientRect().left }
        : null,
      externalFloatingLogoCount,
      activePageIndex: currentPage?.getAttribute("data-sauge-flip-page-index") ?? null,
      activePageLogoCount: currentPage?.querySelectorAll('[aria-label="Sauge Noire"]').length ?? 0,
      activeHeaderLogoCount: currentHeader?.querySelectorAll('[aria-label="Sauge Noire"]').length ?? 0,
      detailPageScrollTop: detailPage?.scrollTop ?? -1,
      detailSurfaceScrollTop: detailSurface?.scrollTop ?? -1,
      detailPageOverflow: detailPageStyle?.overflow ?? null,
      detailPageOverscrollBehavior: cssValue(detailPageStyle, "overscroll-behavior"),
      detailPagePosition: detailPageStyle?.position ?? null,
      detailPageInset: detailPageStyle?.inset ?? null,
      detailPageIsolation: detailPageStyle?.isolation ?? null,
      detailSurfaceOverflow: detailSurfaceStyle?.overflow ?? null,
      pageOverflow: pageStyle?.overflow ?? null
    };
  });
}

async function verticalGesture(
  page: Page,
  viewport: { width: number; height: number },
  direction: 1 | -1,
  browserName: string,
  amount = 520
) {
  const x = viewport.width / 2;
  const fromY = direction > 0 ? viewport.height * 0.78 : viewport.height * 0.24;
  let during: DetailState | undefined;
  if (browserName === "webkit") {
    // Mobile WebKit exposes tap but not a trusted drag API in Playwright.
    // PageDown/ArrowDown is the closest browser-level scroll input; no scrollTop
    // is mutated by the test. Real iPhone Safari touch remains device QA.
    const activePage = page.locator(activeDetailPageSelector).filter({
      has: page.locator('article:not([data-transition-preview="true"])')
    }).first();
    await expect.poll(
      () => activePage.evaluate((element) => element.scrollHeight - element.clientHeight),
      { timeout: 5_000 }
    ).toBeGreaterThan(0);
    await activePage.evaluate((element) => {
      (element as HTMLElement).tabIndex = 0;
      (element as HTMLElement).focus();
    });
    const initialScrollTop = await activePage.evaluate((element) => element.scrollTop);
    const key = direction > 0
      ? amount >= 500 ? "PageDown" : "ArrowDown"
      : amount >= 500 ? "PageUp" : "ArrowUp";
    const presses = amount >= 500 ? 1 : Math.max(1, Math.ceil(amount / 40));
    for (let index = 0; index < presses; index += 1) {
      await page.keyboard.press(key);
      if (index === Math.floor(presses / 2)) during = await detailState(page);
    }
    await expect.poll(
      () => activePage.evaluate((element, expected) => {
        const current = element.scrollTop;
        const maxScroll = element.scrollHeight - element.clientHeight;
        return expected.direction > 0
          ? current > expected.initialScrollTop || expected.initialScrollTop >= maxScroll - 1
          : current < expected.initialScrollTop || expected.initialScrollTop <= 1;
      }, { direction, initialScrollTop }),
      { timeout: 5_000 }
    ).toBe(true);
  } else {
    await page.mouse.move(x, fromY);
    await page.mouse.wheel(0, direction * amount);
    during = await detailState(page);
  }
  await page.waitForTimeout(80);
  const after = await detailState(page);
  return { during: during ?? after, after };
}

async function activeDetailScroll(page: Page) {
  return page.evaluate(() => {
    const currentPage = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-sauge-flip-page-index="1"]:not([data-sauge-flip-clone="true"]):not([aria-hidden="true"])'
      )
    ).find(
      (element) =>
        element.querySelector('article:not([data-transition-preview="true"])')
    );
    return {
      scrollTop: currentPage?.scrollTop ?? -1,
      maxScroll: currentPage ? currentPage.scrollHeight - currentPage.clientHeight : 0
    };
  });
}

async function scrollDetailByGesture(
  page: Page,
  viewport: { width: number; height: number },
  direction: 1 | -1,
  browserName: string,
  amount = 520
) {
  const before = await detailState(page);
  const gesture = await verticalGesture(page, viewport, direction, browserName, amount);
  if (direction > 0) {
    expect(gesture.after.currentScrollTop).toBeGreaterThanOrEqual(before.currentScrollTop);
  } else {
    expect(gesture.after.currentScrollTop).toBeLessThanOrEqual(before.currentScrollTop);
  }
  return { before, ...gesture, after: await detailState(page) };
}

async function scrollDetailToOffset(
  page: Page,
  viewport: { width: number; height: number },
  target: number,
  browserName: string
) {
  const metrics = await activeDetailScroll(page);
  const desired = Math.min(Math.max(0, target), metrics.maxScroll);
  const direction: 1 | -1 = desired >= metrics.scrollTop ? 1 : -1;
  const amount = Math.max(1, Math.abs(desired - metrics.scrollTop));
  const result = await scrollDetailByGesture(page, viewport, direction, browserName, amount);
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  expect(result.after.currentScrollTop).toBeGreaterThan(0);
  expect(result.after.currentScrollTop).toBeLessThanOrEqual(
    result.after.scrollHeight - result.after.clientHeight + 1
  );
  return result.after;
}

async function scrollDetailToBottom(
  page: Page,
  viewport: { width: number; height: number },
  browserName: string
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const metrics = await activeDetailScroll(page);
    if (metrics.scrollTop >= metrics.maxScroll - 1) return detailState(page);
    await scrollDetailByGesture(page, viewport, 1, browserName);
  }
  const metrics = await activeDetailScroll(page);
  expect(metrics.scrollTop).toBeGreaterThanOrEqual(metrics.maxScroll - 1);
  return detailState(page);
}

async function scrollDetailToTop(
  page: Page,
  viewport: { width: number; height: number },
  browserName: string
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const metrics = await activeDetailScroll(page);
    if (metrics.scrollTop === 0) return detailState(page);
    await scrollDetailByGesture(page, viewport, -1, browserName);
  }
  await expect.poll(async () => (await activeDetailScroll(page)).scrollTop).toBe(0);
  return detailState(page);
}

async function waitForRealFlip(page: Page, before: DetailState) {
  const readTransitionSample = () => page.evaluate((expected) => {
    const probe = (window as typeof window & {
      __saugeFlipProbe?: { samples: FlipProbeSample[] };
    }).__saugeFlipProbe;
    const initialActualPageIndex = probe?.samples[0]?.actualPageIndex ?? null;
    const isVisualTransform = (transform: string) => {
      if (transform === "none") return false;
      const values = transform.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      return !(
        values.length === 6 &&
        values[0] === 1 && values[1] === 0 && values[2] === 0 &&
        values[3] === 1 && values[4] === 0 && values[5] === 0
      );
    };
    const sample = probe?.samples.find((candidate) => {
      const transformChanged = candidate.transforms.some(
        (transform, index) =>
          transform !== expected.transforms[index] && isVisualTransform(transform)
      );
      const flipWasObserved =
        candidate.engineState === "flipping" ||
        (
          initialActualPageIndex !== null &&
          candidate.actualPageIndex !== null &&
          candidate.actualPageIndex !== initialActualPageIndex
        ) ||
        transformChanged;
      return (
        candidate.phase !== "armed" &&
        candidate.phase !== "before-click" &&
        candidate.route === expected.route &&
        candidate.scrollTop === expected.scrollTop &&
        candidate.visibleLogoCount === 1 &&
        candidate.activePageIndex === expected.activePageIndex &&
        candidate.activePageLogoCount === 1 &&
        candidate.activeHeaderLogoCount === 1 &&
        candidate.externalFloatingLogoCount === 0 &&
        !candidate.fallbackVisible &&
        flipWasObserved
      );
    });
    return sample ?? null;
  }, {
    route: before.route,
    scrollTop: before.currentScrollTop,
    transforms: before.stfTransforms,
    activePageIndex: before.activePageIndex
  });
  await expect
    .poll(async () => Boolean(await readTransitionSample()), {
      timeout: 10_000,
      intervals: [10, 20, 40, 80, 160]
    })
    .toBe(true);
  const transitionSample = await readTransitionSample();

  expect(transitionSample).not.toBeNull();
  expect(transitionSample!.route).toBe(before.route);
  expect(transitionSample!.scrollTop).toBe(before.currentScrollTop);
  expect(transitionSample!.activePageIndex).toBe(before.activePageIndex);
  expect(transitionSample!.activePageLogoCount).toBe(1);
  expect(transitionSample!.activeHeaderLogoCount).toBe(1);
  expect(transitionSample!.externalFloatingLogoCount).toBe(0);
  await expect.poll(() => page.evaluate(() => {
    const samples = (window as typeof window & {
      __saugeFlipProbe?: { samples: FlipProbeSample[] };
    }).__saugeFlipProbe?.samples ?? [];
    const stateTransitions = samples
      .map((sample) => sample.engineState)
      .filter((state, index, states) => state !== null && state !== states[index - 1]);
    const flippingIndex = stateTransitions.indexOf("flipping");
    return flippingIndex >= 0 && stateTransitions.slice(flippingIndex + 1).includes("read");
  })).toBe(true);
  const flipCycles = await page.evaluate(() => {
    const samples = (window as typeof window & {
      __saugeFlipProbe?: { samples: FlipProbeSample[] };
    }).__saugeFlipProbe?.samples ?? [];
    return samples
      .map((sample) => sample.engineState)
      .filter((state, index, states) => state !== null && state !== states[index - 1])
      .filter((state) => state === "flipping").length;
  });
  expect(flipCycles).toBe(1);
}

async function armFlipProbe(page: Page) {
  await page.evaluate(() => {
    const probe = {
      samples: [] as FlipProbeSample[],
      capture: null as null | ((phase: FlipProbeSample["phase"]) => void),
      observer: null as MutationObserver | null
    };
    const isVisible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 &&
        rect.width > 0 && rect.height > 0 && !element.closest('[aria-hidden="true"]');
    };
    const capture = (phase: FlipProbeSample["phase"]) => {
      if (probe.samples.length >= 1_200) {
        return;
      }
      const currentPage = [...document.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]')].find(
        (element) => isVisible(element) && element.querySelector('article:not([data-transition-preview="true"])')
      );
      const currentArticle = currentPage?.querySelector<HTMLElement>('article:not([data-transition-preview="true"])');
      const currentHeader = currentArticle?.querySelector<HTMLElement>("header");
      const detail = document.querySelector<HTMLElement>('[data-testid="sauge-noire-dish-detail"]');
      const detailSurface = detail?.querySelector<HTMLElement>('[data-detail-page-flip="true"]');
      const viewport = detailSurface?.querySelector<HTMLElement>("[data-page-flip-state]");
      const externalFloatingLogoCount = [
        ...(detail ? [...detail.children] : []),
        ...(detailSurface ? [...detailSurface.children] : [])
      ].filter((element) => element.matches('[aria-label="Sauge Noire"]')).length;
      const pageScrollTops = [...document.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]')].map(
        (element) => element.scrollTop
      );
      probe.samples.push({
        phase,
        timestamp: performance.now(),
        route: window.location.href,
        scrollTop: currentPage?.scrollTop ?? 0,
        pageScrollTops,
        transforms: [...document.querySelectorAll<HTMLElement>(".stf__item")].map(
          (element) => getComputedStyle(element).transform
        ),
        engineState: viewport?.getAttribute("data-page-flip-engine-state") ?? null,
        currentPageIndex: viewport?.getAttribute("data-page-flip-current-page") ?? null,
        actualPageIndex: viewport?.getAttribute("data-page-flip-actual-page") ?? null,
        activePageIndex: currentPage?.getAttribute("data-sauge-flip-page-index") ?? null,
        activePageLogoCount: currentPage?.querySelectorAll('[aria-label="Sauge Noire"]').length ?? 0,
        activeHeaderLogoCount: currentHeader?.querySelectorAll('[aria-label="Sauge Noire"]').length ?? 0,
        externalFloatingLogoCount,
        visibleLogoCount: [...document.querySelectorAll<HTMLElement>('[aria-label="Sauge Noire"]')].filter(isVisible).length,
        fallbackVisible: [...document.querySelectorAll<HTMLElement>('[data-page-flip-fallback]')].some(isVisible)
      });
    };
    probe.capture = capture;
    probe.observer = new MutationObserver(() => capture("mutation"));
    probe.observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        "data-page-flip-actual-page",
        "data-page-flip-current-page",
        "data-page-flip-engine-state"
      ]
    });
    (window as typeof window & {
      __saugeFlipProbe?: typeof probe;
    }).__saugeFlipProbe = probe;
    capture("armed");
    const sampleFrame = () => {
      capture("animation-frame");
      if (probe.samples.length < 600) requestAnimationFrame(sampleFrame);
    };
    requestAnimationFrame(sampleFrame);
  });
}

function assertDishSheetChrome(state: DetailState, label: string) {
  expect(state.logoRect, `${label} should expose the SN`).not.toBeNull();
  expect(state.visibleLogoCount, `${label} should expose one visible SN`).toBe(1);
  expect(state.externalFloatingLogoCount, `${label} should not expose an external floating SN`).toBe(0);
  expect(state.activePageLogoCount, `${label} active PageFlip sheet should contain one SN`).toBe(1);
  expect(state.activeHeaderLogoCount, `${label} active detail header should contain one SN`).toBe(1);
  expect(state.activePageIndex, `${label} should expose an active PageFlip sheet`).not.toBeNull();
  expect(state.windowScrollY, `${label} window scrolled`).toBe(0);
  expect(state.documentElementScrollTop, `${label} document scrolled`).toBe(0);
  expect(state.detailPageScrollTop, `${label} detail shell scrolled`).toBe(0);
  expect(state.detailSurfaceScrollTop, `${label} detail surface scrolled`).toBe(0);
  expect(state.detailPageRect?.top, `${label} detail shell moved vertically`).toBe(0);
  expect(state.detailPageRect?.left, `${label} detail shell moved horizontally`).toBe(0);
  expect(state.detailSurfaceRect?.top, `${label} detail surface moved vertically`).toBe(0);
  expect(state.pageScrollTops.filter((entry) => entry.scrollTop > 0).length, `${label} multiple pages scrolled`).toBeLessThanOrEqual(1);
}

function assertDishMovesTogether(before: DetailState, after: DetailState, label: string) {
  expect(after.logoRect, `${label} should expose the SN after scroll`).not.toBeNull();
  expect(after.headerRect, `${label} should expose the header after scroll`).not.toBeNull();
  expect(after.titleRect, `${label} should expose the title after scroll`).not.toBeNull();
  expect(after.backRect, `${label} should expose the back control after scroll`).not.toBeNull();
  expect(after.logoRect!.top, `${label} SN did not move with the sheet`).toBeLessThan(before.logoRect!.top - 1);
  expect(after.headerRect!.top, `${label} header did not move with the sheet`).toBeLessThan(before.headerRect!.top - 1);
  expect(after.backRect!.top, `${label} back control did not move with the sheet`).toBeLessThan(before.backRect!.top - 1);
  expect(after.titleRect!.top, `${label} title did not move with the sheet`).toBeLessThan(before.titleRect!.top - 1);

  for (const [name, beforeGap, afterGap] of [
    ["SN/title", before.logoRect!.top - before.titleRect!.top, after.logoRect!.top - after.titleRect!.top],
    ["SN/back", before.logoRect!.top - before.backRect!.top, after.logoRect!.top - after.backRect!.top],
    ["SN/title-center", before.logoRect!.left - before.titleCenter!, after.logoRect!.left - after.titleCenter!]
  ] as const) {
    expect(Math.abs(afterGap - beforeGap), `${label} ${name} relative gap changed`).toBeLessThanOrEqual(1);
  }
}

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  const isFrameworkNoise = (message: string) =>
    message.includes("__nextjs_original-stack-frames") || message === "TypeError: Load failed";
  page.on("console", (message) => {
    if (message.type() === "error" && !isFrameworkNoise(message.text())) errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (!isFrameworkNoise(error.message)) errors.push(error.message);
  });
  return errors;
}

async function clickAndAssertFlip(
  page: Page,
  link: Locator,
  expectedPath: RegExp
) {
  await expect(link).toHaveCount(1);
  const before = await detailState(page);
  expect(before.currentScrollTop).toBeGreaterThan(0);
  expect(before.physicalPageCount).toBe(3);

  await armFlipProbe(page);
  await link.evaluate((element) => {
    const probe = (window as typeof window & {
      __saugeFlipProbe?: {
        capture: (phase: FlipProbeSample["phase"]) => void;
      };
    }).__saugeFlipProbe;
    probe?.capture("before-click");
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    probe?.capture("after-click");
  });
  await waitForRealFlip(page, before);
  await expect(page).toHaveURL(expectedPath);
  await expect(page.getByRole("heading", { name: /HAMACHI|TRUITE/i })).toBeVisible();
  await expect.poll(async () => (await detailState(page)).currentScrollTop).toBe(0);

  const after = await detailState(page);
  expect(after.route).toMatch(expectedPath);
  expect(after.currentScrollTop).toBe(0);
  expect(after.visibleLogoCount).toBe(1);
  expect(after.fallbackVisible).toBe(false);
  expect(after.physicalPageCount).toBe(3);
  assertDishSheetChrome(after, "after route change");
}

async function swipeAndAssertFlip(
  page: Page,
  expectedPath: RegExp,
  from: { x: number; y: number },
  to: { x: number; y: number },
  browserName: string
) {
  const before = await detailState(page);
  expect(before.currentScrollTop).toBeGreaterThan(0);
  await armFlipProbe(page);
  if (browserName === "webkit") {
    await page.evaluate(({ from, to }) => {
      const viewport = document.querySelector<HTMLElement>('[data-page-flip-state="ready"]');
      if (!viewport) throw new Error("Expected the ready PageFlip viewport");
      const dispatch = (
        type: "touchstart" | "touchmove" | "touchend",
        touches: Array<{ clientX: number; clientY: number }>,
        changedTouches: Array<{ clientX: number; clientY: number }>
      ) => {
        const event = new Event(type, {
          bubbles: true,
          cancelable: true
        });
        Object.defineProperty(event, "touches", { value: touches });
        Object.defineProperty(event, "changedTouches", { value: changedTouches });
        viewport.dispatchEvent(event);
      };
      const middle = {
        x: from.x + (to.x - from.x) * 0.5,
        y: from.y + (to.y - from.y) * 0.5
      };
      const startTouch = { clientX: from.x, clientY: from.y };
      const middleTouch = { clientX: middle.x, clientY: middle.y };
      const endTouch = { clientX: to.x, clientY: to.y };
      dispatch("touchstart", [startTouch], [startTouch]);
      dispatch("touchmove", [middleTouch], [middleTouch]);
      dispatch("touchend", [], [endTouch]);
    }, { from, to });
  } else {
    await drag(page, from, to);
  }
  await waitForRealFlip(page, before);
  await expect(page).toHaveURL(expectedPath);
  await expect.poll(async () => (await detailState(page)).currentScrollTop).toBe(0);
  const after = await detailState(page);
  expect(after.visibleLogoCount).toBe(1);
  expect(after.fallbackVisible).toBe(false);
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

test.describe("Sauge Noire dish detail PageFlip", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    test(`uses cocktail terminology in signature drink details at ${viewport.width}px`, async ({ page }) => {
      await openCocktailDetail(page, viewport.width, viewport.height);

      const activeArticle = page.locator(
        '[class*="pageFlipPage"]:not([aria-hidden="true"]) article:not([data-transition-preview="true"])'
      ).first();
      const categoryKicker = activeArticle.locator('[class*="categoryKicker"]');
      await expect(categoryKicker).toHaveText("Cocktail signature");
      await expect(categoryKicker).not.toContainText("Plat signature");
      const backLink = activeArticle.getByRole("link", { name: /Retour à Cocktail signature/i });
      await expect(backLink).toBeVisible();
      await expect.poll(async () => backLink.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        whiteSpace: getComputedStyle(element).whiteSpace
      }))).toEqual({
        clientWidth: expect.any(Number),
        scrollWidth: expect.any(Number),
        whiteSpace: "nowrap"
      });
      const backMetrics = await backLink.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
      }));
      expect(backMetrics.scrollWidth).toBeLessThanOrEqual(backMetrics.clientWidth + 1);
    });
  }

  test("keeps the detail backdrop beige around the paper", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 1280, height: 900 }
    ]) {
      await openDetail(page, viewport.width, viewport.height);

      const backdrop = await page.evaluate(() => {
        const detail = document.querySelector<HTMLElement>('[data-testid="sauge-noire-dish-detail"]');
        const paper = detail?.querySelector<HTMLElement>('article:not([data-transition-preview="true"])');
        const detailStyle = detail ? getComputedStyle(detail) : null;
        const paperStyle = paper ? getComputedStyle(paper) : null;
        return {
          detailBackground: detailStyle?.backgroundColor,
          detailTexture: detailStyle?.backgroundImage,
          paperBackground: paperStyle?.backgroundColor,
          paperTexture: paperStyle?.backgroundImage,
          documentHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
        };
      });

      expect(backdrop.detailBackground, `${viewport.width}px detail backdrop should be paper`).toBe("rgb(250, 244, 233)");
      expect(backdrop.detailTexture, `${viewport.width}px detail backdrop should keep the paper texture`).toContain("radial-gradient");
      expect(backdrop.paperBackground).toBe("rgb(250, 244, 233)");
      expect(backdrop.paperTexture).toContain("radial-gradient");
      expect(backdrop.documentHasHorizontalOverflow).toBe(false);
    }
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    test(`keeps scroll and route stable until a real next/previous flip at ${viewport.width}px`, async ({ page, browserName }) => {
      const errors = collectPageErrors(page);
      await openDetail(page, viewport.width, viewport.height);
      await expect(page.locator('[class*="detailPageTurn"]')).toHaveCount(0);
      await expect(page.locator('[aria-label="Sauge Noire"]:visible')).toHaveCount(1);

      await scrollDetailToOffset(page, viewport, 360, browserName);
      const initialUrl = page.url();
      await clickAndAssertFlip(page, nextDishLink(page), /\/dishes\/hamachi-a-la-verveine/);
      expect(initialUrl).not.toBe(page.url());

      const hamachiUrl = page.url();
      await scrollDetailToOffset(page, viewport, 300, browserName);
      await clickAndAssertFlip(page, previousDishLink(page), /\/dishes\/truite-des-laurentides/);
      expect(hamachiUrl).not.toBe(page.url());
      await expect(page).toHaveURL(/lang=fr-CA/);
      await expect(page).toHaveURL(/currency=CAD/);
      await expect(page).toHaveURL(/table=main/);
      await expect(page).toHaveURL(/zone=terrasse/);
      expect(errors, `${viewport.width}px emitted console errors`).toEqual([]);
    });

    test(`keeps the SN attached to the scrolling detail sheet at ${viewport.width}px`, async ({ page, browserName }) => {
      const errors = collectPageErrors(page);
      await openDetail(page, viewport.width, viewport.height);
      const before = await detailState(page);
      assertDishSheetChrome(before, `${browserName} ${viewport.width}px top`);
      expect(before.windowScrollY).toBe(0);
      expect(before.detailPageScrollTop).toBe(0);
      expect(before.detailSurfaceScrollTop).toBe(0);
      expect(before.detailPagePosition).toBe("fixed");
      expect(before.detailPageInset).toBe("0px");
      expect(before.detailPageOverflow).toBe("hidden");
      if (browserName !== "webkit") {
        expect(before.detailPageOverscrollBehavior).toBe("none");
      }
      expect(before.detailPageIsolation).toBe("isolate");
      expect(before.detailSurfaceOverflow).toBe("hidden");
      expect(before.pageOverflow).toBe("auto");

      expect(before.detailPageRect?.top).toBe(0);
      expect(before.detailPageRect?.left).toBe(0);
      expect(before.detailSurfaceRect?.top).toBe(0);

      const midGesture = await scrollDetailToOffset(page, viewport, 360, browserName);
      assertDishSheetChrome(midGesture, `${browserName} ${viewport.width}px middle`);
      assertDishMovesTogether(before, midGesture, `${browserName} ${viewport.width}px middle`);
      expect(midGesture.currentScrollTop).toBeGreaterThan(0);
      const duringMid = await detailState(page);
      assertDishSheetChrome(duringMid, `${browserName} ${viewport.width}px after gesture`);

      const bottom = await scrollDetailToBottom(page, viewport, browserName);
      assertDishSheetChrome(bottom, `${browserName} ${viewport.width}px bottom`);
      assertDishMovesTogether(before, bottom, `${browserName} ${viewport.width}px bottom`);
      expect(bottom.currentScrollTop).toBeGreaterThanOrEqual(bottom.scrollHeight - bottom.clientHeight - 1);

      const top = await scrollDetailToTop(page, viewport, browserName);
      assertDishSheetChrome(top, `${browserName} ${viewport.width}px top again`);
      expect(top.currentScrollTop).toBe(0);
      expect(top.visualViewport).not.toBeNull();
      expect(errors, `${browserName} ${viewport.width}px emitted console errors`).toEqual([]);
    });

    test(`uses the same animated path for left and right swipes at ${viewport.width}px`, async ({ page, browserName }) => {
      const errors = collectPageErrors(page);
      await openDetail(page, viewport.width, viewport.height);
      await expect(page.locator('[aria-label="Sauge Noire"]:visible')).toHaveCount(1);

      await scrollDetailToOffset(page, viewport, 360, browserName);
      await swipeAndAssertFlip(
        page,
        /\/dishes\/hamachi-a-la-verveine/,
        { x: viewport.width - 70, y: 430 },
        { x: 70, y: 430 },
        browserName
      );

      await scrollDetailToOffset(page, viewport, 300, browserName);
      await swipeAndAssertFlip(
        page,
        /\/dishes\/truite-des-laurentides/,
        { x: 70, y: 430 },
        { x: viewport.width - 70, y: 430 },
        browserName
      );
      expect(errors, `${viewport.width}px emitted console errors`).toEqual([]);
    });
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    test(`keeps the exact reading position while opening and closing 3D at ${viewport.width}px`, async ({ page, browserName }) => {
      await openDetail(page, viewport.width, viewport.height);
      await scrollDetailToOffset(page, viewport, 500, browserName);
      const before = await detailState(page);
      expect(before.currentScrollTop).toBeGreaterThan(0);
      const routeBefore = page.url();

      const showButton = page.getByRole("button", { name: "VOIR EN 3D" });
      await expect(showButton).toHaveCount(1);
      await showButton.click();
      const modelStage = page.locator('[class*="modelStage"]');
      await expect(modelStage).toBeVisible();
      const afterOpen = await detailState(page);
      expect(Math.abs(afterOpen.currentScrollTop - before.currentScrollTop)).toBeLessThanOrEqual(1);
      expect(afterOpen.windowScrollY).toBe(0);
      expect(page.url()).toBe(routeBefore);

      await expect
        .poll(() => modelStage.locator("model-viewer").count(), { timeout: 15_000 })
        .toBeGreaterThan(0);
      const afterModelMount = await detailState(page);
      expect(Math.abs(afterModelMount.currentScrollTop - before.currentScrollTop)).toBeLessThanOrEqual(1);

      await page.getByRole("button", { name: "MASQUER LA 3D" }).click();
      await expect(modelStage).toBeHidden();
      const afterClose = await detailState(page);
      expect(Math.abs(afterClose.currentScrollTop - before.currentScrollTop)).toBeLessThanOrEqual(1);
      expect(afterClose.windowScrollY).toBe(0);
      expect(page.url()).toBe(routeBefore);
    });
  }

  test("keeps vertical scrolling, pointercancel, 3D and duplicate clicks isolated", async ({ page, browserName }) => {
    const errors = collectPageErrors(page);
    const viewport = { width: 390, height: 844 };
    await openDetail(page, viewport.width, viewport.height);

    await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>("[data-page-flip-state]");
      if (!viewport) return;
      (window as typeof window & { __saugeGotPointerCapture?: boolean }).__saugeGotPointerCapture = false;
      viewport.addEventListener("gotpointercapture", () => {
        (window as typeof window & { __saugeGotPointerCapture?: boolean }).__saugeGotPointerCapture = true;
      }, { once: true });
    });

    const beforeVerticalUrl = page.url();
    const verticalGestureResult = await scrollDetailByGesture(page, viewport, 1, browserName);
    assertDishSheetChrome(verticalGestureResult.during, "3D test during vertical gesture");
    assertDishSheetChrome(verticalGestureResult.after, "3D test after vertical gesture");
    expect(page.url()).toBe(beforeVerticalUrl);

    await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>("[data-page-flip-state]");
      if (!viewport) return;
      viewport.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 77,
        pointerType: "touch",
        clientX: 290,
        clientY: 360
      }));
      viewport.dispatchEvent(new PointerEvent("pointercancel", {
        bubbles: true,
        cancelable: true,
        pointerId: 77,
        pointerType: "touch",
        clientX: 290,
        clientY: 360
      }));
    });
    await expect.poll(() => page.url()).toBe(beforeVerticalUrl);

    const modelButton = page.getByRole("button", { name: "VOIR EN 3D" });
    if (await modelButton.count()) {
      await modelButton.click();
      const modelStage = page.locator('[class*="modelStage"]');
      await expect(modelStage).toBeVisible();
      const box = await modelStage.boundingBox();
      expect(box).not.toBeNull();
      await drag(page, { x: box!.x + box!.width * 0.7, y: box!.y + box!.height * 0.5 }, { x: box!.x + box!.width * 0.3, y: box!.y + box!.height * 0.5 });
      expect(page.url()).toBe(beforeVerticalUrl);
      assertDishSheetChrome(await detailState(page), "3D open");
      await page.getByRole("button", { name: "MASQUER LA 3D" }).click();
      await expect(modelStage).toBeHidden();
      assertDishSheetChrome(await detailState(page), "3D closed");
    }

    await page.goto(detailPath, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible();
    await scrollDetailToOffset(page, viewport, 360, browserName);
    const next = nextDishLink(page);
    await expect(next).toHaveCount(1);
    const beforeDoubleNavigation = await detailState(page);
    await armFlipProbe(page);
    await next.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    await waitForRealFlip(page, beforeDoubleNavigation);
    await expect(page).toHaveURL(/\/dishes\/hamachi-a-la-verveine/);
    await expect(page).not.toHaveURL(/boeuf-cru-au-couteau/);
    await expect.poll(async () => (await detailState(page)).currentScrollTop).toBe(0);
    expect(errors, "vertical/3D test emitted console errors").toEqual([]);
  });
});
