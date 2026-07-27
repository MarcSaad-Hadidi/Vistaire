import { expect, test, type Locator, type Page } from "@playwright/test";

const detailPath =
  "/menu/sauge-noire/dishes/truite-des-laurentides?lang=fr-CA&currency=CAD&view=sauge-3&table=main&zone=terrasse";

function nextDishLink(page: Page) {
  return page.getByRole("link", { name: /prochain plat/i });
}

function previousDishLink(page: Page) {
  return page.getByRole("link", { name: /plat.*dent/i });
}

async function openDetail(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(detailPath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /TRUITE DES LAURENTIDES/i })).toBeVisible();
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible();
}

async function clickAndAssertFlip(page: Page, link: Locator, currentUrl: string) {
  const transitionSeen = page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".stf__item"));
    return items.length >= 2;
  }, undefined, { timeout: 1500 });
  await link.click();
  await expect(page).toHaveURL(currentUrl);
  await transitionSeen;
  await expect(page.locator('[class*="brandMark"]:visible')).toHaveCount(1);
}

async function visibleScrollState(page: Page) {
  return page.locator('[class*="pageFlipPage"]:visible').first().evaluate((element) => ({
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight
  }));
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
    test(`supports soft page turns at ${viewport.width}px`, async ({ page }) => {
      await openDetail(page, viewport.width, viewport.height);

      await expect(page.locator('[class*="pageFlipPage"]:visible')).toHaveCount(1);
      await expect(page.locator('[class*="detailPageTurn"]')).toHaveCount(0);
      await expect(page.locator('[class*="brandMark"]:visible')).toHaveCount(1);

      const initialUrl = page.url();
      await clickAndAssertFlip(page, nextDishLink(page), initialUrl);
      await expect(page).toHaveURL(/hamachi-a-la-verveine/);
      await expect(page.getByRole("heading", { name: /HAMACHI À LA VERVEINE/i })).toBeVisible();
      await expect(page).toHaveURL(/lang=fr-CA/);
      await expect(page).toHaveURL(/currency=CAD/);
      await expect(page).toHaveURL(/table=main/);
      await expect(page).toHaveURL(/zone=terrasse/);

      await expect.poll(async () => (await visibleScrollState(page)).scrollTop).toBe(0);
      await expect(page.locator('[class*="brandMark"]:visible')).toHaveCount(1);

      const hamachiUrl = page.url();
      await clickAndAssertFlip(page, previousDishLink(page), hamachiUrl);
      await expect(page).toHaveURL(/truite-des-laurentides/);
      await expect(page.getByRole("heading", { name: /TRUITE DES LAURENTIDES/i })).toBeVisible();
      await expect.poll(async () => (await visibleScrollState(page)).scrollTop).toBe(0);
    });
  }

  test("mouse drag, vertical scrolling, pointercancel, 3D and double navigation stay isolated", async ({ page }) => {
    await openDetail(page, 390, 844);

    await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>("[data-page-flip-state]");
      if (!viewport) return;
      (window as typeof window & { __saugeGotPointerCapture?: boolean }).__saugeGotPointerCapture = false;
      viewport.addEventListener("gotpointercapture", () => {
        (window as typeof window & { __saugeGotPointerCapture?: boolean }).__saugeGotPointerCapture = true;
      }, { once: true });
    });

    const initialUrl = page.url();
    const transitionSeen = page.waitForFunction(() => {
      const items = Array.from(document.querySelectorAll<HTMLElement>(".stf__item"));
      return items.length >= 2;
    }, undefined, { timeout: 1500 });
    await drag(page, { x: 300, y: 420 }, { x: 80, y: 420 });
    await expect(page).toHaveURL(initialUrl);
    await transitionSeen;
    await expect(page.locator('[class*="brandMark"]:visible')).toHaveCount(1);
    await expect(page).toHaveURL(/hamachi-a-la-verveine/);
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __saugeGotPointerCapture?: boolean }).__saugeGotPointerCapture)).toBe(true);
    await expect.poll(async () => (await visibleScrollState(page)).scrollTop).toBe(0);

    await page.goto(detailPath, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /TRUITE DES LAURENTIDES/i })).toBeVisible();
    await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible();
    const beforeVerticalUrl = page.url();
    const beforeVertical = await visibleScrollState(page);
    await page.mouse.wheel(0, 520);
    await expect.poll(async () => (await visibleScrollState(page)).scrollTop).toBeGreaterThan(beforeVertical.scrollTop);
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
    await expect(page.getByRole("heading", { name: /TRUITE DES LAURENTIDES/i })).toBeVisible();
    await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible();
    const next = nextDishLink(page);
    const doubleClickUrl = page.url();
    const doubleTransitionSeen = page.waitForFunction(() => {
      const items = Array.from(document.querySelectorAll<HTMLElement>(".stf__item"));
      return items.length >= 2;
    }, undefined, { timeout: 1500 });
    await next.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    await expect(page).toHaveURL(doubleClickUrl);
    await doubleTransitionSeen;
    await expect(page).toHaveURL(/hamachi-a-la-verveine/);
    await expect(page).not.toHaveURL(/boeuf-cru-au-couteau/);
  });
});
