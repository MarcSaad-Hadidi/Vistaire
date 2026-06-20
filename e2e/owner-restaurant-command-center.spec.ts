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

test("owner portfolio opens a dedicated restaurant dashboard and keeps mobile widths clean", async ({
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
  await expect(
    page.getByRole("heading", { name: "Quel restaurant ouvrir maintenant ?" })
  ).toBeVisible();
  await expect(page.getByText("Priorites owner")).toHaveCount(0);

  const firstRestaurantLink = page.getByRole("link", { name: /Ouvrir Maison/i }).first();
  await expect(firstRestaurantLink).toBeVisible();
  const dashboardHref = await firstRestaurantLink.getAttribute("href");
  expect(dashboardHref).toMatch(/^\/owner\/restaurants\/[^?]+$/);
  await page.goto(dashboardHref!, { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/owner\/restaurants\/[^/?#]+$/);
  await expect(page.getByRole("heading", { level: 2, name: /Maison/i })).toBeVisible();
  await expect(page.getByText(/Préparation \d+%/)).toBeVisible();
  const restaurantTabs = page.getByRole("tablist", { name: "Navigation restaurant" });
  for (const tab of [
    "Vue d’ensemble",
    "Menu",
    "Plats",
    "Médias",
    "QR",
    "3D / AR",
    "Paramètres"
  ]) {
    await expect(restaurantTabs.getByRole("tab", { name: tab, exact: true })).toBeVisible();
  }
  await restaurantTabs.getByRole("tab", { name: "QR", exact: true }).click();
  await expect(page.getByText("QR de table")).toBeVisible();
  const restaurantId = dashboardHref!.split("/").pop() ?? "";
  await page.goto(`/owner/medias?restaurantId=${encodeURIComponent(restaurantId)}`, {
    waitUntil: "domcontentloaded"
  });
  await expect(page.getByRole("heading", { level: 2, name: "Medias" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Photos/ }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(`${dashboardHref}/3d`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: /3D \/ AR/ })).toBeVisible();
  await expect(page.getByText("Plats du restaurant")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(dashboardHref!, { waitUntil: "domcontentloaded" });
  await restaurantTabs.getByRole("tab", { name: "Plats", exact: true }).click();
  await expect(page.getByText("Contrôle qualité des plats")).toBeVisible();

  await restaurantTabs.getByRole("tab", { name: /Param/ }).click();
  await expect(
    page.getByRole("button", { name: /Archiver le restaurant|Restaurer le restaurant/ })
  ).toBeVisible();
  await expect(page.getByText(/suppression definitive/i)).toBeVisible();

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 860 });
    await expect(
      page
        .getByRole("tablist", { name: "Navigation restaurant" })
        .getByRole("tab", { name: "QR", exact: true })
    ).toBeVisible();
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
  await expect(page.getByRole("link", { name: "Creer restaurant" }).first()).toBeVisible();
  await expect(page.getByText("Table dense avancee")).toBeVisible();
  await expect(page.getByRole("link", { name: /Ouvrir/i }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/owner/restaurants?restaurantId=11111111-1111-1111-1111-111111111111", {
    waitUntil: "networkidle"
  });
  await expect(page).toHaveURL(/\/owner\/restaurants\/11111111-1111-1111-1111-111111111111$/);
  await expect(page.getByRole("tab", { name: "Vue d’ensemble" })).toBeVisible();

  await page.goto("/owner/restaurants/create", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 2, name: "Creer restaurant" })).toBeVisible();
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

test("owner regression routes keep 3D/AR light and missing restaurants clean", async ({
  context,
  page
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);
  const health = installPageHealth(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/owner/3d-ar", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: "3D / AR" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/owner/3d-ar", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 2, name: "3D / AR" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  health.expectClean();

  const missingResponse = await page.goto("/owner/restaurants/not-a-real-restaurant", {
    waitUntil: "domcontentloaded"
  });
  expect(missingResponse?.status()).toBe(404);
});
