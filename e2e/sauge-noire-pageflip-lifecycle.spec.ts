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
