import { expect, type Page, test } from "@playwright/test";

const MENU_ROUTE = "/menu/sauge-noire?view=sauge-4&lang=fr-CA&currency=CAD";
const CONTENTS_ROUTE = "/menu/sauge-noire?view=sauge-1&lang=fr-CA&currency=CAD";
const DETAIL_ROUTE =
  "/menu/sauge-noire/dishes/canard-a-l-erable-noir?lang=fr-CA&currency=CAD&view=sauge-4";
const FIRST_GESTES_ROUTE = "/menu/sauge-noire?view=sauge-2&lang=fr-CA&currency=CAD";
const SHORT_SECTION_ROUTE = "/menu/sauge-noire?view=sauge-5&lang=fr-CA&currency=CAD";
const COCKTAILS_ROUTE = "/menu/sauge-noire?view=sauge-7&lang=fr-CA&currency=CAD";
const ENDING_ROUTE = "/menu/sauge-noire?view=sauge-9&lang=fr-CA&currency=CAD";
const BETTERAVE_DETAIL_ROUTE =
  "/menu/sauge-noire/dishes/betterave-sous-la-cendre?lang=fr-CA&currency=CAD&view=sauge-2";
const SAUGE_75_DETAIL_ROUTE =
  "/menu/sauge-noire/dishes/sauge-75?lang=fr-CA&currency=CAD&view=sauge-7";
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 }
] as const;
const IMAGE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
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
  pageScrollTop: number;
  pageScrollHeight: number;
  pageClientHeight: number;
  documentScrollTop: number;
  visibleMonograms: number;
  externalFloatingLogoCount: number;
  activePageLogoCount: number;
  activeHeaderLogoCount: number;
  originalPageLogoCounts: number[];
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
    ["title/back", before.title, before.back, after.title, after.back]
  ] as const) {
    expect(
      Math.abs((afterFirst.top - afterSecond.top) - (beforeFirst.top - beforeSecond.top)),
      `${label} ${name} top gap changed`
    ).toBeLessThanOrEqual(1);
  }

  for (const [name, beforeGap, afterGap] of [
    ["logo/title", before.logo.top - before.title.top, after.logo.top - after.title.top],
    ["logo/back", before.logo.top - before.back.top, after.logo.top - after.back.top],
    ["logo/title-center", before.logo.left - before.title.center, after.logo.left - after.title.center]
  ] as const) {
    expect(Math.abs(afterGap - beforeGap), `${label} ${name} relative gap changed`).toBeLessThanOrEqual(1);
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
  const notFoundContent = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
  if (response?.status() === 404 || notFoundContent.includes("This page could not be found")) {
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
    const scrollContainer =
      paperTarget > 0 && getComputedStyle(currentPaper).overflowY !== "visible"
        ? currentPaper
        : currentPaper.closest<HTMLElement>('[data-sauge-flip-page-index]') ?? currentPaper;
    const scrollTarget = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    if (scrollTarget > 0 && getComputedStyle(scrollContainer).overflowY !== "visible") {
      scrollContainer.scrollTo({ top: scrollTarget, behavior: "auto" });
      return scrollTarget;
    }
    const documentTarget = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: documentTarget, behavior: "auto" });
    return documentTarget;
  });
  if (targetScroll > 0) await page.waitForTimeout(50);
  return targetScroll;
}

type ImageContainmentSnapshot = {
  imageCount: number;
  allContain: boolean;
  allCentered: boolean;
  allIntrinsicallySized: boolean;
  allSlotsContainImages: boolean;
  documentHasHorizontalOverflow: boolean;
};

