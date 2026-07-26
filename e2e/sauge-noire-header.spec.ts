import { expect, type Page, test } from "@playwright/test";

const MENU_ROUTE =
  "/menu/sauge-noire?view=sauge-4&lang=fr-CA&currency=CAD";
const CONTENTS_ROUTE =
  "/menu/sauge-noire?view=sauge-1&lang=fr-CA&currency=CAD";
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
  documentHasHorizontalOverflow: boolean;
  bookHasHorizontalOverflow: boolean;
};

function assertStablePosition(before: Box, after: Box, label: string) {
  expect(Math.abs(after.top - before.top), `${label} top moved`).toBeLessThan(0.5);
  expect(Math.abs(after.left - before.left), `${label} left moved`).toBeLessThan(0.5);
  expect(Math.abs(after.center - before.center), `${label} center moved`).toBeLessThan(0.5);
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
    const activePage = Array.from(
      document.querySelectorAll<HTMLElement>("[data-sauge-flip-page-index]")
    ).find((element) => element.getBoundingClientRect().height > 0);
    if (!book || !activePage) throw new Error("Expected active Sauge Noire page");

    return {
      pageIndex: book.getAttribute("data-page-index"),
      pageKind: book.getAttribute("data-page-kind"),
      pageFlipMode: book.getAttribute("data-page-flip-mode"),
      pageScroll: activePage.scrollTop,
      pageScrollHeight: activePage.scrollHeight,
      pageClientHeight: activePage.clientHeight,
      logo: box(document.querySelector('[aria-label="Sauge Noire"]')),
      header: box(header),
      locale: box(document.querySelector('[aria-label^="Langue:"]')),
      currency: box(document.querySelector('[aria-label^="Devise:"]')),
      contents: box(document.querySelector('[aria-label*="Table des matières"]')),
      rail: box(document.querySelector('[class*="rail"]')),
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      bookHasHorizontalOverflow: book.scrollWidth > book.clientWidth
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
    const activePage = Array.from(
      document.querySelectorAll<HTMLElement>("[data-sauge-flip-page-index]")
    ).find((element) => element.getBoundingClientRect().height > 0);
    if (!activePage) throw new Error("Expected an active scrollable page");
    const target = activePage.scrollHeight - activePage.clientHeight;
    activePage.scrollTo({ top: target, behavior: "auto" });
    return target;
  });
  expect(targetScroll).toBeGreaterThan(0);
  await page.waitForTimeout(50);
}

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
    expect(top.documentHasHorizontalOverflow).toBe(false);
    expect(top.bookHasHorizontalOverflow).toBe(false);

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
  }

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  expect(failedResponses, failedResponses.join("\n")).toEqual([]);
});
