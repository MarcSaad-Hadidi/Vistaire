import { expect, test, type Locator, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const LOCALE_SEQUENCE = ["fr-CA", "ar", "en-CA", "es-ES", "it-IT"];

function categoryRail(page: Page): Locator {
  return page.getByRole("navigation", {
    name: /Cat.*gories|Categories|الفئات|Categor[ií]as|Categorie/i
  });
}

async function categoryLabels(page: Page): Promise<string[]> {
  return categoryRail(page).locator("button span").evaluateAll((nodes) =>
    nodes
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean)
  );
}

async function openLanguageSheet(page: Page, currentLocale: string) {
  await page.locator("button", { hasText: currentLocale.toUpperCase() }).first().click();
  await expect(page.locator('[role="dialog"][aria-labelledby="trouvable-language-title"]')).toBeVisible();
}

async function selectLocale(page: Page, currentLocale: string, nextLocale: string) {
  await openLanguageSheet(page, currentLocale);
  const dialog = page.locator('[role="dialog"][aria-labelledby="trouvable-language-title"]');
  await dialog.getByRole("button", { name: new RegExp(nextLocale.toUpperCase(), "i") }).click();
  await expect(page.locator("button", { hasText: nextLocale.toUpperCase() }).first()).toBeVisible();
  await expect(dialog).toBeHidden();
}

test.describe("Trouvable language category regression", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("FR -> AR -> EN -> ES -> IT keeps unique categories and RTL scoped to text", async ({
    page
  }) => {
    await page.goto("/menu/trouvable?lang=fr-CA", { waitUntil: "networkidle" });
    await expect(categoryRail(page)).toBeVisible();
    const initialCount = (await categoryLabels(page)).length;
    expect(initialCount).toBeGreaterThan(1);

    let currentLocale = LOCALE_SEQUENCE[0];
    for (const nextLocale of LOCALE_SEQUENCE.slice(1)) {
      await selectLocale(page, currentLocale, nextLocale);
      currentLocale = nextLocale;

      const labels = await categoryLabels(page);
      expect(labels.length).toBe(initialCount);
      expect(new Set(labels).size).toBe(labels.length);

      const firstButton = categoryRail(page).locator("button").nth(0);
      const secondButton = categoryRail(page).locator("button").nth(1);
      const firstBox = await firstButton.boundingBox();
      const secondBox = await secondButton.boundingBox();
      expect(firstBox?.x).toBeLessThan(secondBox?.x ?? Number.POSITIVE_INFINITY);
    }

    await selectLocale(page, currentLocale, "ar");

    const direction = await page.locator("main").evaluate((main) => ({
      dataTextDirection: main.getAttribute("data-text-direction"),
      rootDir: main.getAttribute("dir"),
      rtlTextZones: main.querySelectorAll('[dir="rtl"]').length
    }));

    expect(direction).toEqual({
      dataTextDirection: "rtl",
      rootDir: null,
      rtlTextZones: expect.any(Number)
    });
    expect(direction.rtlTextZones).toBeGreaterThan(0);
  });
});