async function waitForSaugeImages(page: Page, scrollIntoView = true) {
  const visibleImages = page.locator('[data-photo-slot] img:visible');
  await expect.poll(() => visibleImages.count(), { timeout: 15_000, intervals: [100, 250, 500] }).toBeGreaterThan(0);
  const imageCount = await visibleImages.count();
  if (scrollIntoView) {
    await visibleImages.evaluateAll((images) => {
      images.forEach((image) => image.scrollIntoView({ block: "center", behavior: "auto" }));
    });
  }
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            [...document.querySelectorAll<HTMLImageElement>('[data-photo-slot] img')].filter((image) => {
              const style = getComputedStyle(image);
              const rect = image.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0 &&
                image.naturalWidth > 0 &&
                image.naturalHeight > 0
              );
            }).length,
        ),
      { timeout: 15_000, intervals: [100, 250, 500] },
    )
    .toBe(imageCount);
}

async function snapshotImageContainment(page: Page): Promise<ImageContainmentSnapshot> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const images = [...document.querySelectorAll<HTMLImageElement>('[data-photo-slot] img')].filter(visible);
    const frames = images.map((image) => {
      const frame = image.parentElement;
      const imageRect = image.getBoundingClientRect();
      const frameRect = frame?.getBoundingClientRect();
      const style = getComputedStyle(image);
      if (!frame || !frameRect || !image.naturalWidth || !image.naturalHeight) {
        return { contain: false, centered: false, intrinsicallySized: false, fitsFrame: false };
      }

      const scale = Math.min(frameRect.width / image.naturalWidth, frameRect.height / image.naturalHeight);
      const contentWidth = image.naturalWidth * scale;
      const contentHeight = image.naturalHeight * scale;
      const contentLeft = frameRect.left + (frameRect.width - contentWidth) / 2;
      const contentTop = frameRect.top + (frameRect.height - contentHeight) / 2;
      const tolerance = 1;

      return {
        contain: style.objectFit === "contain" && style.objectPosition === "50% 50%",
        centered:
          Math.abs(contentLeft - (frameRect.left + (frameRect.width - contentWidth) / 2)) <= tolerance &&
          Math.abs(contentTop - (frameRect.top + (frameRect.height - contentHeight) / 2)) <= tolerance,
        intrinsicallySized: contentWidth <= frameRect.width + tolerance && contentHeight <= frameRect.height + tolerance,
        fitsFrame: imageRect.width <= frameRect.width + tolerance && imageRect.height <= frameRect.height + tolerance
      };
    });

    return {
      imageCount: images.length,
      allContain: frames.length > 0 && frames.every((frame) => frame.contain),
      allCentered: frames.length > 0 && frames.every((frame) => frame.centered),
      allIntrinsicallySized: frames.length > 0 && frames.every((frame) => frame.intrinsicallySized),
      allSlotsContainImages: frames.length > 0 && frames.every((frame) => frame.fitsFrame),
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
    };
  });
}

type ShortSectionFooterSnapshot = {
  isShortSection: boolean;
  lastDishBottom: number;
  footerTop: number;
  maxScroll: number;
  footerVisibleAtBottom: boolean;
  documentHasHorizontalOverflow: boolean;
};

type RenderedSectionDish = {
  id: string;
  name: string;
  path: string;
  href: string;
};

type SectionDishSnapshot = {
  pageIndex: string;
  category: string;
  featured: RenderedSectionDish;
  rows: RenderedSectionDish[];
  all: RenderedSectionDish[];
};

