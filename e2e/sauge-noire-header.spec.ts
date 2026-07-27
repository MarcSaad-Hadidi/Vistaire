import { expect, type Page, test } from "@playwright/test";

const MENU_ROUTE = "/menu/sauge-noire?view=sauge-4&lang=fr-CA&currency=CAD";
const CONTENTS_ROUTE = "/menu/sauge-noire?view=sauge-1&lang=fr-CA&currency=CAD";
const DETAIL_ROUTE =
  "/menu/sauge-noire/dishes/canard-a-l-erable-noir?lang=fr-CA&currency=CAD&view=sauge-4";
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 }
] as const;

type Box = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  center: number;
};

type MenuSnapshot = {
  pageIndex: string | null;
  pageKind: string | null;
  pageFlipMode: string | null;
  pageScroll: number;
  pageScrollHeight: number;
  pageClientHeight: number;
  logo: Box;
  title: Box;
  header: Box;
  locale: Box;
  currency: Box;
  contents: Box;
  visibleMonograms: number;
  visibleCloneMonograms: number;
  headerPosition: string;
  logoPosition: string;
  controlsPosition: string[];
  headerSharesPage: boolean;
  controlsHavePointerEvents: boolean;
  documentHasHorizontalOverflow: boolean;
  bookHasHorizontalOverflow: boolean;
};

type DishSnapshot = {
  logo: Box;
  title: Box;
  back: Box;
  header: Box;
  paperScrollTop: number;
  paperScrollHeight: number;
  paperClientHeight: number;
  documentScrollTop: number;
  visibleMonograms: number;
  monogramsInPapers: number;
  monogramsInTransitionPreview: number;
  headerPosition: string;
  logoPosition: string;
  backPosition: string;
  headerSharesPaper: boolean;
  controlsHavePointerEvents: boolean;
  documentHasHorizontalOverflow: boolean;
};

function assertMovesTogether(before: MenuSnapshot, after: MenuSnapshot, label: string) {
  for (const [name, beforeBox, afterBox] of [
    ["logo", before.logo, after.logo],
    ["title", before.title, after.title],
    ["header", before.header, after.header],
    ["locale", before.locale, after.locale],
    ["currency", before.currency, after.currency],
    ["contents", before.contents, after.contents]
  ] as const) {
    expect(afterBox.top, `${label} ${name} did not move with scroll`).toBeLessThan(beforeBox.top - 1);
  }

  const assertRelative = (name: string, beforeFirst: Box, beforeSecond: Box, afterFirst: Box, afterSecond: Box) => {
    expect(
      Math.abs((afterFirst.top - afterSecond.top) - (beforeFirst.top - beforeSecond.top)),
      `${label} ${name} top gap changed`
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((afterFirst.left - afterSecond.left) - (beforeFirst.left - beforeSecond.left)),
      `${label} ${name} left gap changed`
    ).toBeLessThanOrEqual(1);
  };

  assertRelative("logo/title", before.logo, before.title, after.logo, after.title);
  assertRelative("logo/locale", before.logo, before.locale, after.logo, after.locale);
  assertRelative("logo/currency", before.logo, before.currency, after.logo, after.currency);
  assertRelative("logo/contents", before.logo, before.contents, after.logo, after.contents);
}

function assertDishMovesTogether(before: DishSnapshot, after: DishSnapshot, label: string) {
  for (const [name, beforeBox, afterBox] of [
    ["logo", before.logo, after.logo],
    ["title", before.title, after.title],
    ["header", before.header, after.header],
    ["back", before.back, after.back]
  ] as const) {
    expect(afterBox.top, `${label} ${name} did not move with scroll`).toBeLessThan(beforeBox.top - 1);
  }

  for (const [name, beforeFirst, beforeSecond, afterFirst, afterSecond] of [
    ["logo/title", before.logo, before.title, after.logo, after.title],
    ["logo/back", before.logo, before.back, after.logo, after.back]
  ] as const) {
    expect(
      Math.abs((afterFirst.top - afterSecond.top) - (beforeFirst.top - beforeSecond.top)),
      `${label} ${name} top gap changed`
    ).toBeLessThanOrEqual(1);
  }
}

