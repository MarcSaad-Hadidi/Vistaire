import { expect, type Page, test } from "@playwright/test";

const MODEL_ASSET_RE =
  /(?:\.(?:glb|usdz)(?:$|[?#])|\/model\/(?:glb|usdz)(?:\/|$|[?#]))/i;
const HYDRATION_MESSAGE_RE =
  /hydration|hydrating|server rendered html|did not match|content does not match/i;
const PUBLIC_EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="spinbutton"]'
].join(",");
const PUBLIC_EDITABLE_ALLOWLIST: readonly string[] = [];
// DishModelViewer treats module initialization as failed after 12 seconds.
// Observe that runtime outcome instead of failing at Playwright's shorter
// default while the model-viewer chunk is cold on CI.
const MODEL_VIEWER_INIT_ASSERTION_TIMEOUT_MS = 15_000;
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

type PageHealth = {
  expectClean: () => void;
  networkIssues: string[];
  consoleErrors: string[];
};

type FirstDishIdentity = {
  anchor: string;
  category: string;
  description: string;
  id: string;
  name: string;
  slug: string;
};

function shouldTrackPageUrl(page: Page, url: string) {
  if (url.startsWith("data:") || url.startsWith("blob:")) return false;

  try {
    const target = new URL(url);
    const currentUrl = page.url();
    if (!currentUrl.startsWith("http")) return true;

    return target.origin === new URL(currentUrl).origin;
  } catch {
    return true;
  }
}

function installPageHealth(page: Page): PageHealth {
  const networkIssues: string[] = [];
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    const text = message.text();
    if (message.type() !== "error" && !HYDRATION_MESSAGE_RE.test(text)) return;
    consoleErrors.push(`${message.type()}: ${text}`);
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!shouldTrackPageUrl(page, url)) return;

    const status = response.status();
    if (status >= 400) {
      networkIssues.push(`${status} ${url}`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? "request failed";

    if (/aborted|cancelled/i.test(failure)) return;
    if (!shouldTrackPageUrl(page, url)) return;
    networkIssues.push(`${failure} ${url}`);
  });

  return {
    consoleErrors,
    networkIssues,
    expectClean() {
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      expect(networkIssues, networkIssues.join("\n")).toEqual([]);
    }
  };
}

function collectModelAssetRequests(page: Page) {
  const requests: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;

    if (MODEL_ASSET_RE.test(pathname) || pathname.startsWith("/model-viewer/")) {
      requests.push(request.url());
    }
  });

  return requests;
}

function maisonMenu(page: Page) {
  return page.locator('[data-menu-ui="maison-elyse"]');
}

async function expectMaisonLocale(
  page: Page,
  locale: "en-CA" | "fr-CA"
) {
  const menu = maisonMenu(page);
  const english = locale === "en-CA";
  await expect(menu).toHaveAttribute("lang", locale);
  await expect(menu).toHaveAttribute("dir", "ltr");
  await expect(menu.getByText(english ? "THE COLLECTION" : "LA COLLECTION", { exact: true })).toBeVisible();
  await expect(
    menu.getByRole("heading", {
      exact: true,
      name: english ? "THE MENU" : "LA CARTE"
    })
  ).toBeVisible();
  await expect(
    menu.getByRole("heading", {
      level: 3,
      name: english ? "Starters" : "Entrées"
    }).first()
  ).toBeVisible();
  await expect(
    menu.getByRole("heading", {
      level: 3,
      name: english ? "Signature dishes" : "Plats signatures"
    }).first()
  ).toBeVisible();
  await expect(menu.getByText(english ? "LA COLLECTION" : "THE COLLECTION", { exact: true })).toHaveCount(0);
  await expect(menu.getByRole("heading", { exact: true, name: english ? "LA CARTE" : "THE MENU" })).toHaveCount(0);
  await expect(menu.getByRole("heading", { level: 3, name: english ? "Entrées" : "Starters" })).toHaveCount(0);
}

async function selectMaisonLocale(
  page: Page,
  locale: "en-CA" | "fr-CA"
) {
  const menu = maisonMenu(page);
  await menu
    .getByRole("button", { name: /Choisir la langue du menu|Choose menu language/i })
    .click();
  const dialog = menu.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", {
      name: locale === "en-CA" ? /English/i : /Fran/i
    })
    .click();
  await expectMaisonLocale(page, locale);
  await expect(dialog).toHaveCount(0);
}

