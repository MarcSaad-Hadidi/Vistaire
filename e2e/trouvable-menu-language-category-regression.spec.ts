import { expect, test, type Locator, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const LOCALE_SEQUENCE = [
  "fr-CA",
  "ar",
  "en-CA",
  "es-ES",
  "it-IT",
  "de-DE",
  "el-GR"
];

function categoryRail(page: Page): Locator {
  return page.locator('[class*="categoryRail"]').first();
}

async function categoryLabels(page: Page): Promise<string[]> {
  const buttons = categoryRail(page).getByRole("button");
  await expect(buttons).not.toHaveCount(0);
  return buttons.evaluateAll((nodes) =>
    nodes
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean)
  );
}

function localeShortCode(locale: string): string {
  const [languagePart] = locale.split("-");
  return (languagePart || locale).toUpperCase();
}

async function openLanguageSheet(page: Page, currentLocale: string) {
  const languageButton = page.locator(
    `button[aria-haspopup="dialog"][aria-label$=": ${localeShortCode(currentLocale)}"]`
  );
  await expect(languageButton).toBeVisible();
  await expect(languageButton).toBeEnabled();
  await languageButton.click();
  await expect(page.locator('[role="dialog"][aria-labelledby="trouvable-language-title"]')).toBeVisible();
}

async function selectLocale(page: Page, currentLocale: string, nextLocale: string) {
  await openLanguageSheet(page, currentLocale);
  const dialog = page.locator('[role="dialog"][aria-labelledby="trouvable-language-title"]');
  const choice = dialog.getByRole("button", {
    name: new RegExp(localeShortCode(nextLocale), "i")
  });
  await expect(choice).toBeVisible();
  await choice.click({ force: true });
  await expect(
    page.locator(
      `button[aria-haspopup="dialog"][aria-label$=": ${localeShortCode(nextLocale)}"]`
    )
  ).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`[?&]lang=${nextLocale.replace("-", "\\-")}(?:&|$)`));
}

async function runLanguageScenario(page: Page) {
    await page.goto("/menu/trouvable?lang=fr-CA", { waitUntil: "networkidle" });
    const menuRoot = page.locator('main[data-menu-ui="trouvable"]');
    await expect(menuRoot).toHaveAttribute("lang", "fr-CA");
    await expect(menuRoot).toHaveAttribute(
      "data-menu-ready-locales",
      /fr-CA.*en-CA.*es-ES.*it-IT.*de-DE.*ar.*el-GR/
    );
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
      dataTextDirection: "ltr",
      rootDir: null,
      rtlTextZones: expect.any(Number)
    });
    expect(direction.rtlTextZones).toBe(0);

    await selectLocale(page, "ar", "fr-CA");
}

test.describe("Trouvable language category regression · Chromium 390", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("FR -> AR -> EN -> ES -> IT -> DE -> EL keeps categories and Arabic chrome LTR", ({
    page
  }) => runLanguageScenario(page));
});

test.describe("Trouvable language category regression · Chromium 430", () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test("FR -> AR -> EN -> ES -> IT -> DE -> EL keeps categories and Arabic chrome LTR", ({
    page
  }) => runLanguageScenario(page));
});

test.describe("Trouvable language category regression · desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("FR -> AR -> EN -> ES -> IT -> DE -> EL keeps categories and Arabic chrome LTR", ({
    page
  }) => {
    test.skip(test.info().project.name === "webkit", "Desktop coverage is Chromium-only.");
    return runLanguageScenario(page);
  });
});
