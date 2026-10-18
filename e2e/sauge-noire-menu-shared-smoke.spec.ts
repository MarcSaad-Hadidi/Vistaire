import { expect, test, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

function installHealthChecks(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    try {
      const current = new URL(page.url());
      if (new URL(response.url()).origin === current.origin) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    } catch {
      // Ignore non-HTTP responses while retaining same-origin HTTP failures.
    }
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    try {
      const current = new URL(page.url());
      if (new URL(request.url()).origin === current.origin) {
        networkErrors.push(`${request.failure()?.errorText ?? "request failed"} ${request.url()}`);
      }
    } catch {
      // Ignore non-HTTP requests.
    }
  });

  return () => {
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
    expect(networkErrors, networkErrors.join("\n")).toEqual([]);
  };
}

type MenuTelemetry = { eventName: string; restaurantId: string; menuId: string; source: string; dishSlug?: string; metadata?: Record<string, unknown> };
async function interceptTelemetry(page: Page) {
  const events: MenuTelemetry[] = [];
  await page.route("**/api/analytics/events", async route => {
    events.push(route.request().postDataJSON() as MenuTelemetry);
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"persisted":false}' });
  });
  return events;
}
async function expectMenuTelemetry(events: MenuTelemetry[], restaurantId: string, menuId: string) {
  for (const eventName of ["menu_opened", "menu_list_viewed", "dish_visible", "dish_selected", "dish_opened"]) {
    await expect.poll(() => events.some(event => event.eventName === eventName && event.restaurantId === restaurantId && event.menuId === menuId)).toBe(true);
  }
  const tenantEvents = events.filter(event => event.restaurantId === restaurantId);
  expect(tenantEvents.every(event => event.source === "production" && event.menuId === menuId)).toBe(true);
  expect(tenantEvents.filter(event => event.eventName === "dish_opened")).toHaveLength(1);
  expect(JSON.stringify(events)).not.toMatch(/searchQuery|referrer|private-query@example/);
  expect(events.some(event => event.eventName === "ar_outcome" && event.metadata?.outcome === "presenting")).toBe(false);
}

async function expectHealthyNavigation(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response?.status(), `${path} should not return 4xx/5xx`).toBeLessThan(400);
  if (path === "/demo") {
    // Autoplay videos keep downloading after the discovery links are ready.
    await expect(page.getByRole("link", { name: "Explorer Maison Élyse", exact: true })).toBeVisible();
    return;
  }
  // The route can be server-rendered before the client menu controls hydrate.
  // Wait for the client chunks and fixture requests to settle before
  // asserting interactive transitions.
  await page.waitForLoadState("networkidle", { timeout: 15_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2
      )
    )
    .toBe(true);
}

