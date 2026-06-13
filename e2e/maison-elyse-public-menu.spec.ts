import { expect, type Page, test } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

type PageHealth = {
  expectClean: () => void;
  networkIssues: string[];
  consoleErrors: string[];
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
    if (message.type() !== "error") return;

    const text = message.text();
    if (text.includes("Failed to load resource")) return;
    consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!shouldTrackPageUrl(page, url)) return;

    const status = response.status();
    if (status === 404 || status >= 500) {
      networkIssues.push(`${status} ${url}`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? "request failed";

    if (failure === "net::ERR_ABORTED") return;
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

test.describe("Maison Elyse public QR menu", () => {
  test("mobile scan journey starts with welcome, sections and premium filters", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse?table=12&zone=terrasse", {
        waitUntil: "domcontentloaded"
      })
    );

    await expect(
      page.getByRole("heading", { level: 1, name: /Bienvenue chez Maison/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /D.couvrir la carte/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Voir les sections" })).toHaveCount(0);
    await expect(page.getByText(/Table 12/)).toHaveCount(0);
    await expect(page.getByText(/Zone terrasse/)).toHaveCount(0);
    await expect(page.getByText("Choisir une section")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /La carte Maison/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Entr/i })).toBeVisible();
    const signatureCategoryCard = page.getByTestId("maison-section-plats-signatures");
    await expect(signatureCategoryCard).toBeVisible();
    await expect(page.getByRole("button", { name: /Desserts/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sans gluten" })).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);

    await page.waitForLoadState("load");
    await signatureCategoryCard.click();

    await expect(
      page.getByRole("heading", { level: 1, name: /Bienvenue chez Maison/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Plats signatures" }).first()
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Entrées" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Desserts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cocktails" })).toBeVisible();
    await expect
      .poll(
        () =>
          page.locator("#section-plats-signatures").evaluate((section) => {
            const top = Math.round(section.getBoundingClientRect().top);

            return top >= -2 && top <= 140;
          }),
        { timeout: 5000 }
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { exact: true, name: "La carte" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtrer" })).toBeVisible();
    await expect(
      page.getByRole("button", { exact: true, name: "Signature" })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "3D / AR" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Disponibles" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retour aux sections" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Pr.f.rences/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sans gluten" })).toHaveCount(0);
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page.getByRole("dialog", { name: "Filtrer la carte" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Filtrer la carte" })).toBeVisible();
    await expect(
      page.getByRole("button", { exact: true, name: "Signature" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sans gluten" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sans .ufs/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sans poisson" })).toBeVisible();
    await page.getByRole("button", { name: "3D / AR" }).click();
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page.getByText("Filtre actif : 3D / AR")).toBeVisible();
    await expect(page.getByRole("link", { name: /Homard bleu/i })).toBeVisible();

    await page.getByRole("button", { exact: true, name: "La carte" }).click();
    await expect(page.getByRole("dialog", { name: "La carte" })).toBeVisible();
    await page.getByRole("button", { name: /Toute la carte/i }).click();
    await expect(page.getByText("LA COLLECTION")).toBeVisible();
    await expect(page.getByRole("heading", { name: "LA CARTE" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Entrées" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plats signatures" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Desserts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cocktails" })).toBeVisible();
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);
    health.expectClean();
  });

  test("/demo mobile renders the same Maison Elyse menu surface", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 }
    ]) {
      await test.step(`${viewport.width}px`, async () => {
        await page.setViewportSize(viewport);
        await expectHealthyResponse(
          await page.goto("/demo", { waitUntil: "domcontentloaded" })
        );

        const mobileMenu = page.getByTestId("demo-mobile-menu");
        await expect(mobileMenu).toBeVisible();
        await expect(page.getByTestId("demo-phone-mockup")).toBeHidden();
        await expect(page.getByTestId("demo-phone-viewport")).toBeHidden();
        await expect(
          mobileMenu.getByRole("heading", {
            level: 1,
            name: /Bienvenue chez Maison/i
          })
        ).toBeVisible();
        await expect(mobileMenu.getByRole("button", { name: /Entr/i })).toBeVisible();
        await expect(
          mobileMenu.getByRole("button", { name: "Voir toute la carte" })
        ).toBeVisible();
        await expect(page.locator("model-viewer")).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
      });
    }

    expect(modelRequests).toEqual([]);
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
    await expect(page.getByText("$104")).toBeVisible();
    await expect(page.getByText("PLATS SIGNATURES")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ingr.dients/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Allerg.nes/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Note du chef" })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Navigation fiche plat" })
        .getByText("Maison Élyse")
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
    await expect
      .poll(() => page.locator("model-viewer").count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "Afficher devant moi" })).toBeVisible();
    await expect(page.locator('a[rel="ar"][href$=".usdz"]')).toBeVisible();
    await expect
      .poll(() => modelRequests.some((url) => new URL(url).pathname.endsWith(".glb")), {
        timeout: 15_000
      })
      .toBe(true);
    health.expectClean();
  });

  test("mixed-case Maison Elyse slug and demo route remain healthy", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expectHealthyResponse(
      await page.goto("/menu/maison-Elyse", { waitUntil: "domcontentloaded" })
    );
    await expect(
      page.getByRole("heading", { level: 1, name: /Bienvenue chez Maison/i })
    ).toBeVisible();
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);

    await expectHealthyResponse(
      await page.goto("/demo", { waitUntil: "domcontentloaded" })
    );
    await expect(page.getByTestId("demo-phone-mockup")).toBeVisible();
    await expect(page.getByTestId("demo-phone-viewport")).toBeVisible();
    const phoneViewport = page.getByTestId("demo-phone-viewport");
    await expect(
      phoneViewport.getByRole("heading", {
        level: 1,
        name: /Bienvenue chez Maison/i
      })
    ).toBeVisible();
    await expect(phoneViewport.getByText("LA COLLECTION")).toHaveCount(0);
    await expect(phoneViewport.getByRole("heading", { name: "LA CARTE" })).toHaveCount(0);
    await phoneViewport.getByRole("button", { name: "Voir toute la carte" }).click();
    await expect(phoneViewport.getByText("LA COLLECTION")).toBeVisible();
    await expect(phoneViewport.getByRole("heading", { name: "LA CARTE" })).toBeVisible();
    await phoneViewport.getByRole("button", { name: /Ravioles/i }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(
      phoneViewport.getByRole("heading", { level: 1, name: /Ravioles/i })
    ).toBeVisible();
    await expect(phoneViewport.getByRole("button", { name: /Retour . la carte/i })).toBeVisible();
    await phoneViewport.getByRole("button", { name: /Retour . la carte/i }).click();
    await expect(phoneViewport.getByText("LA COLLECTION")).toBeVisible();
    await expect(page.getByText(/D.mo interactive Vistaire/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Aper.u t.l.phone/i })).toHaveCount(0);
    await expect(page.locator('a[class*="dishRow"]')).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await expectHealthyResponse(
      await page.goto("/demo", { waitUntil: "domcontentloaded" })
    );
    const targetedPhoneViewport = page.getByTestId("demo-phone-viewport");
    await targetedPhoneViewport.getByRole("button", { name: /Desserts/i }).click();
    await expect(targetedPhoneViewport.getByText("LA COLLECTION")).toBeVisible();
    const dessertHeading = targetedPhoneViewport.getByRole("heading", {
      name: /^Desserts$/
    });
    await expect(dessertHeading).toBeVisible();
    const phoneMenuScrollArea = targetedPhoneViewport
      .locator('[class*="menuScrollArea"]')
      .first();
    await expect
      .poll(
        async () => {
          const [dessertBox, scrollAreaBox] = await Promise.all([
            dessertHeading.boundingBox(),
            phoneMenuScrollArea.boundingBox()
          ]);

          if (!dessertBox || !scrollAreaBox) return false;

          const scrollAreaTop = scrollAreaBox.y;
          const scrollAreaBottom = scrollAreaBox.y + scrollAreaBox.height;

          return (
            dessertBox.y >= scrollAreaTop - 1 &&
            dessertBox.y < scrollAreaBottom - 24
          );
        },
        { message: "selected section should remain in the phone viewport" }
      )
      .toBe(true);
    await expectNoHorizontalOverflow(page);
    health.expectClean();
  });
});