async function waitForMenuReady(page: Page) {
  await expect(page.getByTestId("sauge-noire-book")).toBeVisible();
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 15_000 });
  // A deep-link is intentionally reached through the same animated flips as a user click.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const book = document.querySelector('[data-testid="sauge-noire-book"]');
          const index = book?.getAttribute("data-page-index");
          const activePage = index
            ? document.querySelector<HTMLElement>(
                `[data-sauge-flip-page-index="${index}"]:not([data-sauge-flip-clone])`
              )
            : null;
          if (!activePage) return false;
          const rect = activePage.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(activePage).display !== "none";
        }),
      { timeout: 15_000, intervals: [100, 250, 500] }
    )
    .toBe(true);
}

async function gotoSaugeNoireRoute(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  if (response?.status() === 404) {
    test.skip(
      true,
      "Requires a seeded Sauge Noire Supabase fixture (route returned 404)."
    );
  }
}

async function scrollActivePageToBottom(page: Page) {
  const targetScroll = await page.evaluate(() => {
    const book = document.querySelector('[data-testid="sauge-noire-book"]');
    const activePageIndex = book?.getAttribute("data-page-index");
    const activePage = activePageIndex
      ? document.querySelector<HTMLElement>(
          `[data-sauge-flip-page-index="${activePageIndex}"]:not([data-sauge-flip-clone])`
        )
      : null;
    if (!activePage) throw new Error("Expected an active Sauge Noire page");
    const target = activePage.scrollHeight - activePage.clientHeight;
    activePage.scrollTo({ top: target, behavior: "auto" });
    return target;
  });
  expect(targetScroll).toBeGreaterThan(0);
  await page.waitForTimeout(50);
}

async function scrollDishToBottom(page: Page) {
  const targetScroll = await page.evaluate(() => {
    const currentPaper = document.querySelector<HTMLElement>(
      '[data-testid="sauge-noire-dish-detail"] article:not([data-transition-preview="true"])'
    );
    if (!currentPaper) throw new Error("Expected current Sauge Noire dish paper");
    const paperTarget = currentPaper.scrollHeight - currentPaper.clientHeight;
    if (paperTarget > 0 && getComputedStyle(currentPaper).overflowY !== "visible") {
      currentPaper.scrollTo({ top: paperTarget, behavior: "auto" });
      return paperTarget;
    }
    const documentTarget = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: documentTarget, behavior: "auto" });
    return documentTarget;
  });
  expect(targetScroll).toBeGreaterThan(0);
  await page.waitForTimeout(50);
}