async function expectPublicReadOnlyContract(page: Page) {
  const menu = maisonMenu(page);
  await expect(menu).toBeVisible();
  const leaks = await menu.locator(PUBLIC_EDITABLE_SELECTOR).evaluateAll(
    (elements, allowlist) =>
      elements
        .filter(
          (element) =>
            !allowlist.some((selector) => element.matches(selector))
        )
        .map((element) => element.outerHTML.slice(0, 300)),
    PUBLIC_EDITABLE_ALLOWLIST
  );
  expect(leaks, `unexpected editable public controls:\n${leaks.join("\n")}`).toEqual([]);
}

async function firstDishIdentity(page: Page): Promise<FirstDishIdentity> {
  const menu = maisonMenu(page);
  const dish = menu.locator("[data-public-menu-dish]").first();
  await expect(dish).toBeVisible();
  const card = dish.locator('[data-dish-card="true"]');
  const section = dish.locator("xpath=ancestor::section[1]");
  const href = await card.getAttribute("href");
  expect(href, "public dish card must expose a stable public href").toBeTruthy();
  const pathname = new URL(href ?? "", "http://vistaire.test").pathname;

  return {
    anchor: (await section.getAttribute("id")) ?? "",
    category: (await dish.getAttribute("data-category-id")) ?? "",
    description:
      (await dish.locator('span[class*="dishDescription"]').textContent())?.trim() ?? "",
    id: (await dish.getAttribute("data-dish-id")) ?? "",
    name: (await dish.locator('span[class*="dishName"]').textContent())?.trim() ?? "",
    slug: pathname.split("/").filter(Boolean).at(-1) ?? ""
  };
}

async function expectSemanticMenuPrimitives(page: Page, locale: "en-CA" | "fr-CA") {
  const menu = maisonMenu(page);
  const coverHeading = menu.getByRole("heading", {
    exact: true,
    level: 2,
    name: locale === "en-CA" ? "THE MENU" : "LA CARTE"
  });
  const categoryHeading = menu.getByRole("heading", {
    level: 3,
    name: locale === "en-CA" ? "Starters" : /Entr/i
  }).first();
  const dish = menu.locator("[data-public-menu-dish]").first();

  await expect(coverHeading).toBeVisible();
  await expect(categoryHeading).toBeVisible();
  await expect(categoryHeading).toHaveJSProperty("tagName", "H3");
  await expect(dish.locator('span[class*="dishName"]')).toBeVisible();
  await expect(dish.locator('span[class*="dishDescription"]')).toBeVisible();
  await expect(categoryHeading.locator("input")).toHaveCount(0);
}

async function simulateIosSafari(page: Page) {
  await page.addInitScript((ua) => {
    Object.defineProperty(navigator, "userAgent", { get: () => ua });
    Object.defineProperty(navigator, "platform", { get: () => "iPhone" });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  }, IOS_SAFARI_UA);
}

async function expectHealthyResponse(response: { status: () => number } | null) {
  expect(response, "route should return a response").not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectUrlState(
  page: Page,
  expected: Record<string, string | null>,
  hash = ""
) {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        hash: url.hash,
        query: Object.fromEntries(
          Object.keys(expected).map((key) => [key, url.searchParams.get(key)])
        )
      };
    })
    .toEqual({ hash, query: expected });
}

