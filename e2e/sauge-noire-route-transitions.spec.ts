import { expect, test, type Locator, type Page } from "@playwright/test";

const MENU_ROUTE = "/menu/sauge-noire?view=sauge-4&lang=fr-CA&currency=CAD&table=main&zone=terrasse";
const DETAIL_ROUTE = "/menu/sauge-noire/dishes/canard-a-l-erable-noir?lang=fr-CA&currency=CAD&view=sauge-4&table=main&zone=terrasse";

async function openRoute(page: Page, route: string, heading: RegExp) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
  if (response?.status() === 404 || body.includes("This page could not be found")) {
    test.skip(true, "Requires a seeded Sauge Noire Supabase fixture (route returned 404).");
  }
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await expect(page.locator('[data-page-flip-state="ready"]')).toBeVisible({ timeout: 15_000 });
}

async function activeMenuLink(page: Page, selector: string): Promise<Locator> {
  const pageIndex = await page.getByTestId("sauge-noire-book").getAttribute("data-page-index");
  if (!pageIndex) throw new Error("Expected the active Sauge Noire menu page");
  return page.locator(
    `[data-sauge-flip-page-index="${pageIndex}"]:not([data-sauge-flip-clone]) ${selector}`
  ).first();
}

async function dispatchPrimaryClick(link: Locator) {
  await link.dispatchEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0
  });
}

async function assertRealRouteFlip(
  page: Page,
  initialUrl: string,
  destination: Locator
) {
  const transition = page.locator('[data-sauge-route-transition="true"]');
  await expect(transition).toBeVisible();
  await expect(destination).toBeVisible();
  await expect(page).toHaveURL(initialUrl);

  const before = await transition.locator(".stf__item").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).transform)
  );
  await page.waitForTimeout(120);
  expect(page.url(), "the route must remain on the source during the flip").toBe(initialUrl);
  await expect
    .poll(
      async () => {
        const after = await transition.locator(".stf__item").evaluateAll((items) =>
          items.map((item) => getComputedStyle(item).transform)
        );
        return after.some((transform, index) => transform !== before[index]);
      },
      { timeout: 1_500, intervals: [40, 80, 120] }
    )
    .toBe(true);
}

async function scrollActiveSheet(page: Page, amount: number) {
  await page.evaluate((target) => {
    const activePage = document.querySelector<HTMLElement>(
      '[data-page-flip-state="ready"] [data-sauge-flip-page-index]:not([data-sauge-flip-clone]):has(article)'
    );
    if (!activePage) throw new Error("Expected an active Sauge Noire sheet");
    activePage.scrollTop = Math.min(target, activePage.scrollHeight - activePage.clientHeight);
  }, amount);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 }
]) {
  test(`featured dish uses a real menu-to-detail page flip at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openRoute(page, MENU_ROUTE, /CANARD|SAUGE NOIRE/i);

    const link = await activeMenuLink(page, '[data-sauge-featured-dish]');
    const initialUrl = page.url();
    await dispatchPrimaryClick(link);
    await assertRealRouteFlip(
      page,
      initialUrl,
      page.locator('[data-sauge-route-transition] article[data-transition-preview="true"]')
    );

    await expect(page).toHaveURL(/\/menu\/sauge-noire\/dishes\/canard-a-l-erable-noir/);
    await expect(page).toHaveURL(/lang=fr-CA/);
    await expect(page).toHaveURL(/currency=CAD/);
    await expect(page).toHaveURL(/table=main/);
    await expect(page).toHaveURL(/zone=terrasse/);
    await expect.poll(async () => {
      return page.locator(
        '[data-page-flip-state="ready"] [data-sauge-flip-page-index]:not([data-sauge-flip-clone])'
      ).filter({ has: page.locator('article:not([data-transition-preview="true"])') }).first().evaluate(
        (element) => element.scrollTop
      );
    }).toBe(0);
  });

  test(`dish row uses a real menu-to-detail page flip at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openRoute(page, MENU_ROUTE, /CANARD|SAUGE NOIRE/i);

    const link = await activeMenuLink(page, '[data-sauge-dish-row]');
    const initialUrl = page.url();
    const href = await link.getAttribute("href");
    await dispatchPrimaryClick(link);
    await assertRealRouteFlip(
      page,
      initialUrl,
      page.locator('[data-sauge-route-transition] article[data-transition-preview="true"]')
    );
    await expect(page).toHaveURL(new RegExp(new URL(href!, "http://localhost").pathname));
  });

  test(`detail back links use a real reverse page flip at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openRoute(page, DETAIL_ROUTE, /CANARD/);
    await scrollActiveSheet(page, 360);

    const initialUrl = page.url();
    const backLink = page.locator(
      '[data-page-flip-state="ready"] [data-sauge-flip-page-index]:not([data-sauge-flip-clone]) article:not([data-transition-preview="true"]) a'
    ).first();
    await dispatchPrimaryClick(backLink);
    await assertRealRouteFlip(
      page,
      initialUrl,
      page.locator('[data-sauge-route-transition] section[data-transition-preview="true"]')
    );
    await expect(page).toHaveURL(/\/menu\/sauge-noire\?/);
    await expect(page).toHaveURL(/view=sauge-4/);
    await expect(page.getByRole("heading", { name: /CANARD|SAUGE NOIRE/i }).first()).toBeVisible();
  });

  test(`La Carte uses the same reverse page flip at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openRoute(page, DETAIL_ROUTE, /CANARD/);
    await scrollActiveSheet(page, 360);

    const initialUrl = page.url();
    const menuLink = page.getByRole("link", { name: "La Carte" }).first();
    await dispatchPrimaryClick(menuLink);
    await assertRealRouteFlip(
      page,
      initialUrl,
      page.locator('[data-sauge-route-transition] section[data-transition-preview="true"]')
    );
    await expect(page).toHaveURL(/view=sauge-4/);
  });
}

test("direct detail loading never creates a route transition overlay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, DETAIL_ROUTE, /CANARD/);
  await expect(page.locator('[data-sauge-route-transition="true"]')).toHaveCount(0);
});
