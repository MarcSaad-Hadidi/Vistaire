import { expect, type Page, test } from "@playwright/test";

const MENU_ROUTE =
  "/menu/sauge-noire?view=sauge-4&lang=fr-CA&currency=CAD";
const CONTENTS_ROUTE =
  "/menu/sauge-noire?view=sauge-1&lang=fr-CA&currency=CAD";
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

type HeaderSnapshot = {
  pageIndex: string | null;
  pageKind: string | null;
  pageFlipMode: string | null;
  pageScroll: number;
  pageScrollHeight: number;
  pageClientHeight: number;
  logo: Box;
  header: Box;
  locale: Box;
  currency: Box;
  contents: Box;
  rail: Box;
  visibleMonograms: number;
  monogramsInFlipPages: number;
  monogramsInFlipClones: number;
  headerPosition: string;
  headerBackgroundColor: string;
  headerBackgroundImage: string;
  controlsHavePointerEvents: boolean;
  visibleContentAboveHeader: boolean;
  documentHasHorizontalOverflow: boolean;
  bookHasHorizontalOverflow: boolean;
};

function assertStablePosition(before: Box, after: Box, label: string) {
  expect(Math.abs(after.top - before.top), `${label} top moved`).toBeLessThanOrEqual(1);
  expect(Math.abs(after.left - before.left), `${label} left moved`).toBeLessThanOrEqual(1);
  expect(Math.abs(after.center - before.center), `${label} center moved`).toBeLessThanOrEqual(1);
}

function assertMatchingPosition(menuLogo: Box, detailLogo: Box, label: string) {
  expect(Math.abs(detailLogo.top - menuLogo.top), `${label} top differs`).toBeLessThanOrEqual(1);
  expect(Math.abs(detailLogo.left - menuLogo.left), `${label} left differs`).toBeLessThanOrEqual(1);
  expect(Math.abs(detailLogo.center - menuLogo.center), `${label} center differs`).toBeLessThanOrEqual(1);
}

async function snapshotHeader(page: Page): Promise<HeaderSnapshot> {
  return page.evaluate(() => {
    const box = (element: Element | null): Box => {
      if (!element) throw new Error("Expected Sauge Noire header element");
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

    const book = document.querySelector('[data-testid="sauge-noire-book"]');
    const header = document.querySelector("header");
    const activePageIndex = book?.getAttribute("data-page-index");
    const activePage = activePageIndex
      ? document.querySelector<HTMLElement>(
          `[data-sauge-flip-page-index="${activePageIndex}"]:not([data-sauge-flip-clone])`
        )
      : null;
    if (!book || !activePage) throw new Error("Expected active Sauge Noire page");

    const headerStyle = header ? getComputedStyle(header) : null;
    const headerRect = header?.getBoundingClientRect();
    const headerZIndex = Number.parseInt(headerStyle?.zIndex ?? "0", 10) || 0;
    const visibleContentAboveHeader = Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2, h3, p, a, button, img, svg")
    ).some((element) => {
      if (!header || header.contains(element)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const elementZIndex = Number.parseInt(style.zIndex, 10);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        headerRect &&
        rect.left < headerRect.right &&
        rect.right > headerRect.left &&
        rect.top < headerRect.bottom &&
        rect.bottom > headerRect.top &&
        Number.isFinite(elementZIndex) &&
        elementZIndex > headerZIndex
      );
    });

    const visibleMonograms = Array.from(
      document.querySelectorAll<HTMLElement>('div[aria-label="Sauge Noire"]')
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
    });

    return {
      pageIndex: book.getAttribute("data-page-index"),
      pageKind: book.getAttribute("data-page-kind"),
      pageFlipMode: book.getAttribute("data-page-flip-mode"),
      pageScroll: activePage.scrollTop,
      pageScrollHeight: activePage.scrollHeight,
      pageClientHeight: activePage.clientHeight,
      logo: box(document.querySelector('header div[aria-label="Sauge Noire"]')),
      header: box(header),
      locale: box(document.querySelector('[aria-label^="Langue:"]')),
      currency: box(document.querySelector('[aria-label^="Devise:"]')),
      contents: box(document.querySelector('[aria-label*="Table des matières"]')),
      rail: box(document.querySelector('[class*="rail"]')),
      visibleMonograms: visibleMonograms.length,
      monogramsInFlipPages: document.querySelectorAll(
        '[data-sauge-flip-page-index] div[aria-label="Sauge Noire"]'
      ).length,
      monogramsInFlipClones: document.querySelectorAll(
        '[data-sauge-flip-clone] div[aria-label="Sauge Noire"]'
      ).length,
      headerPosition: headerStyle?.position ?? "",
      headerBackgroundColor: headerStyle?.backgroundColor ?? "",
      headerBackgroundImage: headerStyle?.backgroundImage ?? "",
      controlsHavePointerEvents: header
        ? Array.from(header.querySelectorAll("a, button")).every(
            (element) => getComputedStyle(element).pointerEvents !== "none"
          )
        : false,
      visibleContentAboveHeader,
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      bookHasHorizontalOverflow: book.scrollWidth > book.clientWidth
    };
  });
}