const FEATURED_SECTION_CASES = [
  {
    view: 2,
    featuredDishSlug: "betterave-sous-la-cendre",
    dishSlugs: [
      "pain-de-seigle-chaud",
      "betterave-sous-la-cendre",
      "croquette-de-canard-confit",
      "chou-pointu-braise",
      "huitres-tiedes-au-kombu"
    ]
  },
  {
    view: 3,
    featuredDishSlug: "truite-des-laurentides",
    dishSlugs: [
      "truite-des-laurentides",
      "hamachi-a-la-verveine",
      "boeuf-cru-au-couteau",
      "crabe-des-neiges"
    ]
  },
  {
    view: 4,
    featuredDishSlug: "canard-a-l-erable-noir",
    dishSlugs: [
      "canard-a-l-erable-noir",
      "fletan-roti-au-nori",
      "cote-de-porc-du-quebec",
      "agneau-grille-au-sumac",
      "poulet-de-grain-au-citron-confit",
      "courge-au-charbon"
    ]
  },
  {
    view: 5,
    featuredDishSlug: "gnocchi-de-panais",
    dishSlugs: [
      "orge-perle-des-sous-bois",
      "gnocchi-de-panais",
      "polenta-blanche-fumee",
      "epeautre-cremeux"
    ]
  },
  {
    view: 6,
    featuredDishSlug: "chocolat-fume",
    dishSlugs: [
      "pommes-de-terre-pressees",
      "haricots-verts-a-la-flamme",
      "salade-d-herbes-fraiches",
      "chocolat-fume",
      "pomme-au-poivre-long",
      "parfait-de-mais",
      "agrumes-au-basilic-thai",
      "fromages-du-quebec"
    ]
  },
  {
    view: 7,
    featuredDishSlug: "sauge-75",
    dishSlugs: ["sauge-75", "ecorce", "cendre-rose", "lisiere", "nuit-d-ambre"]
  },
  {
    view: 8,
    featuredDishSlug: "verger-froid",
    dishSlugs: ["verger-froid", "jardin-salin", "the-des-bois", "citron-brule"]
  }
] as const;

async function snapshotOriginalSection(page: Page): Promise<SectionDishSnapshot> {
  return page.evaluate(() => {
    const book = document.querySelector('[data-testid="sauge-noire-book"]');
    const pageIndex = book?.getAttribute("data-page-index");
    const activePage = pageIndex
      ? document.querySelector<HTMLElement>(
          `[data-sauge-flip-page-index="${pageIndex}"]:not([data-sauge-flip-clone])`
        )
      : null;
    const section = activePage?.querySelector<HTMLElement>("section[aria-label]");
    const featuredLink = section?.querySelector<HTMLAnchorElement>("[data-sauge-featured-dish]");
    const rowLinks = section
      ? [...section.querySelectorAll<HTMLAnchorElement>("[data-sauge-dish-row]")]
      : [];
    if (!pageIndex || !activePage || !section || !featuredLink) {
      throw new Error("Expected the original active Sauge Noire section sheet");
    }

    const readDish = (link: HTMLAnchorElement): RenderedSectionDish => {
      const href = link.getAttribute("href") ?? "";
      const path = new URL(href, window.location.href).pathname;
      return {
        id: link.getAttribute("data-dish-id") ?? "",
        name: link.textContent?.replace(/\s+/g, " ").trim() ?? "",
        path,
        href
      };
    };

    const featured = readDish(featuredLink);
    const rows = rowLinks.map(readDish);
    return {
      pageIndex,
      category: section.getAttribute("aria-label") ?? "",
      featured,
      rows,
      all: [featured, ...rows]
    };
  });
}

