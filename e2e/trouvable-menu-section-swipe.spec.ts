import { expect, type Locator, type Page, test } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const WIDE_MOBILE_VIEWPORT = { width: 430, height: 932 };
const CATEGORY_NAV_NAME_RE = /Cat.*gories|Categories/i;

const CATEGORY_SWIPE_DISTANCE_PX = 56;

async function swipeLocator(
  target: Locator,
  direction: "forward" | "back",
  yRatio = 0.5
) {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error("Swipe target is not visible");
  }

  const y = box.y + box.height * yRatio;
  const startX =
    direction === "forward" ? box.x + box.width - 10 : box.x + 10;
  const endX =
    direction === "forward"
      ? startX - CATEGORY_SWIPE_DISTANCE_PX
      : startX + CATEGORY_SWIPE_DISTANCE_PX;

  await target.dispatchEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    pointerId: 11,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: y
  });
  await target.dispatchEvent("pointerup", {
    bubbles: true,
    cancelable: true,
    pointerId: 11,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 0,
    clientX: endX,
    clientY: y
  });
}

async function swipeMenuSurface(
  surface: Locator,
  direction: "forward" | "back"
) {
  await swipeLocator(surface, direction, 0.35);
}

async function scrollRailDuringSwipe(rail: Locator) {
  const box = await rail.boundingBox();
  if (!box) {
    throw new Error("Category rail is not visible");
  }

  const startX = box.x + box.width * 0.7;
  const y = box.y + box.height * 0.5;

  await rail.dispatchEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    pointerId: 12,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: y
  });

  const scrollDelta = await rail.evaluate((element) => {
    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const previous = element.scrollLeft;
    const next =
      previous < maxScrollLeft - 8
        ? Math.min(maxScrollLeft, previous + 120)
        : Math.max(0, previous - 120);

    element.scrollLeft = next;
    return element.scrollLeft - previous;
  });

  expect(Math.abs(scrollDelta)).toBeGreaterThan(4);

  await rail.dispatchEvent("pointerup", {
    bubbles: true,
    cancelable: true,
    pointerId: 12,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 0,
    clientX: startX - 90,
    clientY: y
  });
}

function collectModelAssetRequests(page: Page) {
  const requests: string[] = [];

  page.on("request", (request: { url: () => string }) => {
    const pathname = new URL(request.url()).pathname;
    if (MODEL_ASSET_RE.test(pathname)) {
      requests.push(request.url());
    }
  });

  return requests;
}

function getMenuSurfaces(page: Page) {
  const menuRegion = page.getByRole("region", { name: "Carte Trouvable" });

  return {
    menuRegion,
    rail: page.getByRole("navigation", { name: CATEGORY_NAV_NAME_RE }),
    swipeSurface: menuRegion.locator("[data-category-swipe-surface]"),
    sectionTitle: menuRegion.getByRole("heading", { level: 2 }),
    results: page.locator("#trouvable-dish-results")
  };
}

