import { expect, type Page, type TestInfo, test } from "@playwright/test";
import {
  ADMIN_VISUAL_FULL_MENU_DISH_IDS,
  adminVisualFullMenuPhotoVersion,
} from "./support/adminVisualFixtureData";

async function enterFullMenuPreview(page: Page, testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  expect(
    baseURL,
    "Playwright baseURL is required for the local preview grant",
  ).toBeTruthy();
  const origin = new URL(baseURL!);
  const response = await page
    .context()
    .request.post(new URL("/admin/preview", origin).toString(), {
      headers: { Origin: origin.origin },
      maxRedirects: 0,
    });
  expect(response.status()).toBe(303);

  const cookies = await page.context().cookies();
  expect(
    cookies.some(
      (cookie) =>
        cookie.name === "vistaire_admin_local_preview" &&
        cookie.path === "/admin" &&
        cookie.httpOnly &&
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cookie.value),
    ),
  ).toBe(true);

  const adminResponse = await page.goto(new URL("/admin", origin).toString(), {
    waitUntil: "domcontentloaded",
  });
  expect(adminResponse?.status()).toBe(200);
  await expect(page.locator("[data-admin-studio]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("[data-admin-studio]")).toContainText(
    "Maison Élysée",
  );
  await page.waitForLoadState("networkidle");
}

test("studio all required viewports stay within the document width", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await enterFullMenuPreview(page, testInfo);
  for (const route of [
    "/admin",
    "/admin/availability",
    "/admin/insights",
    "/admin/planning",
  ]) {
    for (const viewport of [
      { width: 320, height: 700 },
      { width: 360, height: 780 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
      { width: 1672, height: 941 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        )
        .toBe(true);
    }
  }
});

test("full-menu admin parity keeps unavailable dishes private while matching available public dishes", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.VISTAIRE_ADMIN_FIXTURE_SCENARIO !== "full-menu",
    "requires the explicit full-menu fixture scenario",
  );
  await enterFullMenuPreview(page, testInfo);
  await page.goto("/admin/availability", { waitUntil: "domcontentloaded" });
  const rows = page.locator("[data-admin-menu-dish]");
  await expect(rows).toHaveCount(12);
  expect(
    await page.locator('article[data-available="true"]').count(),
  ).toBeGreaterThan(0);
  expect(
    await page.locator('article[data-available="false"]').count(),
  ).toBeGreaterThan(0);
  const names = await rows.locator("h3").allTextContents();
  expect(new Set(names).size).toBe(12);
  const categories = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-category-id")),
  );
  expect(new Set(categories).size).toBeGreaterThanOrEqual(4);
  const adminDishes = await rows.evaluateAll((elements) =>
    elements
      .map((element) => ({
        id: element.getAttribute("data-dish-id"),
        categoryId: element.getAttribute("data-category-id"),
        available: element.getAttribute("data-available"),
      }))
      .sort((left, right) => (left.id ?? "").localeCompare(right.id ?? "")),
  );
  expect(adminDishes).not.toContainEqual(
    expect.objectContaining({ id: "other-menu-dish" }),
  );
  expect(adminDishes).not.toContainEqual(
    expect.objectContaining({ id: "foreign-dish" }),
  );

  await page.goto("/menu/maison-elyse", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("LA COLLECTION")).toBeVisible();
  const publicRows = page.locator("[data-public-menu-dish]");
  const availableAdminDishes = adminDishes.filter(
    ({ available }) => available === "true",
  );
  await expect(publicRows).toHaveCount(availableAdminDishes.length);
  const publicDishes = await publicRows.evaluateAll((elements) =>
    elements
      .map((element) => ({
        id: element.getAttribute("data-dish-id"),
        categoryId: element.getAttribute("data-category-id"),
        available: element.getAttribute("data-available"),
      }))
      .sort((left, right) => (left.id ?? "").localeCompare(right.id ?? "")),
  );
  expect(publicDishes).not.toContainEqual(
    expect.objectContaining({ id: "other-menu-dish" }),
  );
  expect(publicDishes).not.toContainEqual(
    expect.objectContaining({ id: "foreign-dish" }),
  );
  expect(publicDishes.every(({ available }) => available === "true")).toBe(
    true,
  );
  expect(publicDishes).toEqual(availableAdminDishes);
});