async function snapshotShortSectionFooter(page: Page): Promise<ShortSectionFooterSnapshot> {
  return page.evaluate(() => {
    const book = document.querySelector('[data-testid="sauge-noire-book"]');
    const index = book?.getAttribute('data-page-index');
    const activePage = index
      ? document.querySelector(`[data-sauge-flip-page-index="${index}"]:not([data-sauge-flip-clone])`)
      : null;
    const section = activePage?.querySelector('section[aria-label]');
    const footer = section?.querySelector('footer');
    const dishLinks = section
      ? [...section.querySelectorAll<HTMLAnchorElement>('a[href*="/dishes/"]')].filter((link) => {
          const rect = link.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
      : [];
    const lastDish = dishLinks.at(-1);
    if (!activePage || !section || !footer || !lastDish) {
      throw new Error('Expected a short Sauge Noire section with a footer and dishes');
    }

    const lastDishRect = lastDish.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const maxScroll = activePage.scrollHeight - activePage.clientHeight;
    activePage.scrollTo({ top: Math.max(0, maxScroll), behavior: 'auto' });
    const footerAtBottom = footer.getBoundingClientRect();

    return {
      isShortSection: section.className.includes('shortSectionPage'),
      lastDishBottom: lastDishRect.bottom,
      footerTop: footerRect.top,
      maxScroll,
      footerVisibleAtBottom: footerAtBottom.top < innerHeight && footerAtBottom.bottom > 0,
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
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
    const activePage = [...(detail?.querySelectorAll<HTMLElement>('[data-sauge-flip-page-index]') ?? [])].find(
      (page) =>
        !page.closest('[data-sauge-flip-clone="true"]') &&
        Boolean(page.querySelector('article:not([data-transition-preview="true"])'))
    );
    const paper = activePage?.querySelector<HTMLElement>('article:not([data-transition-preview="true"])');
    const header = paper?.querySelector("header");
    const logo = header?.querySelector('[aria-label="Sauge Noire"]');
    const title = paper?.querySelector("h1");
    const back = header?.querySelector("a");
    const detailSurface = detail?.querySelector<HTMLElement>('[data-detail-page-flip="true"]');
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
        style.opacity !== "0" &&
        !element.closest('[aria-hidden="true"]')
      );
    };
    const logos = [...(detail?.querySelectorAll('[aria-label="Sauge Noire"]') ?? [])];
    const originalPages = [...(detail?.querySelectorAll<HTMLElement>('[data-sauge-flip-page-index]') ?? [])]
      .filter((page) => !page.closest('[data-sauge-flip-clone="true"]'));
    const externalFloatingLogoCount = [
      ...(detail ? [...detail.children] : []),
      ...(detailSurface ? [...detailSurface.children] : [])
    ].filter((element) => element.matches('[aria-label="Sauge Noire"]')).length;
    if (!detail || !activePage || !paper || !header || !logo || !title || !back) {
      throw new Error("Expected Sauge Noire dish sheet");
    }
    return {
      logo: box(logo),
      title: box(title),
      back: box(back),
      header: box(header),
      pageScrollTop: activePage.scrollTop,
      pageScrollHeight: activePage.scrollHeight,
      pageClientHeight: activePage.clientHeight,
      documentScrollTop: window.scrollY,
      visibleMonograms: logos.filter(isVisible).length,
      externalFloatingLogoCount,
      activePageLogoCount: activePage.querySelectorAll('[aria-label="Sauge Noire"]').length,
      activeHeaderLogoCount: header.querySelectorAll('[aria-label="Sauge Noire"]').length,
      originalPageLogoCounts: originalPages.map((page) =>
        page.querySelectorAll('[aria-label="Sauge Noire"]').length
      ),
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
    await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 15_000 });
    await waitForSaugeImages(page, false);
    const top = await snapshotDish(page);
    expect(top.headerPosition).not.toMatch(/fixed|sticky/);
    expect(top.logoPosition).not.toMatch(/fixed|sticky/);
    expect(top.backPosition).not.toMatch(/fixed|sticky/);
    expect(top.headerSharesPaper).toBe(true);
    expect(top.controlsHavePointerEvents).toBe(true);
    expect(top.visibleMonograms).toBe(1);
    expect(top.externalFloatingLogoCount).toBe(0);
    expect(top.activePageLogoCount).toBe(1);
    expect(top.activeHeaderLogoCount).toBe(1);
    expect(top.originalPageLogoCounts).toEqual([1, 1, 1]);
    expect(top.documentHasHorizontalOverflow).toBe(false);

    const scrollDistance = await scrollDishToBottom(page);
    const bottom = await snapshotDish(page);
    expect(bottom.visibleMonograms).toBeLessThanOrEqual(1);
    expect(bottom.externalFloatingLogoCount).toBe(0);
    expect(bottom.activePageLogoCount).toBe(1);
    expect(bottom.activeHeaderLogoCount).toBe(1);
    expect(bottom.originalPageLogoCounts).toEqual([1, 1, 1]);
    if (scrollDistance > 0) {
      assertDishMovesTogether(top, bottom, `dish ${viewport.width}px`);
    } else {
      expect(Math.abs(bottom.logo.top - top.logo.top), `dish ${viewport.width}px moved without a scroll`).toBeLessThanOrEqual(1);
      expect(Math.abs(bottom.title.top - top.title.top), `dish ${viewport.width}px title moved without a scroll`).toBeLessThanOrEqual(1);
      expect(Math.abs(bottom.back.top - top.back.top), `dish ${viewport.width}px back link moved without a scroll`).toBeLessThanOrEqual(1);
    }
  }
});

