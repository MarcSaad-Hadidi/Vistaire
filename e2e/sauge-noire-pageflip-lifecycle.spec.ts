import { expect, test } from "@playwright/test";

const COVER_ROUTE = "/menu/sauge-noire?view=sauge-0&lang=fr-CA&currency=CAD";

type LifecycleProbe = {
  states: string[];
  parentChanges: number;
  parentCount: number;
  bookKeys: string[];
  fallbackVisible: boolean;
  initializingVisible: boolean;
};

type ContentsJumpProbe = {
  actualPages: number[];
  states: string[];
  urls: string[];
  sameRoot: boolean;
  fallbackVisible: boolean;
};

async function installLifecycleProbe(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>("[data-page-flip-state]");
    if (!viewport) throw new Error("Expected a Sauge Noire PageFlip viewport");

    const probe = {
      states: [] as string[],
      parentChanges: 0,
      parentCount: 0,
      bookKeys: [] as string[],
      fallbackVisible: false,
      initializingVisible: false,
      lastState: "",
      initialParent: null as Element | null,
      timer: 0
    };
    const isVisible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const sample = () => {
      const currentParent = viewport.querySelector(".stf__parent");
      const state = viewport.getAttribute("data-page-flip-engine-state") ?? "";
      const key = viewport.getAttribute("data-page-flip-book-key") ?? "";
      if (!probe.initialParent && currentParent) probe.initialParent = currentParent;
      if (probe.initialParent && currentParent !== probe.initialParent) probe.parentChanges += 1;
      if (state && state !== probe.lastState) {
        probe.states.push(state);
        probe.lastState = state;
      }
      if (key && !probe.bookKeys.includes(key)) probe.bookKeys.push(key);
      probe.parentCount = document.querySelectorAll(".stf__parent").length;
      probe.fallbackVisible = [...document.querySelectorAll<HTMLElement>("[data-page-flip-fallback]")].some(isVisible);
      probe.initializingVisible = [...document.querySelectorAll<HTMLElement>("[class*=pageFlipInitializing]")].some(isVisible);
    };
    sample();
    probe.timer = window.setInterval(sample, 8);
    (window as typeof window & { __saugeLifecycleProbe?: typeof probe }).__saugeLifecycleProbe = probe;
  });
}

async function readLifecycleProbe(page: import("@playwright/test").Page): Promise<LifecycleProbe> {
  return page.evaluate(() => {
    const probe = (window as typeof window & { __saugeLifecycleProbe?: LifecycleProbe }).__saugeLifecycleProbe;
    if (!probe) throw new Error("Sauge Noire lifecycle probe was not installed");
    window.clearInterval((probe as LifecycleProbe & { timer?: number }).timer);
    return {
      states: probe.states,
      parentChanges: probe.parentChanges,
      parentCount: probe.parentCount,
      bookKeys: probe.bookKeys,
      fallbackVisible: probe.fallbackVisible,
      initializingVisible: probe.initializingVisible
    };
  });
}

async function installContentsJumpProbe(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>("[data-page-flip-state]");
    const root = viewport?.querySelector(".stf__parent");
    if (!viewport || !root) throw new Error("Expected a ready Sauge Noire PageFlip root");

    const scope = window as typeof window & {
      __saugeContentsJumpProbe?: {
        actualPages: number[];
        states: string[];
        urls: string[];
        initialRoot: Element;
        fallbackVisible: boolean;
        observer: MutationObserver;
      };
    };
    const probe = {
      actualPages: [] as number[],
      states: [] as string[],
      urls: [`${location.pathname}${location.search}`],
      initialRoot: root,
      fallbackVisible: false,
      observer: null as unknown as MutationObserver
    };
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
    const capture = () => {
      const actualPage = Number(viewport.getAttribute("data-page-flip-actual-page"));
      const state = viewport.getAttribute("data-page-flip-engine-state") ?? "";
      const url = `${location.pathname}${location.search}`;
      if (Number.isInteger(actualPage) && probe.actualPages.at(-1) !== actualPage) {
        probe.actualPages.push(actualPage);
      }
      if (state && probe.states.at(-1) !== state) probe.states.push(state);
      if (probe.urls.at(-1) !== url) probe.urls.push(url);
      if (
        [...document.querySelectorAll<HTMLElement>("[data-page-flip-fallback]")].some(visible)
      ) {
        probe.fallbackVisible = true;
      }
    };
    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      originalReplaceState(...args);
      capture();
    };
    const originalPushState = history.pushState.bind(history);
    history.pushState = (...args) => {
      originalPushState(...args);
      capture();
    };
    capture();
    probe.observer = new MutationObserver(capture);
    probe.observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        "data-page-flip-actual-page",
        "data-page-flip-engine-state",
        "data-page-flip-state"
      ]
    });
    scope.__saugeContentsJumpProbe = probe;
  });
}