test.describe("Trouvable menu section swipe", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("initial state shows all dishes without a visible Tout category or active rail chip", async ({
    page
  }) => {
    await page.goto("/menu/trouvable");
    const { rail, sectionTitle, results } = getMenuSurfaces(page);

    await expect(sectionTitle).toHaveText("La carte");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("button", { name: /^Tout$/i })).toHaveCount(0);
    await expect(rail.getByRole("button", { name: /^All$/i })).toHaveCount(0);
    await expect(rail.locator('button[aria-current="true"]')).toHaveCount(0);
    await expect(results.locator("li").count()).resolves.toBeGreaterThan(1);
  });

  test("swipe left in the main menu surface selects the first real category", async ({
    page
  }) => {
    const modelRequests = collectModelAssetRequests(page);

    await page.goto("/menu/trouvable");
    const { rail, swipeSurface, sectionTitle } = getMenuSurfaces(page);
    const firstCategoryButton = rail.locator("button").first();

    await swipeMenuSurface(swipeSurface, "forward");

    await expect(firstCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(sectionTitle).not.toHaveText("La carte");
    await expect(firstCategoryButton).toBeInViewport();
    expect(modelRequests).toEqual([]);
  });

  test("swipe left starting on a dish card selects the first real category", async ({
    page
  }) => {
    await page.goto("/menu/trouvable");
    const { rail, sectionTitle } = getMenuSurfaces(page);
    const firstDishSummary = page
      .locator("#trouvable-dish-results button[aria-haspopup='dialog']")
      .first();

    await expect(firstDishSummary).toBeVisible();
    await swipeLocator(firstDishSummary, "forward", 0.5);

    await expect(rail.locator("button").first()).toHaveAttribute("aria-current", "true");
    await expect(sectionTitle).not.toHaveText("La carte");
  });

  test("swipe right from the first category returns to all dishes without an active rail chip", async ({
    page
  }) => {
    await page.goto("/menu/trouvable");
    const { rail, swipeSurface, sectionTitle } = getMenuSurfaces(page);

    await swipeMenuSurface(swipeSurface, "forward");
    await swipeMenuSurface(swipeSurface, "back");

    await expect(sectionTitle).toHaveText("La carte");
    await expect(rail.locator('button[aria-current="true"]')).toHaveCount(0);
  });

  test("rail horizontal scroll does not change the active section", async ({ page }) => {
    await page.goto("/menu/trouvable");
    const { rail, swipeSurface, sectionTitle } = getMenuSurfaces(page);
    const firstCategoryButton = rail.locator("button").first();

    await swipeMenuSurface(swipeSurface, "forward");
    await expect(sectionTitle).not.toHaveText("La carte");

    await scrollRailDuringSwipe(rail);
    await expect(firstCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(sectionTitle).not.toHaveText("La carte");
  });

  test("category tap toggles selection and search or filters still work", async ({ page }) => {
    const modelRequests = collectModelAssetRequests(page);

    await page.goto("/menu/trouvable");
    const { menuRegion, rail, sectionTitle } = getMenuSurfaces(page);
    const firstCategoryButton = rail.locator("button").first();
    const results = page.locator("#trouvable-dish-results");
    const search = page.locator('input[type="search"]');

    await firstCategoryButton.click();
    await expect(firstCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(sectionTitle).not.toHaveText("La carte");

    await firstCategoryButton.click();
    await expect(sectionTitle).toHaveText("La carte");
    await expect(rail.locator('button[aria-current="true"]')).toHaveCount(0);

    const firstDishName =
      ((await results.locator("strong").first().textContent()) ?? "").trim();
    await search.fill(firstDishName.split(/\s+/)[0] ?? firstDishName);
    await expect(results).toContainText(firstDishName);

    await menuRegion
      .locator('button[aria-label*="Filtres"], button[aria-label*="Quick filters"]')
      .click();
    const filterDialog = page.locator(
      '[role="dialog"][aria-labelledby="trouvable-filters-title"]'
    );
    await expect(filterDialog).toBeVisible();
    await filterDialog.getByRole("button", { name: /disponible|available/i }).click();
    await filterDialog.getByRole("button", { name: /Appliquer|Apply/i }).click();
    await expect(filterDialog).toBeHidden();

    expect(modelRequests).toEqual([]);
  });

  test("tapping the highlighted fallback category after search returns to all dishes in one tap", async ({
    page
  }) => {
    await page.goto("/menu/trouvable");
    const { rail, sectionTitle } = getMenuSurfaces(page);
    const firstCategoryButton = rail.locator("button").first();
    const search = page.locator('input[type="search"]');
    const results = page.locator("#trouvable-dish-results");

    const allDishNames = (await results.locator("strong").allTextContents()).map((name) =>
      name.trim()
    );
    expect(allDishNames.length).toBeGreaterThan(1);

    await firstCategoryButton.click();
    await expect(firstCategoryButton).toHaveAttribute("aria-current", "true");

    const categoryDishNames = (await results.locator("strong").allTextContents()).map((name) =>
      name.trim()
    );
    const outsiderName = allDishNames.find((name) => !categoryDishNames.includes(name));
    expect(outsiderName).toBeTruthy();

    await search.fill(outsiderName!.split(/\s+/)[0] ?? outsiderName!);

    const activeButton = rail.locator('button[aria-current="true"]');
    await expect(activeButton).toBeVisible();
    await expect(sectionTitle).not.toHaveText("La carte");
    await activeButton.click();

    await expect(sectionTitle).toHaveText("La carte");
    await expect(rail.locator('button[aria-current="true"]')).toHaveCount(0);
  });

  test("active section stays visible without horizontal overflow at 430px", async ({
    page
  }) => {
    await page.setViewportSize(WIDE_MOBILE_VIEWPORT);
    await page.goto("/menu/trouvable");

    const { rail, swipeSurface } = getMenuSurfaces(page);
    await swipeMenuSurface(swipeSurface, "forward");

    const activeButton = rail.locator('button[aria-current="true"]');
    await expect(activeButton).toBeVisible();
    await expect(activeButton).toBeInViewport();

    const viewportFit = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));

    expect(viewportFit.scrollWidth).toBeLessThanOrEqual(viewportFit.clientWidth);
  });
});