test("Sauge Noire short sections keep arrows below the final dish", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    await page.setViewportSize(viewport);
    await gotoSaugeNoireRoute(page, SHORT_SECTION_ROUTE);
    await waitForMenuReady(page);

    const snapshot = await snapshotShortSectionFooter(page);
    expect(snapshot.isShortSection).toBe(true);
    expect(snapshot.footerTop - snapshot.lastDishBottom, `${viewport.width}px footer overlaps final dish`).toBeGreaterThanOrEqual(-1);
    expect(snapshot.maxScroll, `${viewport.width}px short section should keep its scroll container`).toBeGreaterThan(0);
    expect(snapshot.footerVisibleAtBottom, `${viewport.width}px arrows should be visible at the end of the page`).toBe(true);
    expect(snapshot.documentHasHorizontalOverflow, `${viewport.width}px short section overflows horizontally`).toBe(false);
  }
});

test("Sauge Noire featured dishes appear once and preserve the remaining order", async ({ page }) => {
  test.setTimeout(180_000);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    await page.setViewportSize(viewport);

    for (const sectionCase of FEATURED_SECTION_CASES) {
      const route = `/menu/sauge-noire?view=sauge-${sectionCase.view}&lang=fr-CA&currency=CAD`;
      await gotoSaugeNoireRoute(page, route);
      await waitForMenuReady(page);

      const snapshot = await snapshotOriginalSection(page);
      const expectedRows = sectionCase.dishSlugs.filter(
        (slug) => slug !== sectionCase.featuredDishSlug
      );
      const dishIdSet = new Set(snapshot.all.map((dish) => dish.id));
      const dishPathSet = new Set(snapshot.all.map((dish) => dish.path));

      expect(snapshot.pageIndex, `${viewport.width}px view index`).toBe(String(sectionCase.view));
      expect(snapshot.featured.path).toContain(
        `/menu/sauge-noire/dishes/${sectionCase.featuredDishSlug}`
      );
      expect(snapshot.all).toHaveLength(sectionCase.dishSlugs.length);
      expect(snapshot.rows.map((dish) => dish.path.split("/dishes/")[1])).toEqual(expectedRows);
      expect(snapshot.all.filter((dish) => dish.path.includes(sectionCase.featuredDishSlug))).toHaveLength(1);
      expect(snapshot.featured.id).toBeTruthy();
      expect(snapshot.rows.every((dish) => dish.id !== snapshot.featured.id)).toBe(true);
      expect(snapshot.rows.every((dish) => dish.path !== snapshot.featured.path)).toBe(true);
      expect(dishIdSet.size).toBe(sectionCase.dishSlugs.length);
      expect(dishPathSet.size).toBe(sectionCase.dishSlugs.length);
      if (sectionCase.view === 4) {
        expect(snapshot.all.filter((dish) => dish.name.toLowerCase().includes("canard"))).toHaveLength(1);
      }
    }
  }
});