async function snapshotMenu(page: Page): Promise<MenuSnapshot> {
  return page.evaluate(() => {
    const box = (element: Element | null): Box => {
      if (!element) throw new Error("Expected Sauge Noire menu element");
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        center: rect.left + rect.width / 2
      };
    };
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    };
    const book = document.querySelector('[data-testid="sauge-noire-book"]');
    const pageIndex = book?.getAttribute("data-page-index");
    const activePage = pageIndex
      ? document.querySelector<HTMLElement>(
          `[data-sauge-flip-page-index="${pageIndex}"]:not([data-sauge-flip-clone])`
        )
      : null;
    const header = activePage?.querySelector("header");
    const logo = header?.querySelector('[aria-label="Sauge Noire"]');
    const title = activePage?.querySelector("h1");
    const locale = header?.querySelector('[aria-label^="Langue:"]');
    const currency = header?.querySelector('[aria-label^="Devise:"]');
    const contents = header?.querySelector('[class*="contentsBack"]');
    if (!book || !activePage || !header || !logo || !title || !locale || !currency || !contents) {
      throw new Error("Expected active Sauge Noire menu sheet");
    }
    const visibleMonograms = [...document.querySelectorAll('[aria-label="Sauge Noire"]')].filter(isVisible);
    return {
      pageIndex: book.getAttribute("data-page-index"),
      pageKind: book.getAttribute("data-page-kind"),
      pageFlipMode: book.getAttribute("data-page-flip-mode"),
      pageScroll: activePage.scrollTop,
      pageScrollHeight: activePage.scrollHeight,
      pageClientHeight: activePage.clientHeight,
      logo: box(logo),
      title: box(title),
      header: box(header),
      locale: box(locale),
      currency: box(currency),
      contents: box(contents),
      visibleMonograms: visibleMonograms.length,
      visibleCloneMonograms: visibleMonograms.filter((element) => element.closest('[data-sauge-flip-clone]')).length,
      headerPosition: getComputedStyle(header).position,
      logoPosition: getComputedStyle(logo).position,
      controlsPosition: [getComputedStyle(locale).position, getComputedStyle(currency).position, getComputedStyle(contents).position],
      headerSharesPage: header.parentElement === activePage,
      controlsHavePointerEvents: [...header.querySelectorAll("a, button")].every(
        (element) => getComputedStyle(element).pointerEvents !== "none"
      ),
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      bookHasHorizontalOverflow: book.scrollWidth > book.clientWidth
    };
  });
}

async function snapshotDish(page: Page): Promise<DishSnapshot> {
  return page.evaluate(() => {
    const box = (element: Element | null): Box => {
      if (!element) throw new Error("Expected Sauge Noire dish element");
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        center: rect.left + rect.width / 2
      };
    };
    const detail = document.querySelector('[data-testid="sauge-noire-dish-detail"]');
    const paper = detail?.querySelector<HTMLElement>('article:not([data-transition-preview="true"])');
    const header = paper?.querySelector("header");
    const logo = header?.querySelector('[aria-label="Sauge Noire"]');
    const title = paper?.querySelector("h1");
    const back = header?.querySelector("a");
    if (!detail || !paper || !header || !logo || !title || !back) {
      throw new Error("Expected Sauge Noire dish sheet");
    }
    const visibleMonograms = [...detail.querySelectorAll('[aria-label="Sauge Noire"]')].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    });
    return {
      logo: box(logo),
      title: box(title),
      back: box(back),
      header: box(header),
      paperScrollTop: paper.scrollTop,
      paperScrollHeight: paper.scrollHeight,
      paperClientHeight: paper.clientHeight,
      documentScrollTop: window.scrollY,
      visibleMonograms: visibleMonograms.length,
      monogramsInPapers: paper.querySelectorAll('[aria-label="Sauge Noire"]').length,
      monogramsInTransitionPreview: detail.querySelectorAll(
        '[data-transition-preview="true"] [aria-label="Sauge Noire"]'
      ).length,
      headerPosition: getComputedStyle(header).position,
      logoPosition: getComputedStyle(logo).position,
      backPosition: getComputedStyle(back).position,
      headerSharesPaper: header.parentElement === paper,
      controlsHavePointerEvents: [...header.querySelectorAll("a, button")].every(
        (element) => getComputedStyle(element).pointerEvents !== "none"
      ),
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
    };
  });
}

test("Sauge Noire dish links open the real detail route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoSaugeNoireRoute(page, MENU_ROUTE);
  await waitForMenuReady(page);
  const dishLinks = page.locator('a[href*="/menu/sauge-noire/dishes/"]:visible');
  await expect(dishLinks.first()).toBeVisible();
  await dishLinks.first().click();
  await page.waitForURL(/\/menu\/sauge-noire\/dishes\//, { timeout: 5_000 });
  await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
});