test.describe("shared public menu smoke · one Chromium fixture", { tag: '@critical' }, () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("generic demo navigates menu → dish → menu without early 3D requests", async ({ page }) => {
    const expectHealthy = installHealthChecks(page);
    const telemetry = await interceptTelemetry(page);
    const modelRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      // The discovery page owns a 3D room; dish/AR assets still require intent.
      if (/\.(?:glb|usdz)(?:$|[?#])/i.test(url.pathname)
        && !url.pathname.startsWith('/immersive-assets/')) modelRequests.push(request.url());
    });

    await expectHealthyNavigation(page, "/demo");
    await page.getByRole("link", { name: "Explorer Maison Élyse", exact: true }).click();
    const menu = page.locator('[data-menu-ui="maison-elyse"]');
    await expect(menu.getByText("LA COLLECTION")).toBeVisible();
    await expect(menu.getByRole("heading", { name: "LA CARTE" })).toBeVisible();
    const dish = menu.getByRole("link", { name: /Ravioles/i }).first();
    await expect(dish).toBeVisible();
    await dish.click();
    await expect(page).toHaveURL(/\/menu\/maison-elyse\/dishes\//);
    await expect(page.getByRole("heading", { level: 1, name: /Ravioles/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /Retour/i }).first().click();
    await expect(page).toHaveURL(/\/menu\/maison-elyse\?/);
    await expect(page.getByRole("heading", { name: "LA CARTE" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMenuTelemetry(telemetry, "11111111-1111-4111-8111-111111111112", "22222222-2222-4222-8222-222222222223");
    expect(modelRequests).toEqual([]);
    expectHealthy();
  });

  test("Trouvable keeps categories, switches language, opens a photographed dish, and returns", async ({
    page
  }) => {
    const expectHealthy = installHealthChecks(page);
    const telemetry = await interceptTelemetry(page);
    await expectHealthyNavigation(page, "/menu/trouvable?lang=fr-CA&table=12&zone=terrasse");
    const menu = page.locator('main[data-menu-ui="trouvable"]');
    await expect(menu).toBeVisible();
    const categories = page.locator('[class*="categoryRail"]').first().getByRole("button");
    await expect(categories).not.toHaveCount(0);

    const languageButton = page.locator('button[aria-haspopup="dialog"][aria-label$=": FR"]');
    await expect(languageButton).toBeVisible();
    await languageButton.click();
    const languageDialog = page.getByRole("dialog", { name: /Langue du menu|Menu language/i });
    await expect(languageDialog).toBeVisible();
    await languageDialog.getByRole("button", { name: /English|EN/i }).click();
    await expect(page).toHaveURL(/[?&]lang=en-CA(?:&|$)/);
    await expect(page.locator('main[data-menu-ui="trouvable"]')).toHaveAttribute("lang", "en-CA");

    const dishButton = page.locator("#trouvable-dish-results button[aria-haspopup='dialog']").first();
    await expect(dishButton).toBeVisible();
    await dishButton.click();
    const dishDialog = page.locator('[role="dialog"][aria-labelledby="trouvable-dish-title"]');
    await expect(dishDialog).toBeVisible();
    await expect(dishDialog.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(dishDialog.locator("img, [class*='detailVisual'] > span")).toHaveCount(1);
    await dishDialog.getByRole("button", { name: /Retour|Back/i }).click();
    await expect(dishDialog).toBeHidden();
    await expectMenuTelemetry(telemetry, "11111111-1111-4111-8111-111111111113", "22222222-2222-4222-8222-222222222224");
    await page.locator("#trouvable-menu-search").fill("private-query@example.test");
    await expect.poll(() => telemetry.some(event => event.eventName === "search_results" && event.metadata?.resultCount === 0 && event.metadata?.queryLengthBucket === "11-30")).toBe(true);
    expect(JSON.stringify(telemetry)).not.toContain("private-query@example.test");
    await expectNoHorizontalOverflow(page);
    expectHealthy();
  });

  test("Sauge Noire critical path loads, opens one section and returns from one dish", async ({
    page
  }) => {
    const expectHealthy = installHealthChecks(page);
    const telemetry = await interceptTelemetry(page);
    const context = { lang: "fr-CA", currency: "CAD", table: "main", zone: "terrasse" };
    const menuPath = `/menu/sauge-noire?${new URLSearchParams({ ...context, view: "sauge-1" })}`;
    await expectHealthyNavigation(page, menuPath);

    const book = page.getByTestId("sauge-noire-book");
    await expect(book).toBeVisible();
    await expect(book).toHaveAttribute("data-page-index", "1");
    await expect(page.locator('[data-page-flip-state="ready"]')).toHaveCount(1, { timeout: 15_000 });
    const surface = page
      .locator('[data-sauge-route-renderer-pending-handoff="false"]')
      .locator('[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"][data-sauge-reading-visible="true"]');
    await expect(surface).toBeVisible({ timeout: 15_000 });
    await surface.getByRole("button", { name: /Premiers gestes/i }).click();
    await expect(book).toHaveAttribute("data-page-index", "2", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/menu\/sauge-noire\?.*[?&]view=sauge-2|\/menu\/sauge-noire\?.*view=sauge-2/);
    const section = page
      .locator('[data-sauge-route-renderer-pending-handoff="false"]')
      .locator('[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"][data-sauge-reading-visible="true"]');
    await expect(section.getByRole("heading", { name: "PREMIERS GESTES" })).toBeVisible({ timeout: 15_000 });
    await section.locator('[data-sauge-featured-dish="true"]').click();
    await expect(page).toHaveURL(/\/menu\/sauge-noire\/dishes\/betterave-sous-la-cendre\?.*view=sauge-2/);
    await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
    const detailSurface = page
      .locator('[data-sauge-route-renderer-pending-handoff="false"]')
      .locator('[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"][data-sauge-reading-visible="true"]');
    await expect(detailSurface).toHaveCount(1, { timeout: 15_000 });
    await expectMenuTelemetry(telemetry, "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222");
    await detailSurface.locator('[data-sauge-typography-role="back-control"]').click();
    await expect(page).toHaveURL(/\/menu\/sauge-noire\?.*view=sauge-2/);
    await expectNoHorizontalOverflow(page);
    expectHealthy();
  });
});