async function readContentsJumpProbe(
  page: import("@playwright/test").Page
): Promise<ContentsJumpProbe> {
  return page.evaluate(() => {
    const probe = (
      window as typeof window & {
        __saugeContentsJumpProbe?: {
          actualPages: number[];
          states: string[];
          urls: string[];
          initialRoot: Element;
          fallbackVisible: boolean;
          observer: MutationObserver;
        };
      }
    ).__saugeContentsJumpProbe;
    if (!probe) throw new Error("Contents jump probe was not installed");
    probe.observer.disconnect();
    return {
      actualPages: probe.actualPages,
      states: probe.states,
      urls: probe.urls,
      sameRoot:
        probe.initialRoot ===
        document.querySelector('[data-page-flip-state="ready"] .stf__parent'),
      fallbackVisible: probe.fallbackVisible
    };
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 }
]) {
  test(`opens the cover exactly once while the mobile viewport height changes at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(45_000);
    await page.setViewportSize(viewport);
    await page.goto(COVER_ROUTE, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Tapotez pour ouvrir/i })).toHaveCount(1);

    await installLifecycleProbe(page);
    await page.getByRole("button", { name: /Tapotez pour ouvrir/i }).click();
    await page.waitForTimeout(40);
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 64 });
    await page.waitForTimeout(1_100);

    const probe = await readLifecycleProbe(page);
    expect(probe.states.filter((state) => state === "flipping")).toHaveLength(1);
    expect(probe.states.filter((state) => state === "read")).toHaveLength(2);
    expect(probe.parentChanges).toBe(0);
    expect(probe.parentCount).toBe(1);
    expect(probe.bookKeys).toEqual(["sauge-main-book"]);
    expect(probe.fallbackVisible).toBe(false);
    expect(probe.initializingVisible).toBe(false);
    await expect(page).toHaveURL(/view=sauge-1/);
    await expect(page.getByRole("heading", { name: /Table des matières/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tapotez pour ouvrir/i })).toHaveCount(0);
  });
}

test("modified dish clicks remain native and do not start the route overlay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/sauge-noire?view=sauge-4&lang=fr-CA&currency=CAD", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 15_000 });
  const initialUrl = page.url();

  for (const modifiers of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 }
  ]) {
    const link = page.locator('[data-sauge-featured-dish]').first();
    const defaultPrevented = await link.evaluate((element, init) => {
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: init.button ?? 0,
        ctrlKey: init.ctrlKey,
        metaKey: init.metaKey,
        shiftKey: init.shiftKey,
        altKey: init.altKey
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }, modifiers);
    expect(defaultPrevented).toBe(false);
    await page.goto(initialUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-sauge-route-transition="true"]')).toHaveCount(0);
    await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 15_000 });
  }
});

test("End resumes a multi-page jump after each intermediate sheet settles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/sauge-noire?view=sauge-1&lang=fr-CA&currency=CAD", {
    waitUntil: "domcontentloaded"
  });
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 15_000 });

  await page.keyboard.press("End");

  await expect(page).toHaveURL(/view=sauge-9/, { timeout: 12_000 });
  await expect(page.getByTestId("sauge-noire-book")).toHaveAttribute("data-page-index", "9");
});

for (const viewportSize of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 900 }
]) {
  for (const origin of [4, 7, 9]) {
    test(`Table des matières flips once then jumps instantly from page ${origin} at ${viewportSize.width}px`, async ({
      page
    }) => {
      await page.setViewportSize(viewportSize);
      await page.goto(
        `/menu/sauge-noire?view=sauge-${origin}&lang=fr-CA&currency=CAD`,
        { waitUntil: "domcontentloaded" }
      );
      const viewport = page.locator('[data-page-flip-state="ready"]').first();
      await expect(viewport).toBeVisible({ timeout: 15_000 });
      await expect(viewport).toHaveAttribute("data-page-flip-actual-page", String(origin));
      await installContentsJumpProbe(page);

      await page
        .locator(
          `[data-sauge-flip-page-index="${origin}"]:not([data-sauge-flip-clone])`
        )
        .getByRole("button", { name: /Table des matières/i })
        .click();

      await expect(page).toHaveURL(/view=sauge-1/, { timeout: 12_000 });
      await expect(viewport).toHaveAttribute("data-page-flip-actual-page", "1");
      await expect(page.getByTestId("sauge-noire-book")).toHaveAttribute(
        "data-page-index",
        "1"
      );

      const probe = await readContentsJumpProbe(page);
      expect(probe.actualPages).toEqual([origin, origin - 1, 1]);
      expect(probe.states.filter((state) => state === "flipping")).toHaveLength(1);
      expect(probe.states.slice(1).filter((state) => state === "read")).toHaveLength(1);
      expect(probe.urls.slice(1)).toEqual([
        `/menu/sauge-noire?view=sauge-1&lang=fr-CA&currency=CAD`
      ]);
      expect(probe.sameRoot).toBe(true);
      expect(probe.fallbackVisible).toBe(false);
    });
  }
}

for (const viewportSize of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 900 }
]) {
  test(`Table des matières uses one adjacent flip from page 2 at ${viewportSize.width}px`, async ({ page }) => {
    await page.setViewportSize(viewportSize);
    await page.goto("/menu/sauge-noire?view=sauge-2&lang=fr-CA&currency=CAD", {
      waitUntil: "domcontentloaded"
    });
    const viewport = page.locator('[data-page-flip-state="ready"]').first();
    await expect(viewport).toBeVisible({ timeout: 15_000 });
    await installContentsJumpProbe(page);
    await page
      .locator('[data-sauge-flip-page-index="2"]:not([data-sauge-flip-clone])')
      .getByRole("button", { name: /Table des matières/i })
      .click();
    await expect(viewport).toHaveAttribute("data-page-flip-actual-page", "1");
    const probe = await readContentsJumpProbe(page);
    expect(probe.actualPages).toEqual([2, 1]);
    expect(probe.states.filter((state) => state === "flipping")).toHaveLength(1);
    expect(probe.sameRoot).toBe(true);
    expect(probe.fallbackVisible).toBe(false);
  });
}

test("adjacent dish turns keep one stable engine and recenter without loading", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/menu/sauge-noire/dishes/canard-a-l-erable-noir?lang=fr-CA&currency=CAD&view=sauge-4",
    { waitUntil: "domcontentloaded" }
  );
  const viewport = page.locator('[data-page-flip-state="ready"]').first();
  await expect(viewport).toBeVisible({ timeout: 15_000 });
  await expect(viewport).toHaveAttribute("data-page-flip-current-page", "1");
  const initialKey = await viewport.getAttribute("data-page-flip-book-key");
  await page.evaluate(() => {
    const root = document.querySelector('[data-page-flip-state="ready"] .stf__parent');
    if (!root) throw new Error("Expected the initial detail PageFlip root");
    (window as typeof window & { __saugeInitialDetailRoot?: Element }).__saugeInitialDetailRoot = root;
    (window as typeof window & { __saugeSawDetailLoading?: boolean }).__saugeSawDetailLoading = false;
    (window as typeof window & { __saugeVisibleDetailTitles?: string[] }).__saugeVisibleDetailTitles = [];
    const observer = new MutationObserver(() => {
      const loading = document.querySelector('[data-page-flip-fallback="loading"]');
      if (loading) {
        (window as typeof window & { __saugeSawDetailLoading?: boolean }).__saugeSawDetailLoading = true;
      }
      const visibleTitle = Array.from(document.querySelectorAll<HTMLElement>("article h1")).find(
        (title) => {
          const rect = title.getBoundingClientRect();
          const style = getComputedStyle(title);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
        }
      )?.textContent?.trim();
      const titles = (window as typeof window & { __saugeVisibleDetailTitles?: string[] })
        .__saugeVisibleDetailTitles;
      if (visibleTitle && titles && titles.at(-1) !== visibleTitle) titles.push(visibleTitle);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    (window as typeof window & { __saugeDetailObserver?: MutationObserver }).__saugeDetailObserver = observer;
  });

  await page.getByRole("link", { name: /prochain plat/i }).click();
  await expect(page).not.toHaveURL(/canard-a-l-erable-noir/, { timeout: 8_000 });
  await expect(viewport).toHaveAttribute("data-page-flip-state", "ready");
  await expect(viewport).toHaveAttribute("data-page-flip-current-page", "1");
  await expect(viewport).toHaveAttribute("data-page-flip-book-key", initialKey!);

  const lifecycle = await page.evaluate(() => {
    const scope = window as typeof window & {
      __saugeInitialDetailRoot?: Element;
      __saugeSawDetailLoading?: boolean;
      __saugeVisibleDetailTitles?: string[];
      __saugeDetailObserver?: MutationObserver;
    };
    scope.__saugeDetailObserver?.disconnect();
    return {
      sameRoot:
        scope.__saugeInitialDetailRoot ===
        document.querySelector('[data-page-flip-state="ready"] .stf__parent'),
      sawLoading: scope.__saugeSawDetailLoading,
      parentCount: document.querySelectorAll(".stf__parent").length,
      visibleTitles: scope.__saugeVisibleDetailTitles ?? []
    };
  });
  expect(lifecycle.sameRoot).toBe(true);
  expect(lifecycle.sawLoading).toBe(false);
  expect(lifecycle.parentCount).toBe(1);
  const targetTitleIndex = lifecycle.visibleTitles.indexOf("FLÉTAN RÔTI AU NORI");
  expect(targetTitleIndex).toBeGreaterThanOrEqual(0);
  expect(lifecycle.visibleTitles.slice(targetTitleIndex + 1)).not.toContain(
    "CANARD À L’ÉRABLE NOIR"
  );
  await expect(page.locator("article h1:visible")).toHaveCount(1);
  await expect(page.locator("article h1:visible")).toHaveText("FLÉTAN RÔTI AU NORI");
});
