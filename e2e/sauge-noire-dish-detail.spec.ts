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

async function scrollCurrentDetail(page: Page, top: number) {
  return page.evaluate((nextTop) => {
    const page = Array.from(
      document.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]')
    ).find(
      (element) =>
        !element.closest('[aria-hidden="true"]') &&
        element.querySelector('article:not([data-transition-preview="true"])')
    );
    page?.scrollTo({ top: nextTop, left: 0, behavior: "auto" });
    return page?.scrollTop ?? -1;
  }, top);
}

async function waitForRealFlip(page: Page, before: DetailState) {
  let transitionSample: DetailState | undefined;
  await expect
    .poll(
      async () => {
        const state = await detailState(page);
        const transformChanged = state.stfTransforms.some(
          (transform, index) => transform !== before.stfTransforms[index]
        );
        const validSample =
          state.route === before.route &&
          state.currentScrollTop === before.currentScrollTop &&
          state.visibleLogoCount === 1 &&
          !state.fallbackVisible &&
          transformChanged;
        if (validSample) transitionSample = state;
        return validSample;
      },
      { timeout: 2000, intervals: [10, 20, 40, 80] }
    )
    .toBe(true);

  expect(transitionSample).toBeDefined();
  expect(transitionSample?.route).toBe(before.route);
  expect(transitionSample?.currentScrollTop).toBe(before.currentScrollTop);
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

  await link.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
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
}

async function swipeAndAssertFlip(
  page: Page,
  expectedPath: RegExp,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  const before = await detailState(page);
  expect(before.currentScrollTop).toBeGreaterThan(0);
  await drag(page, from, to);
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
    test(`keeps scroll and route stable until a real next/previous flip at ${viewport.width}px`, async ({ page }) => {
      await openDetail(page, viewport.width, viewport.height);
      await expect(page.locator('[class*="detailPageTurn"]')).toHaveCount(0);
      await expect(page.locator('[aria-label="Sauge Noire"]:visible')).toHaveCount(1);

      expect(await scrollCurrentDetail(page, 360)).toBe(360);
      const initialUrl = page.url();
      await clickAndAssertFlip(page, nextDishLink(page), /\/dishes\/hamachi-a-la-verveine/);
      expect(initialUrl).not.toBe(page.url());

      const hamachiUrl = page.url();
      expect(await scrollCurrentDetail(page, 300)).toBe(300);
      await clickAndAssertFlip(page, previousDishLink(page), /\/dishes\/truite-des-laurentides/);
      expect(hamachiUrl).not.toBe(page.url());
      await expect(page).toHaveURL(/lang=fr-CA/);
      await expect(page).toHaveURL(/currency=CAD/);
      await expect(page).toHaveURL(/table=main/);
      await expect(page).toHaveURL(/zone=terrasse/);
    });

    test(`keeps the SN fixed while the detail PageFlip page scrolls at ${viewport.width}px`, async ({ page, browserName }) => {
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

      const beforeLogo = before.logoRect!;
      const beforeRoute = before.route;
      if (browserName === "webkit") {
        // Mobile WebKit does not expose page.mouse.wheel; scroll the same PageFlip
        // node directly after the Chromium real-wheel assertion covers input behavior.
        await scrollCurrentDetail(page, 520);
      } else {
        await page.mouse.move(viewport.width / 2, 420);
        await page.mouse.wheel(0, 520);
      }
      await expect.poll(async () => (await detailState(page)).currentScrollTop).toBeGreaterThan(0);

      const after = await detailState(page);
      expect(after.route).toBe(beforeRoute);
      expect(after.currentScrollTop).toBeGreaterThan(before.currentScrollTop);
      expect(after.windowScrollY).toBe(0);
      expect(after.detailPageScrollTop).toBe(0);
      expect(after.detailSurfaceScrollTop).toBe(0);
      expect(after.visibleLogoCount).toBe(1);
      expect(Math.abs(after.logoRect!.top - beforeLogo.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.logoRect!.left - beforeLogo.left)).toBeLessThanOrEqual(1);
    });

    test(`uses the same animated path for left and right swipes at ${viewport.width}px`, async ({ page }) => {
      await openDetail(page, viewport.width, viewport.height);
      await expect(page.locator('[aria-label="Sauge Noire"]:visible')).toHaveCount(1);

      expect(await scrollCurrentDetail(page, 360)).toBe(360);
      await swipeAndAssertFlip(
        page,
        /\/dishes\/hamachi-a-la-verveine/,
        { x: viewport.width - 70, y: 430 },
        { x: 70, y: 430 }
      );

      expect(await scrollCurrentDetail(page, 300)).toBe(300);
      await swipeAndAssertFlip(
        page,
        /\/dishes\/truite-des-laurentides/,
        { x: 70, y: 430 },
        { x: viewport.width - 70, y: 430 }
      );
    });
  }

  test("keeps vertical scrolling, pointercancel, 3D and duplicate clicks isolated", async ({ page, browserName }) => {
    await openDetail(page, 390, 844);

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
    if (browserName === "webkit") {
      await scrollCurrentDetail(page, 520);
    } else {
      await page.mouse.move(195, 420);
      await page.mouse.wheel(0, 520);
    }
    await expect.poll(async () => (await detailState(page)).currentScrollTop).toBeGreaterThan(beforeVertical.currentScrollTop);
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
    }

    await page.goto(detailPath, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible();
    expect(await scrollCurrentDetail(page, 360)).toBe(360);
    const next = nextDishLink(page);
    await expect(next).toHaveCount(1);
    const beforeDoubleNavigation = await detailState(page);
    await next.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    await waitForRealFlip(page, beforeDoubleNavigation);
    await expect(page).toHaveURL(/\/dishes\/hamachi-a-la-verveine/);
    await expect(page).not.toHaveURL(/boeuf-cru-au-couteau/);
    await expect.poll(async () => (await detailState(page)).currentScrollTop).toBe(0);
  });
});