test("Sauge Noire contents controls animate to the selected sheet", async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoSaugeNoireRoute(page, MENU_ROUTE);
  await waitForMenuReady(page);

  await page.getByRole("button", { name: /Table des matières/i }).click();
  await page.waitForURL(/view=sauge-1/);
  await expect(page.locator('[data-page-kind="contents"]')).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: /À côté & desserts 05/i }).click();
  await page.waitForURL(/view=sauge-6/);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll(".stf__item")].some((element) => {
            const style = getComputedStyle(element);
            return style.transform !== "none" || style.opacity !== "1";
          })
        ),
      { timeout: 3_000 }
    )
    .toBe(true);
  await expect(page.getByRole("heading", { name: "À CÔTÉ & DESSERTS" })).toBeVisible({ timeout: 10_000 });
});

test("Sauge Noire top chrome belongs to the scrolling menu sheet", async ({ page }) => {
  test.setTimeout(90_000);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await gotoSaugeNoireRoute(page, CONTENTS_ROUTE);
    await waitForMenuReady(page);
    await expect(page.getByTestId("sauge-noire-book")).toHaveAttribute("data-page-kind", "contents");
    await expect(page.getByRole("heading", { name: "Table des matières" })).toBeVisible();

    await gotoSaugeNoireRoute(page, MENU_ROUTE);
    await waitForMenuReady(page);
    const top = await snapshotMenu(page);
    expect(top.pageKind).toBe("section");
    expect(top.pageFlipMode).toBe("animated");
    expect(top.pageScrollHeight).toBeGreaterThan(top.pageClientHeight);
    expect(top.headerPosition).not.toMatch(/fixed|sticky/);
    expect(top.logoPosition).not.toMatch(/fixed|sticky/);
    expect(top.controlsPosition.every((position) => !/fixed|sticky/.test(position))).toBe(true);
    expect(top.headerSharesPage).toBe(true);
    expect(top.controlsHavePointerEvents).toBe(true);
    expect(top.visibleMonograms).toBe(1);
    expect(top.visibleCloneMonograms).toBe(0);
    expect(top.documentHasHorizontalOverflow).toBe(false);
    expect(top.bookHasHorizontalOverflow).toBe(false);

    await page.getByRole("button", { name: /Langue/i }).click();
    await expect(page.getByRole("menu", { name: "Langue" })).toBeVisible();
    await page.keyboard.press("Escape");

    await scrollActivePageToBottom(page);
    const bottom = await snapshotMenu(page);
    expect(bottom.pageScroll).toBeGreaterThan(0);
    expect(bottom.pageIndex).toBe(top.pageIndex);
    expect(bottom.visibleMonograms).toBeLessThanOrEqual(1);
    expect(bottom.visibleCloneMonograms).toBe(0);
    assertMovesTogether(top, bottom, `menu ${viewport.width}px`);
  }
});

test("Sauge Noire dish chrome belongs to the scrolling dish sheet", async ({ page }) => {
  test.setTimeout(90_000);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await gotoSaugeNoireRoute(page, DETAIL_ROUTE);
    await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
    const top = await snapshotDish(page);
    expect(top.headerPosition).not.toMatch(/fixed|sticky/);
    expect(top.logoPosition).not.toMatch(/fixed|sticky/);
    expect(top.backPosition).not.toMatch(/fixed|sticky/);
    expect(top.headerSharesPaper).toBe(true);
    expect(top.controlsHavePointerEvents).toBe(true);
    expect(top.visibleMonograms).toBeLessThanOrEqual(1);
    expect(top.monogramsInPapers).toBe(1);
    expect(top.monogramsInTransitionPreview).toBe(0);
    expect(top.documentHasHorizontalOverflow).toBe(false);

    await scrollDishToBottom(page);
    const bottom = await snapshotDish(page);
    expect(bottom.visibleMonograms).toBeLessThanOrEqual(1);
    expect(bottom.monogramsInPapers).toBe(1);
    expect(bottom.monogramsInTransitionPreview).toBe(0);
    assertDishMovesTogether(top, bottom, `dish ${viewport.width}px`);
  }
});