test("Sauge Noire Google review CTA uses the paper and bronze visual language", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 1280, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    await gotoSaugeNoireRoute(page, ENDING_ROUTE);
    await waitForMenuReady(page);

    const cta = page.getByTestId("google-review-cta");
    await expect(cta).toBeVisible();
    const snapshot = await cta.evaluate((element) => {
      const style = getComputedStyle(element);
      const mark = element.querySelector<HTMLElement>('[data-testid="google-review-mark"]');
      const arrow = element.querySelector<HTMLElement>('[data-testid="google-review-arrow"]');
      const rect = element.getBoundingClientRect();
      return {
        text: element.textContent,
        width: rect.width,
        height: rect.height,
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
        shadow: style.boxShadow,
        markColor: mark ? getComputedStyle(mark).color : "",
        markBackground: mark ? getComputedStyle(mark).backgroundImage : "",
        arrowColor: arrow ? getComputedStyle(arrow).color : "",
        arrowPath: arrow?.querySelector("path")?.getAttribute("d") ?? "",
        documentHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });

    expect(snapshot.text).toContain("Laisser un avis Google");
    expect(snapshot.width, `${viewport.width}px CTA should stay compact`).toBeLessThan(viewport.width * 0.85);
    expect(snapshot.height).toBeGreaterThanOrEqual(42);
    expect(snapshot.borderRadius).toBe("13px");
    expect(snapshot.background).not.toContain("255, 255, 255");
    expect(snapshot.markColor).toBe(snapshot.arrowColor);
    expect(snapshot.markBackground).toBe("none");
    expect(snapshot.arrowPath).toBe("M4 16 16 4M8 4h8v8");
    expect(snapshot.documentHasHorizontalOverflow).toBe(false);
  }
});

test("Sauge Noire dish photos stay fully contained in their frames", async ({ page }) => {
  test.setTimeout(150_000);

  for (const viewport of IMAGE_VIEWPORTS) {
    await page.setViewportSize(viewport);

    for (const route of [FIRST_GESTES_ROUTE, COCKTAILS_ROUTE]) {
      await gotoSaugeNoireRoute(page, route);
      await waitForMenuReady(page);
      await waitForSaugeImages(page);
      const menuImages = await snapshotImageContainment(page);

      expect(menuImages.imageCount, `${viewport.width}px ${route} should render dish photos`).toBeGreaterThan(0);
      expect(menuImages.allContain, `${viewport.width}px ${route} uses contain`).toBe(true);
      expect(menuImages.allCentered, `${viewport.width}px ${route} centers images`).toBe(true);
      expect(menuImages.allIntrinsicallySized, `${viewport.width}px ${route} preserves image proportions`).toBe(true);
      expect(menuImages.allSlotsContainImages, `${viewport.width}px ${route} contains each image`).toBe(true);
      expect(menuImages.documentHasHorizontalOverflow, `${viewport.width}px ${route} overflows horizontally`).toBe(false);
    }

    for (const route of [BETTERAVE_DETAIL_ROUTE, SAUGE_75_DETAIL_ROUTE]) {
      await gotoSaugeNoireRoute(page, route);
      await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
      await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 15_000 });
      await waitForSaugeImages(page);
      const detailImages = await snapshotImageContainment(page);

      expect(detailImages.imageCount, `${viewport.width}px ${route} should render a detail photo`).toBe(1);
      expect(detailImages.allContain, `${viewport.width}px ${route} uses contain`).toBe(true);
      expect(detailImages.allCentered, `${viewport.width}px ${route} centers the photo`).toBe(true);
      expect(detailImages.allIntrinsicallySized, `${viewport.width}px ${route} preserves image proportions`).toBe(true);
      expect(detailImages.allSlotsContainImages, `${viewport.width}px ${route} contains the photo`).toBe(true);
      expect(detailImages.documentHasHorizontalOverflow, `${viewport.width}px ${route} overflows horizontally`).toBe(false);
    }
  }
});
