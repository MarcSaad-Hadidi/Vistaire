import { expect, test, type Locator, type Page } from "@playwright/test";

const detailPath =
  "/menu/sauge-noire/dishes/truite-des-laurentides?lang=fr-CA&currency=CAD&view=sauge-3&table=main&zone=terrasse";

type DetailState = {
  route: string;
  currentScrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  stfTransforms: string[];
  visibleLogoCount: number;
  fallbackVisible: boolean;
  physicalPageCount: number;
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
    const fallbackVisible = Array.from(
      document.querySelectorAll<HTMLElement>('[data-page-flip-fallback]')
    ).some(isVisible);

    return {
      route: window.location.href,
      currentScrollTop: currentPage?.scrollTop ?? -1,
      scrollHeight: currentPage?.scrollHeight ?? 0,
      clientHeight: currentPage?.clientHeight ?? 0,
      stfTransforms,
      visibleLogoCount,
      fallbackVisible,
      physicalPageCount: physicalPages.length
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

  test("keeps vertical scrolling, pointercancel, 3D and duplicate clicks isolated", async ({ page }) => {
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
    await page.mouse.move(195, 420);
    await page.mouse.wheel(0, 520);
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
