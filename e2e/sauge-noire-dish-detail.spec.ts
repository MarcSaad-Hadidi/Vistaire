import { expect, test, type Locator, type Page } from "@playwright/test";

const detailPath =
  "/menu/sauge-noire/dishes/truite-des-laurentides?lang=fr-CA&currency=CAD&view=sauge-3&table=main&zone=terrasse";

type DetailState = {
  route: string;
  currentScrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  stfTransforms: string[];
  logoRect: { top: number; left: number } | null;
  visibleLogoCount: number;
  fallbackVisible: boolean;
  physicalPageCount: number;
  windowScrollY: number;
  documentElementScrollTop: number;
  detailPageRect: { top: number; left: number; width: number; height: number } | null;
  detailSurfaceRect: { top: number; left: number; width: number; height: number } | null;
  visualViewport: { offsetTop: number; height: number; width: number } | null;
  pageScrollTops: Array<{ scrollTop: number; isCurrent: boolean; isVisible: boolean; isClone: boolean }>;
  logoParentIsShell: boolean;
  logoInsidePageFlip: boolean;
  logoInsideScrollContainer: boolean;
  logoInsideTransformedAncestor: boolean;
  logoAncestors: Array<{
    tag: string;
    className: string;
    position: string;
    transform: string;
    perspective: string;
    filter: string;
    contain: string;
    willChange: string;
    overflow: string;
    rect: { top: number; left: number; width: number; height: number };
  }>;
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
  route: string;
  scrollTop: number;
  pageScrollTops: number[];
  transforms: string[];
  logoTop: number | null;
  logoLeft: number | null;
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
  await page.goto(detailPath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /TRUITE/i })).toBeVisible();
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible();
  await expect.poll(async () => (await detailState(page)).currentScrollTop).toBe(0);
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
    const stfTransforms = Array.from(
      document.querySelectorAll<HTMLElement>(".stf__item")
    ).map((element) => getComputedStyle(element).transform);
    const visibleLogoCount = Array.from(
      document.querySelectorAll<HTMLElement>('[aria-label="Sauge Noire"]')
    ).filter(isVisible).length;
    const logo = Array.from(
      document.querySelectorAll<HTMLElement>('[aria-label="Sauge Noire"]')
    ).find(isVisible);
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
    const logoAncestors: DetailState["logoAncestors"] = [];
    let logoInsideScrollContainer = false;
    let logoInsideTransformedAncestor = false;
    let ancestor = logo?.parentElement ?? null;
    while (ancestor) {
      const style = getComputedStyle(ancestor);
      const ancestorRect = ancestor.getBoundingClientRect();
      logoAncestors.push({
        tag: ancestor.tagName,
        className: String(ancestor.className),
        position: style.position,
        transform: style.transform,
        perspective: style.perspective,
        filter: style.filter,
        contain: style.contain,
        willChange: style.willChange,
        overflow: style.overflow,
        rect: {
          top: ancestorRect.top,
          left: ancestorRect.left,
          width: ancestorRect.width,
          height: ancestorRect.height
        }
      });
      const canScroll = ancestor.scrollHeight > ancestor.clientHeight + 1 ||
        ancestor.scrollWidth > ancestor.clientWidth + 1;
      if (canScroll && /(auto|scroll|overlay|clip)/.test(`${style.overflow} ${style.overflowY} ${style.overflowX}`)) {
        logoInsideScrollContainer = true;
      }
      if (
        style.transform !== "none" ||
        style.perspective !== "none" ||
        style.filter !== "none" ||
        style.willChange.includes("transform")
      ) {
        logoInsideTransformedAncestor = true;
      }
      ancestor = ancestor.parentElement;
    }
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
      logoParentIsShell: logo?.parentElement === detailPage,
      logoInsidePageFlip: Boolean(
        logo?.closest('.stf__item, [class*="pageFlipPage"], [data-sauge-flip-clone]')
      ),
      logoInsideScrollContainer,
      logoInsideTransformedAncestor,
      logoAncestors,
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
    const activePage = page.locator('[class*="pageFlipPage"]:not([aria-hidden="true"])').filter({
      has: page.locator('article:not([data-transition-preview="true"])')
    }).first();
    await activePage.evaluate((element) => {
      (element as HTMLElement).tabIndex = 0;
      (element as HTMLElement).focus();
    });
    const key = direction > 0
      ? amount >= 500 ? "PageDown" : "ArrowDown"
      : amount >= 500 ? "PageUp" : "ArrowUp";
    const presses = amount >= 500 ? 1 : Math.max(1, Math.ceil(amount / 40));
    for (let index = 0; index < presses; index += 1) {
      await activePage.press(key);
      if (index === Math.floor(presses / 2)) during = await detailState(page);
    }
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
      document.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]')
    ).find(
      (element) =>
        !element.closest('[aria-hidden="true"]') &&
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
    expect(gesture.after.currentScrollTop).toBeGreaterThan(before.currentScrollTop);
  } else {
    expect(gesture.after.currentScrollTop).toBeLessThan(before.currentScrollTop);
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
  expect(result.after.currentScrollTop).toBeLessThanOrEqual(metrics.maxScroll + 1);
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

async function waitForRealFlip(page: Page, before: DetailState, browserName: string) {
  const readTransitionSample = () => page.evaluate((expected) => {
    const probe = (window as typeof window & {
      __saugeFlipProbe?: { samples: FlipProbeSample[] };
    }).__saugeFlipProbe;
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
      return (
        candidate.route === expected.route &&
        candidate.scrollTop === expected.scrollTop &&
        candidate.visibleLogoCount === 1 &&
        !candidate.fallbackVisible &&
        candidate.logoTop !== null &&
        candidate.logoLeft !== null &&
        Math.abs(candidate.logoTop - expected.logoTop) <= 1 &&
        Math.abs(candidate.logoLeft - expected.logoLeft) <= 1 &&
        (transformChanged || expected.allowLifecycleOnly)
      );
    });
    return sample ?? null;
  }, {
    route: before.route,
    scrollTop: before.currentScrollTop,
    transforms: before.stfTransforms,
    logoTop: before.logoRect?.top ?? 0,
    logoLeft: before.logoRect?.left ?? 0,
    // Playwright WebKit collapses this library's CSS transform to an identity
    // matrix; Chromium still requires a non-identity .stf__item transform.
    allowLifecycleOnly: browserName === "webkit"
  });
  await expect
    .poll(async () => Boolean(await readTransitionSample()), { timeout: 3_000, intervals: [10, 20, 40, 80] })
    .toBe(true);
  const transitionSample = await readTransitionSample();

  expect(transitionSample).not.toBeNull();
  expect(transitionSample!.route).toBe(before.route);
  expect(transitionSample!.scrollTop).toBe(before.currentScrollTop);
  expect(transitionSample!.logoTop).not.toBeNull();
  expect(transitionSample!.logoLeft).not.toBeNull();
  expect(Math.abs(transitionSample!.logoTop! - before.logoRect!.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(transitionSample!.logoLeft! - before.logoRect!.left)).toBeLessThanOrEqual(1);
}

