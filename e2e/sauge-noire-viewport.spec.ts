import { expect, test } from "@playwright/test";

const menuPath = "/menu/sauge-noire?view=sauge-0";
const detailPath =
  "/menu/sauge-noire/dishes/truite-des-laurentides?lang=fr-CA&currency=CAD&view=sauge-3";
const paper = "rgb(250, 244, 233)";

async function readViewportTheme(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#contenu");
    const detail = document.querySelector<HTMLElement>(
      '[data-testid="sauge-noire-dish-detail"]'
    );

    return {
      themeColors: Array.from(document.querySelectorAll('meta[name="theme-color"]')).map(
        (element) => element.getAttribute("content")
      ),
      colorSchemes: Array.from(document.querySelectorAll('meta[name="color-scheme"]')).map(
        (element) => element.getAttribute("content")
      ),
      htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
      htmlColorScheme: getComputedStyle(document.documentElement).colorScheme,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyColorScheme: getComputedStyle(document.body).colorScheme,
      rootBackground: root ? getComputedStyle(root).backgroundColor : null,
      detailBackground: detail ? getComputedStyle(detail).backgroundColor : null,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
}

async function expectSaugeTheme(page: import("@playwright/test").Page) {
  await expect.poll(async () => (await readViewportTheme(page)).themeColors).toEqual(["#faf4e9"]);
  const theme = await readViewportTheme(page);
  expect(theme.themeColors).toEqual(["#faf4e9"]);
  expect(theme.colorSchemes).toEqual(["light"]);
  expect(theme.htmlBackground).toBe(paper);
  expect(theme.htmlColorScheme).toBe("light");
  expect(theme.bodyBackground).toBe(paper);
  expect(theme.bodyColorScheme).toBe("light");
  expect(theme.rootBackground).toBe(paper);
  expect(theme.detailBackground).toBe(null);
  expect(theme.hasHorizontalOverflow).toBe(false);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 }
]) {
  test(`keeps the Sauge Noire browser chrome beige in the menu and detail at ${viewport.width}px`, async ({
    page
  }) => {
    await page.setViewportSize(viewport);

    await page.goto(menuPath, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /SAUGE NOIRE/i })).toBeVisible();
    await expectSaugeTheme(page);

    await page.goto(detailPath, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /TRUITE/i })).toBeVisible();
    const detailTheme = await readViewportTheme(page);
    expect(detailTheme.themeColors).toEqual(["#faf4e9"]);
    expect(detailTheme.colorSchemes).toEqual(["light"]);
    expect(detailTheme.htmlBackground).toBe(paper);
    expect(detailTheme.bodyBackground).toBe(paper);
    expect(detailTheme.bodyColorScheme).toBe("light");
    expect(detailTheme.rootBackground).toBe(paper);
    expect(detailTheme.detailBackground).toBe(paper);
    expect(detailTheme.hasHorizontalOverflow).toBe(false);
  });
}

test("restores the normal dark Vistaire theme outside Sauge Noire", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const theme = await readViewportTheme(page);
  expect(theme.themeColors).toEqual(["#080706"]);
  expect(theme.colorSchemes).toEqual([]);
  expect(theme.htmlBackground).toBe("rgb(8, 7, 6)");
  expect(theme.htmlColorScheme).toBe("dark");
  expect(theme.bodyColorScheme).toBe("dark");
});

test("restores the normal theme after navigating away from Sauge Noire", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(detailPath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /TRUITE/i })).toBeVisible();
  expect((await readViewportTheme(page)).themeColors).toEqual(["#faf4e9"]);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  const theme = await readViewportTheme(page);
  expect(theme.themeColors).toEqual(["#080706"]);
  expect(theme.colorSchemes).toEqual([]);
  expect(theme.htmlColorScheme).toBe("dark");
  expect(theme.bodyColorScheme).toBe("dark");
});