async function snapshotDishHeader(page: Page) {
  return page.evaluate(() => {
    const detail = document.querySelector('[data-testid="sauge-noire-dish-detail"]');
    const header = detail?.querySelector("header");
    const logo = header?.querySelector('[aria-label="Sauge Noire"]');
    const currentPaper = detail?.querySelector<HTMLElement>(
      'article:not([data-transition-preview="true"])'
    );
    if (!detail || !header || !logo || !currentPaper) {
      throw new Error("Expected Sauge Noire dish chrome and current paper");
    }

    const headerStyle = getComputedStyle(header);
    const headerRect = header.getBoundingClientRect();
    const headerZIndex = Number.parseInt(headerStyle.zIndex, 10) || 0;
    const visibleContentAboveHeader = Array.from(
      detail.querySelectorAll<HTMLElement>("h1, h2, h3, p, a, button, img, svg")
    ).some((element) => {
      if (header.contains(element)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const elementZIndex = Number.parseInt(style.zIndex, 10);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.left < headerRect.right &&
        rect.right > headerRect.left &&
        rect.top < headerRect.bottom &&
        rect.bottom > headerRect.top &&
        Number.isFinite(elementZIndex) &&
        elementZIndex > headerZIndex
      );
    });

    const box = (element: Element): Box => {
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
    const visibleMonograms = Array.from(
      detail.querySelectorAll<HTMLElement>('[aria-label="Sauge Noire"]')
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
    });

    return {
      logo: box(logo),
      header: box(header),
      paper: box(currentPaper),
      paperScrollTop: currentPaper.scrollTop,
      paperScrollHeight: currentPaper.scrollHeight,
      paperClientHeight: currentPaper.clientHeight,
      documentScrollTop: window.scrollY,
      documentScrollHeight: document.documentElement.scrollHeight,
      visibleMonograms: visibleMonograms.length,
      monogramsInPapers: detail.querySelectorAll('article.paper [aria-label="Sauge Noire"]').length,
      monogramsInTransitionPreview: detail.querySelectorAll(
        '[data-transition-preview="true"] [aria-label="Sauge Noire"]'
      ).length,
      headerPosition: headerStyle.position,
      headerBackgroundColor: headerStyle.backgroundColor,
      headerBackgroundImage: headerStyle.backgroundImage,
      controlsHavePointerEvents: Array.from(header.querySelectorAll("a, button")).every(
        (element) => getComputedStyle(element).pointerEvents !== "none"
      ),
      visibleContentAboveHeader,
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
    };
  });
}