async function armFlipProbe(page: Page) {
  await page.evaluate(() => {
    const probe = { samples: [] as FlipProbeSample[] };
    (window as typeof window & {
      __saugeFlipProbe?: { samples: FlipProbeSample[] };
    }).__saugeFlipProbe = probe;
    const isVisible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 &&
        rect.width > 0 && rect.height > 0 && !element.closest('[aria-hidden="true"]');
    };
    const sample = () => {
      const logo = [...document.querySelectorAll<HTMLElement>('[aria-label="Sauge Noire"]')].find(isVisible);
      const currentPage = [...document.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]')].find(
        (element) => isVisible(element) && element.querySelector('article:not([data-transition-preview="true"])')
      );
      const pageScrollTops = [...document.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]')].map(
        (element) => element.scrollTop
      );
      const logoRect = logo?.getBoundingClientRect();
      probe.samples.push({
        route: window.location.href,
        scrollTop: Math.max(currentPage?.scrollTop ?? 0, ...pageScrollTops),
        pageScrollTops,
        transforms: [...document.querySelectorAll<HTMLElement>(".stf__item")].map(
          (element) => getComputedStyle(element).transform
        ),
        logoTop: logoRect?.top ?? null,
        logoLeft: logoRect?.left ?? null,
        visibleLogoCount: [...document.querySelectorAll<HTMLElement>('[aria-label="Sauge Noire"]')].filter(isVisible).length,
        fallbackVisible: [...document.querySelectorAll<HTMLElement>('[data-page-flip-fallback]')].some(isVisible)
      });
      if (probe.samples.length < 120) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

function assertStableLogo(before: DetailState, after: DetailState, label: string) {
  expect(after.logoRect, `${label} should expose the SN`).not.toBeNull();
  expect(after.visibleLogoCount, `${label} should expose one visible SN`).toBe(1);
  expect(after.logoParentIsShell, `${label} SN should belong to the fixed shell`).toBe(true);
  expect(after.logoInsidePageFlip, `${label} SN entered PageFlip`).toBe(false);
  expect(after.logoInsideScrollContainer, `${label} SN entered a scroll container`).toBe(false);
  expect(after.logoInsideTransformedAncestor, `${label} SN entered a transformed ancestor`).toBe(false);
  expect(Math.abs(after.logoRect!.top - before.logoRect!.top), `${label} SN top moved`).toBeLessThanOrEqual(1);
  expect(Math.abs(after.logoRect!.left - before.logoRect!.left), `${label} SN left moved`).toBeLessThanOrEqual(1);
  expect(after.windowScrollY, `${label} window scrolled`).toBe(0);
  expect(after.documentElementScrollTop, `${label} document scrolled`).toBe(0);
  expect(after.detailPageScrollTop, `${label} detail shell scrolled`).toBe(0);
  expect(after.detailSurfaceScrollTop, `${label} detail surface scrolled`).toBe(0);
  expect(after.detailPageRect?.top, `${label} detail shell moved vertically`).toBe(0);
  expect(after.detailPageRect?.left, `${label} detail shell moved horizontally`).toBe(0);
  expect(after.detailSurfaceRect?.top, `${label} detail surface moved vertically`).toBe(0);
  expect(after.pageScrollTops.filter((entry) => entry.scrollTop > 0).length, `${label} multiple pages scrolled`).toBeLessThanOrEqual(1);
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
  expectedPath: RegExp,
  browserName: string
) {
  await expect(link).toHaveCount(1);
  const before = await detailState(page);
  expect(before.currentScrollTop).toBeGreaterThan(0);
  expect(before.physicalPageCount).toBe(3);

  await armFlipProbe(page);
  await link.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
  await waitForRealFlip(page, before, browserName);
  await expect(page).toHaveURL(expectedPath);
  await expect(page.getByRole("heading", { name: /HAMACHI|TRUITE/i })).toBeVisible();
  await expect.poll(async () => (await detailState(page)).currentScrollTop).toBe(0);

  const after = await detailState(page);
  expect(after.route).toMatch(expectedPath);
  expect(after.currentScrollTop).toBe(0);
  expect(after.visibleLogoCount).toBe(1);
  expect(after.fallbackVisible).toBe(false);
  expect(after.physicalPageCount).toBe(3);
  assertStableLogo(before, after, "after route change");
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
  await drag(page, from, to);
  await waitForRealFlip(page, before, browserName);
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
      await clickAndAssertFlip(page, nextDishLink(page), /\/dishes\/hamachi-a-la-verveine/, browserName);
      expect(initialUrl).not.toBe(page.url());

      const hamachiUrl = page.url();
      await scrollDetailToOffset(page, viewport, 300, browserName);
      await clickAndAssertFlip(page, previousDishLink(page), /\/dishes\/truite-des-laurentides/, browserName);
      expect(hamachiUrl).not.toBe(page.url());
      await expect(page).toHaveURL(/lang=fr-CA/);
      await expect(page).toHaveURL(/currency=CAD/);
      await expect(page).toHaveURL(/table=main/);
      await expect(page).toHaveURL(/zone=terrasse/);
      expect(errors, `${viewport.width}px emitted console errors`).toEqual([]);
    });

    test(`keeps the SN fixed while the detail PageFlip page scrolls at ${viewport.width}px`, async ({ page, browserName }) => {
      const errors = collectPageErrors(page);
      await openDetail(page, viewport.width, viewport.height);
      const before = await detailState(page);
      expect(before.logoRect).not.toBeNull();
      expect(before.visibleLogoCount).toBe(1);
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

      expect(before.logoParentIsShell).toBe(true);
      expect(before.logoInsidePageFlip).toBe(false);
      expect(before.logoInsideScrollContainer).toBe(false);
      expect(before.logoInsideTransformedAncestor).toBe(false);
      expect(before.detailPageRect?.top).toBe(0);
      expect(before.detailPageRect?.left).toBe(0);
      expect(before.detailSurfaceRect?.top).toBe(0);

      const midGesture = await scrollDetailToOffset(page, viewport, 360, browserName);
      assertStableLogo(before, midGesture, `${browserName} ${viewport.width}px middle`);
      expect(midGesture.currentScrollTop).toBeGreaterThan(0);
      const duringMid = await detailState(page);
      assertStableLogo(before, duringMid, `${browserName} ${viewport.width}px after gesture`);

      const bottom = await scrollDetailToBottom(page, viewport, browserName);
      assertStableLogo(before, bottom, `${browserName} ${viewport.width}px bottom`);
      expect(bottom.currentScrollTop).toBeGreaterThanOrEqual(bottom.scrollHeight - bottom.clientHeight - 1);

      const top = await scrollDetailToTop(page, viewport, browserName);
      assertStableLogo(before, top, `${browserName} ${viewport.width}px top again`);
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
    const beforeVertical = await detailState(page);
    const verticalGestureResult = await scrollDetailByGesture(page, viewport, 1, browserName);
    assertStableLogo(beforeVertical, verticalGestureResult.during, "3D test during vertical gesture");
    assertStableLogo(beforeVertical, verticalGestureResult.after, "3D test after vertical gesture");
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
      const before3d = await detailState(page);
      await drag(page, { x: box!.x + box!.width * 0.7, y: box!.y + box!.height * 0.5 }, { x: box!.x + box!.width * 0.3, y: box!.y + box!.height * 0.5 });
      expect(page.url()).toBe(beforeVerticalUrl);
      assertStableLogo(before3d, await detailState(page), "3D open");
      await page.getByRole("button", { name: "MASQUER LA 3D" }).click();
      await expect(modelStage).toBeHidden();
      assertStableLogo(beforeVertical, await detailState(page), "3D closed");
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
    await waitForRealFlip(page, beforeDoubleNavigation, browserName);
    await expect(page).toHaveURL(/\/dishes\/hamachi-a-la-verveine/);
    await expect(page).not.toHaveURL(/boeuf-cru-au-couteau/);
    await expect.poll(async () => (await detailState(page)).currentScrollTop).toBe(0);
    expect(errors, "vertical/3D test emitted console errors").toEqual([]);
  });
});
