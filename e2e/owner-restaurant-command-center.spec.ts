import { expect, type BrowserContext, type Page, test } from "@playwright/test";

const OWNER_E2E_TOKEN =
  process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
  "vistaire-owner-e2e-local-token";

async function enableOwnerBypass(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    {
      name: "__vistaire_owner_e2e",
      value: OWNER_E2E_TOKEN,
      url: baseURL
    }
  ]);
}

function installPageHealth(page: Page) {
  const consoleErrors: string[] = [];
  const networkIssues: string[] = [];
  const mediaRequests: string[] = [];

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
    const status = response.status();
    if (/\.(?:glb|usdz|mp4)(?:$|[?#])/i.test(url)) mediaRequests.push(url);
    if (status === 404 || status >= 500) networkIssues.push(`${status} ${url}`);
  });

  return {
    expectClean() {
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      expect(networkIssues, networkIssues.join("\n")).toEqual([]);
      expect(mediaRequests, mediaRequests.join("\n")).toEqual([]);
    }
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2
      )
    )
    .toBe(true);
}

test("owner portfolio opens restaurant overview and contextual routes stay clean", async ({
  context,
  page
}, testInfo) => {
  test.setTimeout(120_000);

  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);
  const health = installPageHealth(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/owner", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 2, name: "Restaurants" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Restaurants à ouvrir" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Leads" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "3D / AR" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "QR Codes" })).toHaveCount(0);

  const firstRestaurantLink = page.getByRole("link", { name: /Ouvrir Maison/i }).first();
  await expect(firstRestaurantLink).toBeVisible();
  const dashboardHref = await firstRestaurantLink.getAttribute("href");
  expect(dashboardHref).toMatch(/^\/owner\/restaurants\/[^?]+$/);

  await page.goto(dashboardHref!, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/owner\/restaurants\/[^/?#]+$/);
  await expect(page.getByRole("heading", { level: 2, name: /Maison/i })).toBeVisible();
  await expect(page.getByText(/Préparation \d+%/)).toBeVisible();
  await expect(page.getByText("Prochaine action")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checklist de préparation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Problèmes à corriger" })).toBeVisible();

  for (const moduleName of [
    "Carte & plats",
    "Médias",
    "Aperçu du menu",
    "QR & publication",
    "Paramètres"
  ]) {
    await expect(page.getByRole("heading", { name: moduleName })).toBeVisible();
  }

  await expect(
    page
      .getByRole("navigation", { name: "Navigation restaurant" })
      .getByRole("link", { name: /Médias/ })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "← Portefeuille" })).toBeVisible();

  await page.goto(`${dashboardHref}/menu`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: /Carte & plats/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plats", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(`${dashboardHref}/medias`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: /Médias/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Photos manquantes" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(`${dashboardHref}/preview`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: /Aperçu du menu/ })).toBeVisible();
  await expect(page.getByTitle(/Aperçu client/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(`${dashboardHref}/qr`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: /QR & publication/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "QR du restaurant" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(`${dashboardHref}/settings`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: /Paramètres/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Archiver le restaurant|Restaurer le restaurant/ })
  ).toBeVisible();
  await expect(page.getByText(/suppression définitive/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 860 });
    await page.goto(dashboardHref!, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 2, name: /Maison/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`${dashboardHref}/medias`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 2, name: /Médias/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/owner", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 2, name: "Restaurants" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  health.expectClean();
});

test("owner restaurants picker, legacy query redirect, and creation wizard profile validation work", async ({
  context,
  page
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);
  const health = installPageHealth(page);

  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto("/owner/restaurants", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 2, name: "Restaurants" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cr(é|e)er restaurant/ }).first()).toBeVisible();
  await expect(page.getByText(/Table dense avanc/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Ouvrir/i }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/owner/restaurants?restaurantId=11111111-1111-1111-1111-111111111111", {
    waitUntil: "networkidle"
  });
  await expect(page).toHaveURL(/\/owner\/restaurants\/11111111-1111-1111-1111-111111111111$/);
  await expect(page.getByRole("heading", { name: "Checklist de préparation" })).toBeVisible();

  await page.goto("/owner/restaurants/create", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 2, name: /Cr(é|e)er restaurant/ })).toBeVisible();
  await expect(page.getByText("1. Profil restaurant")).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Le nom restaurant est requis.")).toBeVisible();

  await page.getByLabel("Nom restaurant").fill("Le Jardin Test");
  await page.getByLabel("Email contact").fill("owner@example.com");
  await expect(page.getByLabel("Lien Google Reviews")).toBeVisible();
  await page
    .getByLabel("Lien Google Reviews")
    .fill("https://g.page/r/CYEXAMPLE/review");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("2. Structure menu")).toBeVisible();
  await expect(page.getByText("Langues du menu")).toBeVisible();
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page.getByText("Francais, English")).toBeVisible();
  await expect(page.getByText("Aucune section ajoutee.")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  health.expectClean();
});

test("owner regression routes keep legacy 3D/AR light and missing restaurants clean", async ({
  context,
  page
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);
  const health = installPageHealth(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/owner/3d-ar", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: /3D \/ AR/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/owner/3d-ar", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 2, name: /3D \/ AR/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  health.expectClean();

  const missingResponse = await page.goto("/owner/restaurants/not-a-real-restaurant", {
    waitUntil: "domcontentloaded"
  });
  expect(missingResponse?.status()).toBe(404);
});