test.describe("Maison Elyse public QR menu", () => {
  test("mobile scan journey starts directly on the complete menu", async ({ page }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse?table=12&zone=terrasse", {
        waitUntil: "domcontentloaded"
      })
    );

    await expect(page.getByText("LA COLLECTION")).toBeVisible();
    await expect(page.getByRole("heading", { exact: true, name: "LA CARTE" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Bienvenue chez Maison/i })).toHaveCount(0);
    await expect(page.getByText(/d.couvrir ce soir/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Voir toute la carte" })).toHaveCount(0);
    await expect(page.getByTestId("maison-section-plats-signatures")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Entr/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Plats signatures/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Desserts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cocktails" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sans gluten" })).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);
    await expectPublicReadOnlyContract(page);
    await expectSemanticMenuPrimitives(page, "fr-CA");

    await expect(page.getByRole("button", { exact: true, name: "La carte" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtrer" })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    const backToTop = page.locator('[data-back-to-top="true"]');
    await expect(backToTop).toBeVisible();
    await backToTop.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(8);
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page.getByRole("dialog", { name: "Filtrer la carte" })).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Signature" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sans gluten" })).toBeVisible();
    await page.getByRole("button", { name: "3D / AR" }).click();
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page.getByText("Filtre actif : 3D / AR")).toBeVisible();
    await expect(page.getByRole("link", { name: /Homard bleu/i })).toBeVisible();

    await page.getByRole("button", { exact: true, name: "La carte" }).click();
    await expect(page.getByRole("dialog", { name: "La carte" })).toBeVisible();
    await page.getByRole("button", { name: /Toute la carte/i }).click();
    await expect(page.getByText("LA COLLECTION")).toBeVisible();
    await expect(page.getByRole("heading", { exact: true, name: "LA CARTE" })).toBeVisible();
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);
    health.expectClean();
  });
  test("public dish detail exposes 3D and AR only after user intent", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await simulateIosSafari(page);
    await page.setViewportSize({ width: 430, height: 932 });
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse/dishes/homard-bisque?table=12&zone=terrasse", {
        waitUntil: "domcontentloaded"
      })
    );

    await expect(page.getByRole("heading", { level: 1, name: /Homard bleu/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /Image du plat Homard bleu/i })).toBeVisible();
    await expect(page.getByText(/\$\s*104/)).toBeVisible();
    await expect(page.getByText("PLATS SIGNATURES")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ingr.dients/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Allerg.nes/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Note du chef" })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Navigation fiche plat" })
        .getByText(/Maison Élys(?:e|ée)/)
    ).toBeVisible();
    await expect(page.getByText(/Maison Ã/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Retour . la carte/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Retour . la carte/i })).toHaveAttribute(
      "href",
      "/menu/maison-elyse?table=12&zone=terrasse&view=carte"
    );
    await expect(page.getByRole("navigation", { name: "Actions du plat" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { exact: true, name: "Voir en 3D" })
    ).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Action du plat : Voir en 3D/i })).toHaveCount(0);
    await expect(page.getByText("Afficher devant moi")).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);

    await page.waitForLoadState("load");
    await page.getByRole("button", { exact: true, name: "Voir en 3D" }).click();
    await expect(page.locator("model-viewer")).toHaveCount(1, {
      timeout: MODEL_VIEWER_INIT_ASSERTION_TIMEOUT_MS
    });
    await expect(page.getByRole("link", { name: "Afficher devant moi" })).toBeVisible();
    await expect(page.locator('a[rel="ar"][href$=".usdz"]')).toBeVisible();
    await expect.poll(() =>
      modelRequests.some((url) => {
        const pathname = new URL(url).pathname;
        return pathname.endsWith(".glb") || /\/model\/glb(?:\/|$)/i.test(pathname);
      })
    ).toBe(true);
    health.expectClean();
  });

  for (const initialLocale of [
    { alias: "fr", locale: "fr-CA" as const },
    { alias: "en", locale: "en-CA" as const }
  ]) {
    test(`normalizes the ${initialLocale.alias} alias into the initial menu locale`, async ({
      page
    }) => {
      const health = installPageHealth(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await expectHealthyResponse(
        await page.goto(`/menu/maison-elyse?lang=${initialLocale.alias}`, {
          waitUntil: "domcontentloaded"
        })
      );

      await expectMaisonLocale(page, initialLocale.locale);
      await expectSemanticMenuPrimitives(page, initialLocale.locale);
      await expectPublicReadOnlyContract(page);
      health.expectClean();
    });
  }

  test("repeated FR and EN switches preserve scan context, reload state, and avoid model fetches", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);
    const scanQuery = {
      currency: "CAD",
      lang: "fr-CA",
      table: "12",
      view: "carte",
      zone: "terrasse"
    };

    await page.setViewportSize({ width: 390, height: 844 });
    await expectHealthyResponse(
      await page.goto(
        "/menu/maison-elyse?lang=fr&table=12&zone=terrasse&currency=CAD&view=carte#menu",
        { waitUntil: "domcontentloaded" }
      )
    );
    await expectMaisonLocale(page, "fr-CA");

    for (const locale of ["en-CA", "fr-CA", "en-CA"] as const) {
      await selectMaisonLocale(page, locale);
      await expectUrlState(page, { ...scanQuery, lang: locale }, "#menu");
      await expectPublicReadOnlyContract(page);
      expect(modelRequests, `locale switch to ${locale} must stay 2D`).toEqual([]);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectMaisonLocale(page, "en-CA");
    await expectUrlState(page, { ...scanQuery, lang: "en-CA" }, "#menu");
    expect(modelRequests).toEqual([]);
    health.expectClean();
  });

  test("locale switching remains coherent after scroll, menu sheet, and active filter", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse?lang=fr-CA", {
        waitUntil: "domcontentloaded"
      })
    );

    await page.evaluate(() => window.scrollTo({ top: 900, behavior: "auto" }));
    await maisonMenu(page).getByRole("button", { exact: true, name: "La carte" }).click();
    await expect(maisonMenu(page).getByRole("dialog", { name: "La carte" })).toBeVisible();
    await maisonMenu(page).getByRole("button", { exact: true, name: "Fermer" }).click();

    await maisonMenu(page).getByRole("button", { exact: true, name: "Filtrer" }).click();
    const filterDialog = maisonMenu(page).getByRole("dialog", { name: "Filtrer la carte" });
    await filterDialog.getByRole("button", { exact: true, name: "Recommandé" }).click();
    await filterDialog.getByRole("button", { exact: true, name: "Appliquer" }).click();
    await expect(maisonMenu(page).getByText(/Filtre actif/)).toBeVisible();

    await selectMaisonLocale(page, "en-CA");
    await expect(maisonMenu(page).getByText(/Filtre actif|Active filter/)).toHaveCount(0);
    await expectPublicReadOnlyContract(page);
    await selectMaisonLocale(page, "fr-CA");
    await expectPublicReadOnlyContract(page);
    expect(modelRequests).toEqual([]);
    health.expectClean();
  });

  test("language dialog traps focus, closes with Escape, and restores its trigger", async ({
    page
  }) => {
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse?lang=fr-CA", {
        waitUntil: "domcontentloaded"
      })
    );
    const menu = maisonMenu(page);
    const trigger = menu.getByRole("button", { name: /Choisir la langue du menu/i });

    await trigger.focus();
    await trigger.click();
    let dialog = menu.getByRole("dialog", { name: "Langue du menu" });
    await expect(dialog.getByRole("button", { name: "Fermer" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    dialog = menu.getByRole("dialog", { name: "Langue du menu" });
    const dialogButtons = dialog.getByRole("button");
    const firstButton = dialogButtons.first();
    const lastButton = dialogButtons.last();
    await lastButton.focus();
    await page.keyboard.press("Tab");
    await expect(firstButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(lastButton).toBeFocused();
    await dialog.getByRole("button", { name: /English/i }).click();
    await expectMaisonLocale(page, "en-CA");
    await expect(
      menu.getByRole("button", { name: /Choose menu language/i })
    ).toBeFocused();
  });

  test("an explicit URL locale wins over storage and rewrites the stored preference", async ({
    page
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("vistaire:maison-elyse-menu-locale", "en-CA");
    });
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse?lang=fr", { waitUntil: "domcontentloaded" })
    );

    await expectMaisonLocale(page, "fr-CA");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("vistaire:maison-elyse-menu-locale")
        )
      )
      .toBe("fr-CA");
  });

  test("an explicit English URL locale wins over a stored French preference", async ({
    page
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("vistaire:maison-elyse-menu-locale", "fr-CA");
    });
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse?lang=en-CA", {
        waitUntil: "domcontentloaded"
      })
    );

    await expectMaisonLocale(page, "en-CA");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("vistaire:maison-elyse-menu-locale")
        )
      )
      .toBe("en-CA");
  });

  test("immediate browser back after a locale switch keeps explicit URL and DOM locale aligned", async ({
    page
  }) => {
    await expectHealthyResponse(
      await page.goto(
        "/menu/maison-elyse?lang=en-CA&table=31&zone=bar&view=carte",
        { waitUntil: "domcontentloaded" }
      )
    );
    await expectMaisonLocale(page, "en-CA");
    await expectHealthyResponse(
      await page.goto(
        "/menu/maison-elyse?lang=fr-CA&table=12&zone=terrasse&view=carte",
        { waitUntil: "domcontentloaded" }
      )
    );
    await expectMaisonLocale(page, "fr-CA");

    const menu = maisonMenu(page);
    await menu
      .getByRole("button", { name: /Choisir la langue du menu/i })
      .click();
    await menu
      .getByRole("dialog", { name: "Langue du menu" })
      .getByRole("button", { name: /English/i })
      .click({ noWaitAfter: true });
    await page.goBack({ waitUntil: "domcontentloaded" });

    await expectUrlState(page, {
      lang: "en-CA",
      table: "31",
      view: "carte",
      zone: "bar"
    });
    await expectMaisonLocale(page, "en-CA");
    await expectPublicReadOnlyContract(page);
  });

  test("a stored locale wins when the URL has no lang and persists into dish links", async ({
    page
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("vistaire:maison-elyse-menu-locale", "en-CA");
    });
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse?table=7&zone=bar", {
        waitUntil: "domcontentloaded"
      })
    );

    await expectMaisonLocale(page, "en-CA");
    await expectUrlState(
      page,
      { lang: null, table: "7", zone: "bar" }
    );
    const firstDishHref = await maisonMenu(page)
      .locator('[data-dish-card="true"]')
      .first()
      .getAttribute("href");
    const dishUrl = new URL(firstDishHref ?? "", "http://vistaire.test");
    expect(Object.fromEntries(dishUrl.searchParams)).toMatchObject({
      lang: "en-CA",
      table: "7",
      zone: "bar"
    });
  });

  test("the same dish identity and category anchor survive translation while its public name changes", async ({
    page
  }) => {
    const modelRequests = collectModelAssetRequests(page);
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse?lang=fr", { waitUntil: "domcontentloaded" })
    );
    const frenchDish = await firstDishIdentity(page);

    await selectMaisonLocale(page, "en-CA");
    const englishDish = await firstDishIdentity(page);

    expect(englishDish.id).toBe(frenchDish.id);
    expect(englishDish.slug).toBe(frenchDish.slug);
    expect(englishDish.category).toBe(frenchDish.category);
    expect.soft(englishDish.name).toBe(
      "Fresh goat cheese ravioli & Monteregie honey"
    );
    expect.soft(englishDish.name).not.toBe(frenchDish.name);
    expect.soft(englishDish.description).not.toBe(frenchDish.description);
    expect.soft(englishDish.anchor).toBe(frenchDish.anchor);
    expect(modelRequests).toEqual([]);
  });

  test("menu to detail back and forward keeps locale and scan parameters at 430px", async ({
    page
  }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await expectHealthyResponse(
      await page.goto(
        "/menu/maison-elyse?lang=en&table=21&zone=salon&currency=CAD&view=carte",
        { waitUntil: "domcontentloaded" }
      )
    );
    await expectMaisonLocale(page, "en-CA");
    await maisonMenu(page).locator('[data-dish-card="true"]').first().click();

    const dishRoot = page.locator('[data-public-dish-renderer="maison-elyse"]');
    await expect(dishRoot).toBeVisible();
    await expect.soft(dishRoot).toHaveAttribute("lang", "en-CA");
    await expectUrlState(page, {
      currency: "CAD",
      lang: "en-CA",
      table: "21",
      view: "carte",
      zone: "salon"
    });

    await page.goBack({ waitUntil: "domcontentloaded" });
    await expectMaisonLocale(page, "en-CA");
    await expectUrlState(page, {
      currency: "CAD",
      lang: "en",
      table: "21",
      view: "carte",
      zone: "salon"
    });

    await page.goForward({ waitUntil: "domcontentloaded" });
    await expect(dishRoot).toBeVisible();
    await expect.soft(dishRoot).toHaveAttribute("lang", "en-CA");
  });

  test("English dish detail localizes editorial fields, labels, navigation, and accessible names", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectHealthyResponse(
      await page.goto(
        "/menu/maison-elyse/dishes/homard-bisque?lang=en&table=12&zone=terrasse",
        { waitUntil: "domcontentloaded" }
      )
    );

    const dishRoot = page.locator('[data-public-dish-renderer="maison-elyse"]');
    await expect(dishRoot).toHaveAttribute("lang", "en-CA");
    await expect(dishRoot).toHaveAttribute("dir", "ltr");
    await expect(
      dishRoot.getByRole("heading", {
        level: 1,
        name: "Blue lobster, deep bisque & fennel"
      })
    ).toBeVisible();
    await expect(dishRoot.getByText(/Pearled lobster served with a reduced shellfish bisque/i)).toBeVisible();
    await expect(dishRoot.getByText("Signature dishes", { exact: true })).toBeVisible();
    for (const label of ["Ingredients", "Options", "Chef's note"]) {
      await expect(dishRoot.getByRole("heading", { name: label })).toBeVisible();
    }
    await expect(dishRoot.getByRole("heading", { name: "Allergen declarations" })).toBeVisible();
    for (const ingredient of [
      "Island lobster",
      "Young carrots",
      "Confit fennel",
      "House bisque",
      "VSOP cognac",
      "Artisanal pastis"
    ]) {
      await expect(dishRoot.getByText(ingredient, { exact: true })).toBeVisible();
    }
    await expect(dishRoot.getByText("Shellfish, Fish", { exact: true })).toBeVisible();
    await expect(
      dishRoot.getByText(
        "Possible replacement: roasted monkfish, supplement based on market.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      dishRoot.getByText(
        "Our marine signature, best with Meursault or a mineral white from the Rhone.",
        { exact: true }
      )
    ).toBeVisible();
    const badges = dishRoot.getByLabel("Dish badges");
    for (const badge of ["Signature", "Recommended", "3D", "AR"]) {
      await expect(badges.getByText(badge, { exact: true })).toBeVisible();
    }
    await expect(dishRoot.getByRole("img", { name: /Dish image: Blue lobster/i })).toBeVisible();
    const show3d = dishRoot.getByRole("button", { exact: true, name: "View in 3D" });
    await expect(show3d).toHaveAttribute("aria-expanded", "false");
    await expect(dishRoot.locator("model-viewer")).toHaveCount(0);
    await expect(dishRoot.getByRole("link", { name: "Back to menu" })).toHaveAttribute(
      "href",
      /lang=en-CA.*table=12.*zone=terrasse.*view=carte/
    );
    expect(modelRequests).toEqual([]);

    await show3d.click();
    await expect(
      dishRoot.getByRole("heading", { exact: true, name: "View the dish in 3D" })
    ).toBeVisible();
    await expect(
      dishRoot.getByText(
        "Rotate the dish in 3D. In AR, place it once: it stays fixed there, without automatic rotation or resizing.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      dishRoot.getByRole("button", { exact: true, name: "Close" })
    ).toHaveAttribute("aria-expanded", "true");
    await expect(dishRoot.locator("model-viewer")).toHaveCount(1, {
      timeout: MODEL_VIEWER_INIT_ASSERTION_TIMEOUT_MS
    });
    await expect
      .poll(() =>
        modelRequests.some((url) => {
          const pathname = new URL(url).pathname;
          return pathname.endsWith(".glb") || /\/model\/glb(?:\/|$)/i.test(pathname);
        })
      )
      .toBe(true);
    health.expectClean();
  });

  test.describe("browser chrome locale is independent from the restaurant menu locale", () => {
    test.use({ locale: "en-US" });

    test("an English browser still receives the restaurant French default without URL or storage", async ({
      page
    }) => {
      const health = installPageHealth(page);
      const modelRequests = collectModelAssetRequests(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await expectHealthyResponse(
        await page.goto("/menu/maison-elyse", { waitUntil: "domcontentloaded" })
      );

      await expect.poll(() => page.evaluate(() => navigator.language)).toBe("en-US");
      await expectMaisonLocale(page, "fr-CA");
      await expectSemanticMenuPrimitives(page, "fr-CA");
      expect(modelRequests).toEqual([]);
      health.expectClean();
    });
  });

  test("mixed-case Maison Elyse slug remains healthy on desktop", async ({ page }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expectHealthyResponse(
      await page.goto("/menu/maison-Elyse", { waitUntil: "domcontentloaded" })
    );
    await expect(page.getByText("LA COLLECTION")).toBeVisible();
    await expect(page.getByRole("heading", { exact: true, name: "LA CARTE" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /Bienvenue chez Maison/i })).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);
    await expectPublicReadOnlyContract(page);
    await expectSemanticMenuPrimitives(page, "fr-CA");
    health.expectClean();
  });
});
