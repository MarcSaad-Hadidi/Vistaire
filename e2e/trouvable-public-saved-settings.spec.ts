import { expect, test, type Locator, type Page } from "@playwright/test";

const SAVED_LOCALE_SHORT_CODES = ["FR", "EN", "ES", "IT", "DE", "AR"];
const SAVED_CURRENCIES = ["CAD", "USD", "EUR", "GBP"];

test.skip(
  process.env.VISTAIRE_REAL_MENU_E2E !== "1",
  "Real Supabase public menu settings regression is opt-in."
);

function categoryRail(page: Page): Locator {
  return page.locator('[class*="categoryRail"]').first();
}

async function categoryLabels(page: Page): Promise<string[]> {
  return categoryRail(page).locator("button span").evaluateAll((nodes) =>
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
  await page
    .locator("button", { hasText: localeShortCode(currentLocale) })
    .first()
    .click();
  await expect(
    page.locator('[role="dialog"][aria-labelledby="trouvable-language-title"]')
  ).toBeVisible();
}

async function selectLocale(page: Page, currentLocale: string, nextLocale: string) {
  await openLanguageSheet(page, currentLocale);
  const dialog = page.locator('[role="dialog"][aria-labelledby="trouvable-language-title"]');
  await dialog.getByRole("button", { name: new RegExp(localeShortCode(nextLocale), "i") }).click();
  await expect(
    page.locator("button", { hasText: localeShortCode(nextLocale) }).first()
  ).toBeVisible();
  await expect(dialog).toBeHidden();
}

async function openCurrencySheet(page: Page, currentCurrency: string) {
  await page.locator("button", { hasText: currentCurrency }).first().click();
  await expect(
    page.locator('[role="dialog"][aria-labelledby="trouvable-currency-title"]')
  ).toBeVisible();
}

async function selectCurrency(page: Page, currentCurrency: string, nextCurrency: string) {
  await openCurrencySheet(page, currentCurrency);
  const dialog = page.locator('[role="dialog"][aria-labelledby="trouvable-currency-title"]');
  await dialog.getByRole("button", { name: new RegExp(nextCurrency, "i") }).click();
  await expect(page.locator("button", { hasText: nextCurrency }).first()).toBeVisible();
  await expect(dialog).toBeHidden();
}

async function firstVisiblePrice(page: Page): Promise<string> {
  return (await page.locator('[class*="dishPrice"]').first().textContent())?.trim() ?? "";
}

test.describe("Trouvable real public saved settings", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows saved public locales and currencies on the real restaurant route", async ({
    page
  }) => {
    await page.goto("/menu/trouvable?lang=fr-CA", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("region", { name: /Carte Trouvable|Trouvable menu/i })
    ).toBeVisible();

    await openLanguageSheet(page, "FR-CA");
    const languageDialog = page.locator(
      '[role="dialog"][aria-labelledby="trouvable-language-title"]'
    );
    for (const locale of SAVED_LOCALE_SHORT_CODES) {
      await expect(
        languageDialog.getByRole("button", { name: new RegExp(locale, "i") })
      ).toBeVisible();
    }
    await page.keyboard.press("Escape");

    await openCurrencySheet(page, "CAD");
    const currencyDialog = page.locator(
      '[role="dialog"][aria-labelledby="trouvable-currency-title"]'
    );
    for (const currency of SAVED_CURRENCIES) {
      await expect(currencyDialog.getByRole("button", { name: new RegExp(currency, "i") })).toBeVisible();
    }
    await page.keyboard.press("Escape");

    const cadPrice = await firstVisiblePrice(page);
    let currentCurrency = "CAD";
    for (const currency of ["USD", "EUR", "GBP"]) {
      await selectCurrency(page, currentCurrency, currency);
      currentCurrency = currency;
      await expect(page.locator('[class*="dishPrice"]').first()).not.toHaveText(cadPrice);
    }

    await selectLocale(page, "FR-CA", "AR");
    const direction = await page.locator("main").evaluate((main) => ({
      dataTextDirection: main.getAttribute("data-text-direction"),
      rootDir: main.getAttribute("dir"),
      rtlTextZones: main.querySelectorAll('[dir="rtl"]').length
    }));
    expect(direction.rootDir).toBeNull();
    expect(direction.dataTextDirection).toBe("rtl");
    expect(direction.rtlTextZones).toBeGreaterThan(0);

    const initialCount = (await categoryLabels(page)).length;
    await selectLocale(page, "AR", "EN-CA");
    await selectLocale(page, "EN-CA", "ES-ES");
    const labels = await categoryLabels(page);
    expect(labels.length).toBe(initialCount);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
