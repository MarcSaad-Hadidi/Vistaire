import { expect, type Locator, type Page, test } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const WIDE_MOBILE_VIEWPORT = { width: 430, height: 932 };
const CATEGORY_NAV_NAME_RE = /Cat.*gories|Categories/i;

async function swipeMenuSurface(
  surface: Locator,
  direction: "forward" | "back"
) {
  const box = await surface.boundingBox();
  if (!box) {
    throw new Error("Menu swipe surface is not visible");
  }

  const startX =
    direction === "forward" ? box.x + box.width * 0.78 : box.x + box.width * 0.16;
  const endX =
    direction === "forward" ? box.x + box.width * 0.16 : box.x + box.width * 0.84;
  const y = box.y + Math.min(box.height * 0.35, 180);

  await surface.dispatchEvent("pointerdown", {
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
  await surface.dispatchEvent("pointerup", {
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