async function waitForMenuReady(page: Page) {
  await expect(page.getByTestId("sauge-noire-book")).toBeVisible();
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({
    timeout: 15_000
  });
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
    if (!activePage) throw new Error("Expected an active scrollable page");
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

test("Sauge Noire dish links open the real detail route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(MENU_ROUTE, { waitUntil: "domcontentloaded" });
  await waitForMenuReady(page);

  const activePageSelector = await page.evaluate(() => {
    const book = document.querySelector('[data-testid="sauge-noire-book"]');
    const pageIndex = book?.getAttribute("data-page-index");
    if (!pageIndex) throw new Error("Expected active Sauge Noire page index");
    return `[data-sauge-flip-page-index="${pageIndex}"]:not([data-sauge-flip-clone])`;
  });
  const activePage = page.locator(activePageSelector);
  const dishLinks = activePage.locator('a[href*="/menu/sauge-noire/dishes/"]');
  const dishLinkCount = await dishLinks.count();
  expect(dishLinkCount).toBeGreaterThan(0);

  await dishLinks.first().click();
  await page.waitForURL(/\/menu\/sauge-noire\/dishes\//, { timeout: 5_000 });
  await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
});

test("Sauge Noire monogram uses one opaque fixed mask across menu and detail", async ({
  page
}) => {
  test.setTimeout(60_000);

  for (const viewport of VIEWPORTS.slice(0, 2)) {
    await page.setViewportSize(viewport);
    await page.goto(MENU_ROUTE, { waitUntil: "domcontentloaded" });
    await waitForMenuReady(page);

    const menuTop = await snapshotHeader(page);
    expect(menuTop.headerPosition).toBe("fixed");
    expect(menuTop.headerBackgroundColor).not.toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
    expect(menuTop.headerBackgroundImage).toContain("radial-gradient");
    expect(menuTop.controlsHavePointerEvents).toBe(true);
    expect(menuTop.visibleMonograms).toBe(1);
    expect(menuTop.monogramsInFlipPages).toBe(0);
    expect(menuTop.monogramsInFlipClones).toBe(0);
    expect(menuTop.visibleContentAboveHeader).toBe(false);

    await scrollActivePageToBottom(page);
    const menuBottom = await snapshotHeader(page);
    assertStablePosition(menuTop.logo, menuBottom.logo, `menu logo at ${viewport.width}px`);
    expect(menuBottom.visibleMonograms).toBe(1);
    expect(menuBottom.visibleContentAboveHeader).toBe(false);

    await page.goto(DETAIL_ROUTE, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();

    const detailTop = await snapshotDishHeader(page);
    expect(detailTop.headerPosition).toBe("fixed");
    expect(detailTop.headerBackgroundColor).not.toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
    expect(detailTop.headerBackgroundImage).toContain("radial-gradient");
    expect(detailTop.controlsHavePointerEvents).toBe(true);
    expect(detailTop.visibleMonograms).toBe(1);
    expect(detailTop.monogramsInPapers).toBe(0);
    expect(detailTop.monogramsInTransitionPreview).toBe(0);
    expect(detailTop.visibleContentAboveHeader).toBe(false);
    assertMatchingPosition(menuTop.logo, detailTop.logo, `menu/detail logo at ${viewport.width}px`);

    await scrollDishToBottom(page);
    const detailBottom = await snapshotDishHeader(page);
    assertStablePosition(detailTop.logo, detailBottom.logo, `detail logo at ${viewport.width}px`);
    expect(detailBottom.visibleMonograms).toBe(1);
    expect(detailBottom.visibleContentAboveHeader).toBe(false);
  }
});

test("Sauge Noire header and monogram stay fixed while a long page scrolls", async ({
  page
}) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || /hydration/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("favicon")) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);

    await page.goto(CONTENTS_ROUTE, { waitUntil: "domcontentloaded" });
    await waitForMenuReady(page);
    const contentsTop = await snapshotHeader(page);
    expect(contentsTop.pageKind).toBe("contents");
    expect(contentsTop.pageFlipMode).toBe("animated");
    expect(contentsTop.documentHasHorizontalOverflow).toBe(false);
    expect(contentsTop.bookHasHorizontalOverflow).toBe(false);

    await page.goto(MENU_ROUTE, { waitUntil: "domcontentloaded" });
    await waitForMenuReady(page);
    const top = await snapshotHeader(page);
    expect(top.pageKind).toBe("section");
    expect(top.pageFlipMode).toBe("animated");
    expect(top.pageScrollHeight).toBeGreaterThan(top.pageClientHeight);
    expect(top.visibleMonograms).toBe(1);
    expect(top.monogramsInFlipPages).toBe(0);
    expect(top.monogramsInFlipClones).toBe(0);
    expect(top.documentHasHorizontalOverflow).toBe(false);
    expect(top.bookHasHorizontalOverflow).toBe(false);

    await page.mouse.move(viewport.width * 0.7, viewport.height * 0.7);
    await page.mouse.wheel(0, 640);
    await page.waitForTimeout(50);
    await scrollActivePageToBottom(page);
    const bottom = await snapshotHeader(page);
    expect(bottom.pageScroll).toBeGreaterThan(0);
    expect(bottom.pageIndex).toBe(top.pageIndex);
    expect(bottom.pageKind).toBe(top.pageKind);
    assertStablePosition(top.logo, bottom.logo, `logo at ${viewport.width}px`);
    assertStablePosition(top.header, bottom.header, `header at ${viewport.width}px`);
    assertStablePosition(top.locale, bottom.locale, `locale at ${viewport.width}px`);
    assertStablePosition(top.currency, bottom.currency, `currency at ${viewport.width}px`);
    assertStablePosition(top.contents, bottom.contents, `contents at ${viewport.width}px`);
    assertStablePosition(top.rail, bottom.rail, `rail at ${viewport.width}px`);
    expect(bottom.visibleMonograms).toBe(1);
    expect(bottom.monogramsInFlipPages).toBe(0);
    expect(bottom.monogramsInFlipClones).toBe(0);
    expect(bottom.documentHasHorizontalOverflow).toBe(false);
    expect(bottom.bookHasHorizontalOverflow).toBe(false);

    await page.evaluate(() => {
      const activePage = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sauge-flip-page-index]")
      ).find((element) => element.getBoundingClientRect().height > 0);
      activePage?.scrollTo({ top: 0, behavior: "auto" });
    });
    await page.waitForTimeout(50);
    const returned = await snapshotHeader(page);
    expect(returned.pageScroll).toBe(0);
    assertStablePosition(top.logo, returned.logo, `logo return at ${viewport.width}px`);
    assertStablePosition(top.locale, returned.locale, `locale return at ${viewport.width}px`);
    assertStablePosition(top.currency, returned.currency, `currency return at ${viewport.width}px`);

    const nextButton = page.getByRole("button", { name: /Page suivante/i });
    if (await nextButton.count()) {
      await nextButton.click();
      await page.waitForTimeout(100);
      const duringFlip = await snapshotHeader(page);
      assertStablePosition(top.logo, duringFlip.logo, `logo during flip at ${viewport.width}px`);
      expect(duringFlip.visibleMonograms).toBe(1);
      expect(duringFlip.monogramsInFlipPages).toBe(0);
      expect(duringFlip.monogramsInFlipClones).toBe(0);
    }
  }

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto(DETAIL_ROUTE, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
    const top = await snapshotDishHeader(page);
    expect(top.visibleMonograms).toBe(1);
    expect(top.monogramsInPapers).toBe(0);
    expect(top.monogramsInTransitionPreview).toBe(0);
    expect(top.documentHasHorizontalOverflow).toBe(false);

    await page.mouse.move(viewport.width * 0.7, viewport.height * 0.7);
    await page.mouse.wheel(0, 640);
    await page.waitForTimeout(50);
    await scrollDishToBottom(page);
    const bottom = await snapshotDishHeader(page);
    expect(bottom.visibleMonograms).toBe(1);
    expect(bottom.monogramsInPapers).toBe(0);
    expect(bottom.monogramsInTransitionPreview).toBe(0);
    assertStablePosition(top.logo, bottom.logo, `dish logo at ${viewport.width}px`);
    assertStablePosition(top.header, bottom.header, `dish header at ${viewport.width}px`);
    expect(bottom.documentHasHorizontalOverflow).toBe(false);

    const modelButton = page.getByRole("button", { name: /3D/i }).first();
    if (await modelButton.count()) {
      await modelButton.click();
      await page.waitForTimeout(100);
      const withModel = await snapshotDishHeader(page);
      assertStablePosition(top.logo, withModel.logo, `dish logo with 3D at ${viewport.width}px`);
      expect(withModel.visibleMonograms).toBe(1);
      expect(withModel.monogramsInPapers).toBe(0);
      expect(withModel.monogramsInTransitionPreview).toBe(0);
    }

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
    await page.waitForTimeout(50);
    const navLinks = page.locator('[data-testid="sauge-noire-dish-detail"] a[aria-label]');
    const nextIndex = await navLinks.evaluateAll((elements) =>
      elements.findIndex((element) => /prochain|next/i.test(element.getAttribute("aria-label") ?? ""))
    );
    expect(nextIndex).toBeGreaterThanOrEqual(0);
    await navLinks.nth(nextIndex).click({ force: true });
    await page.waitForTimeout(100);
    const duringDishTurn = await snapshotDishHeader(page);
    assertStablePosition(top.logo, duringDishTurn.logo, `dish logo during turn at ${viewport.width}px`);
    expect(duringDishTurn.visibleMonograms).toBe(1);
    expect(duringDishTurn.monogramsInPapers).toBe(0);
    expect(duringDishTurn.monogramsInTransitionPreview).toBe(0);
    await page.waitForURL(/\/menu\/sauge-noire\/dishes\//, { timeout: 5_000 });
    await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
    const nextDish = await snapshotDishHeader(page);
    expect(nextDish.visibleMonograms).toBe(1);
    assertStablePosition(top.logo, nextDish.logo, `dish logo after next at ${viewport.width}px`);

    const nextNavLinks = page.locator('[data-testid="sauge-noire-dish-detail"] a[aria-label]');
    const previousIndex = await nextNavLinks.evaluateAll((elements) =>
      elements.findIndex((element) => !/prochain|next/i.test(element.getAttribute("aria-label") ?? ""))
    );
    expect(previousIndex).toBeGreaterThanOrEqual(0);
    await nextNavLinks.nth(previousIndex).click({ force: true });
    await page.waitForTimeout(100);
    const duringPreviousTurn = await snapshotDishHeader(page);
    expect(duringPreviousTurn.visibleMonograms).toBe(1);
    expect(duringPreviousTurn.monogramsInPapers).toBe(0);
    expect(duringPreviousTurn.monogramsInTransitionPreview).toBe(0);
  }

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  expect(failedResponses, failedResponses.join("\n")).toEqual([]);
});