test("full-menu admin thumbnails fall back without broken-image icons", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.VISTAIRE_ADMIN_FIXTURE_SCENARIO !== "full-menu",
    "requires the explicit full-menu fixture scenario",
  );
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const adminResponses = new Map<string, import("@playwright/test").Response>();
  const signedResponses = new Map<
    string,
    import("@playwright/test").Response
  >();
  page.on("response", (response) => {
    const url = new URL(response.url());
    const adminMatch =
      /\/admin\/api\/menu-dishes\/([0-9a-f-]+)\/photo(?:\?|$)/i.exec(
        url.pathname,
      );
    if (adminMatch && response.request().method() === "GET") {
      adminResponses.set(adminMatch[1].toLowerCase(), response);
      return;
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/vistaire-media/")) {
      signedResponses.set(response.url(), response);
    }
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text() !== "Failed to load resource: net::ERR_FAILED"
    ) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/admin/api/menu-dishes/*/photo**", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.pathname.endsWith(
        `/admin/api/menu-dishes/${ADMIN_VISUAL_FULL_MENU_DISH_IDS[0]}/photo`,
      )
    ) {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await enterFullMenuPreview(page, testInfo);
  await page.goto("/admin/availability", { waitUntil: "domcontentloaded" });
  const rows = page.locator("[data-admin-menu-dish]");
  await expect(rows).toHaveCount(12);
  expect(
    await page.locator('article[data-available="true"]').count(),
  ).toBeGreaterThan(0);
  expect(
    await page.locator('article[data-available="false"]').count(),
  ).toBeGreaterThan(0);
  await expect(
    page.locator("[data-admin-dish-thumbnail-fallback]").first(),
  ).toBeVisible();
  const fallbackRow = rows
    .filter({ has: page.locator("[data-admin-dish-thumbnail-fallback]") })
    .first();
  await expect(
    fallbackRow.locator("[data-admin-dish-thumbnail] img"),
  ).toHaveCount(0);

  const naturalWidths = new Map<string, number>();
  for (const row of await rows.all()) {
    await row.scrollIntoViewIfNeeded();
    const dishId = await row.getAttribute("data-dish-id");
    if (dishId === ADMIN_VISUAL_FULL_MENU_DISH_IDS[0]) {
      await expect(
        row.locator("[data-admin-dish-thumbnail-fallback]"),
      ).toBeVisible();
      await expect(row.locator("[data-admin-dish-thumbnail] img")).toHaveCount(
        0,
      );
      continue;
    }
    const image = row.locator("[data-admin-dish-thumbnail] img");
    if ((await image.count()) === 0) continue;
    // Trigger lazy loading in this row's viewport, then classify the image by
    // its own request lifecycle. `complete=false` before this point is lazy,
    // not broken; after the trigger it must settle with decoded pixels.
    await image.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "nearest" }),
    );
    await expect
      .poll(
        () =>
          image.evaluate(
            (element) =>
              element instanceof HTMLImageElement &&
              element.complete &&
              element.naturalWidth > 0,
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
    const state = await image.evaluate((element) => ({
      complete: element instanceof HTMLImageElement && element.complete,
      naturalWidth:
        element instanceof HTMLImageElement ? element.naturalWidth : 0,
    }));
    expect(state.complete).toBe(true);
    expect(state.naturalWidth).toBeGreaterThan(0);
    if (dishId) naturalWidths.set(dishId, state.naturalWidth);
  }

  const adminCookie = await page.context().cookies();
  expect(
    adminCookie.some(({ name }) => name === "vistaire_admin_local_preview"),
  ).toBe(true);
  for (const dishId of [
    ADMIN_VISUAL_FULL_MENU_DISH_IDS[1],
    ADMIN_VISUAL_FULL_MENU_DISH_IDS[3],
  ]) {
    const response = adminResponses.get(dishId);
    expect(response, `admin photo request for ${dishId}`).toBeDefined();
    expect(response!.status()).toBe(307);
    const signedLocation = response!.headers()["location"];
    expect(signedLocation).toMatch(
      /^https?:\/\/127\.0\.0\.1:\d+\/storage\/v1\/object\/sign\/vistaire-media\/restaurants\/[^/]+\/photos\/originals\/[^?]+\.png\?token=fixture-signed-token$/,
    );
    const signed = signedResponses.get(signedLocation);
    expect(signed, `signed image response for ${dishId}`).toBeDefined();
    expect(signed!.status()).toBe(200);
    expect(signed!.headers()["content-type"]).toMatch(/^image\/png(?:;|$)/i);
    expect(naturalWidths.get(dishId)).toBeGreaterThan(0);
  }
  const publicUnavailable = await page.request.get(
    `/api/public/menu-dishes/${ADMIN_VISUAL_FULL_MENU_DISH_IDS[3]}/photo?v=${adminVisualFullMenuPhotoVersion(3)}`,
    { maxRedirects: 0 },
  );
  expect(publicUnavailable.status()).toBe(404);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
