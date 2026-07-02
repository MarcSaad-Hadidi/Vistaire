import { expect, type Locator, type Page, test } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const WIDE_MOBILE_VIEWPORT = { width: 430, height: 932 };
const CATEGORY_NAV_NAME_RE = /Cat.*gories|Categories/i;

async function swipeCategoryRail(
  rail: Locator,
  direction: "forward" | "back"
) {
  const box = await rail.boundingBox();
  if (!box) {
    throw new Error("Category rail is not visible");
  }

  const startX = box.x + box.width * 0.72;
  const endX =
    direction === "forward" ? box.x + box.width * 0.18 : box.x + box.width * 0.86;
  const y = box.y + box.height * 0.5;

  await rail.dispatchEvent("pointerdown", {
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
  await rail.dispatchEvent("pointermove", {
    bubbles: true,
    cancelable: true,
    pointerId: 11,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: (startX + endX) / 2,
    clientY: y
  });
  await rail.dispatchEvent("pointerup", {
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
    sectionTitle: menuRegion.getByRole("heading", { level: 2 })
  };
}

async function categoryButtonLabel(button: Locator) {
  return ((await button.locator("span").first().textContent()) ?? "").trim();
}

async function expectActiveButtonSynced(rail: Locator, sectionTitle: Locator) {
  const activeButton = rail.locator('button[aria-current="true"]');
  await expect(activeButton).toBeVisible();
  await expect(activeButton).toBeInViewport();

  const label = await categoryButtonLabel(activeButton);
  expect(label).not.toEqual("");

  if (label === "Tout" || label === "All") {
    await expect(sectionTitle).toHaveText(/La carte|Menu/);
  } else {
    await expect(sectionTitle).toHaveText(label);
  }

  return activeButton;
}

test.describe("Trouvable menu section swipe", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("first swipe from All lands on the first real category with a visible active rail button", async ({
    page
  }) => {
    const modelRequests = collectModelAssetRequests(page);

    await page.goto("/menu/trouvable");
    const { rail, sectionTitle } = getMenuSurfaces(page);

    await expect(sectionTitle).toHaveText("La carte");
    await expect(rail).toBeVisible();
    await expect(rail.locator("button").first()).toBeInViewport();

    const firstCategoryButton = rail.locator("button").nth(1);
    const secondCategoryButton = rail.locator("button").nth(2);
    const firstCategoryLabel = await categoryButtonLabel(firstCategoryButton);

    await swipeCategoryRail(rail, "forward");

    await expect(firstCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(secondCategoryButton).toHaveAttribute("aria-current", "false");
    await expect(sectionTitle).toHaveText(firstCategoryLabel);
    await expectActiveButtonSynced(rail, sectionTitle);

    expect(modelRequests).toEqual([]);
  });

  test("swipe back returns to All, category clicks stay synced, and rail scroll does not switch sections", async ({
    page
  }) => {
    await page.goto("/menu/trouvable");

    const { rail, sectionTitle } = getMenuSurfaces(page);
    const allCategoryButton = rail.locator("button").first();
    const firstCategoryButton = rail.locator("button").nth(1);
    const secondCategoryButton = rail.locator("button").nth(2);
    const firstCategoryLabel = await categoryButtonLabel(firstCategoryButton);
    const secondCategoryLabel = await categoryButtonLabel(secondCategoryButton);

    await swipeCategoryRail(rail, "forward");
    await expect(firstCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(sectionTitle).toHaveText(firstCategoryLabel);

    await scrollRailDuringSwipe(rail);
    await expect(firstCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(sectionTitle).toHaveText(firstCategoryLabel);

    await swipeCategoryRail(rail, "forward");
    await expect(secondCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(sectionTitle).toHaveText(secondCategoryLabel);

    await swipeCategoryRail(rail, "back");
    await expect(firstCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(sectionTitle).toHaveText(firstCategoryLabel);

    await swipeCategoryRail(rail, "back");
    await expect(sectionTitle).toHaveText("La carte");
    await expect(allCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(allCategoryButton).toBeInViewport();

    await secondCategoryButton.click();
    await expect(secondCategoryButton).toHaveAttribute("aria-current", "true");
    await expect(sectionTitle).toHaveText(secondCategoryLabel);
    await expect(secondCategoryButton).toBeInViewport();
  });

  test("search, filters, and dish detail remain usable without model preloads", async ({
    page
  }) => {
    const modelRequests = collectModelAssetRequests(page);

    await page.goto("/menu/trouvable");
    const { menuRegion } = getMenuSurfaces(page);
    const results = page.locator("#trouvable-dish-results");
    const search = page.locator('input[type="search"]');

    await expect(results.locator("li").first()).toBeVisible();
    const firstDishName =
      ((await results.locator("strong").first().textContent()) ?? "").trim();
    expect(firstDishName).not.toEqual("");

    await search.fill(firstDishName.split(/\s+/)[0] ?? firstDishName);
    await expect(results).toContainText(firstDishName);

    await menuRegion.locator('button[aria-label*="Filtres"], button[aria-label*="Quick filters"]').click();
    const filterDialog = page.locator('[role="dialog"][aria-labelledby="trouvable-filters-title"]');
    await expect(filterDialog).toBeVisible();
    await filterDialog.getByRole("button", { name: /disponible|available/i }).click();
    await filterDialog.getByRole("button", { name: /Appliquer|Apply/i }).click();
    await expect(filterDialog).toBeHidden();

    const filteredDishName =
      ((await results.locator("strong").first().textContent()) ?? "").trim();
    expect(filteredDishName).not.toEqual("");
    await results.locator('button[aria-haspopup="dialog"]').first().click();

    const dishDialog = page.locator('[role="dialog"][aria-labelledby="trouvable-dish-title"]');
    await expect(dishDialog).toBeVisible();
    await expect(dishDialog).toContainText(filteredDishName);
    await dishDialog.locator("nav button").first().click();
    await expect(dishDialog).toBeHidden();

    expect(modelRequests).toEqual([]);
  });

  test("active section remains visible and overflow-safe at 430px", async ({
    page
  }) => {
    await page.setViewportSize(WIDE_MOBILE_VIEWPORT);
    await page.goto("/menu/trouvable");

    const { rail, sectionTitle } = getMenuSurfaces(page);
    await swipeCategoryRail(rail, "forward");
    await expectActiveButtonSynced(rail, sectionTitle);

    const viewportFit = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));

    expect(viewportFit.scrollWidth).toBeLessThanOrEqual(viewportFit.clientWidth);
  });
});
