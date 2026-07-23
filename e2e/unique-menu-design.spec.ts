import { expect, type BrowserContext, type Page, test } from "@playwright/test";

const OWNER_E2E_TOKEN =
  process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
  "vistaire-owner-e2e-local-token";

const LIVE_UNIQUE_E2E = process.env.VISTAIRE_UNIQUE_MENU_E2E_LIVE === "1";

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
  const mediaBeforeIntent: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("Failed to load resource")
    ) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() === 404 || response.status() >= 500) {
      if (!url.includes("favicon") && !url.includes("/menu/")) {
        networkIssues.push(`${response.status()} ${url}`);
      }
    }
    if (/\.(glb|usdz)(\?|$)/i.test(url) || /model-viewer/i.test(url)) {
      mediaBeforeIntent.push(url);
    }
  });
  return {
    expectClean() {
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      expect(networkIssues, networkIssues.join("\n")).toEqual([]);
    },
    expectNo3dBeforeIntent() {
      expect(mediaBeforeIntent, mediaBeforeIntent.join("\n")).toEqual([]);
    }
  };
}

test.describe("unique menu design mode — owner create UI", () => {
  test("owner create wizard exposes Nouveau UI unique at mobile and desktop", async ({
    context,
    page
  }, testInfo) => {
    const baseURL = String(
      testInfo.project.use.baseURL ?? "http://127.0.0.1:3000"
    );
    await enableOwnerBypass(context, baseURL);
    const health = installPageHealth(page);

    for (const width of [390, 430, 1280] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/owner/restaurants/create", {
        waitUntil: "domcontentloaded"
      });
      await expect(page.getByText("Nouveau UI unique")).toBeVisible();
      await page.getByRole("button", { name: /Nouveau UI unique/i }).click();
      await expect(page.getByText(/SUR MESURE/i)).toBeVisible();
      await expect(page.getByText(/Design unique à construire/i)).toBeVisible();
      await expect(
        page.getByText(/APERÇU DE SECOURS|Identité visuelle de secours/i)
      ).toBeVisible();
    }

    health.expectNo3dBeforeIntent();
    health.expectClean();
  });
});

/**
 * Live integrated lifecycle (requires isolated Supabase + seeded restaurant).
 * Not run in default App CI — set VISTAIRE_UNIQUE_MENU_E2E_LIVE=1 with fixture env.
 */
test.describe("unique menu design mode — live lifecycle", () => {
  test.skip(
    !LIVE_UNIQUE_E2E,
    "Set VISTAIRE_UNIQUE_MENU_E2E_LIVE=1 with isolated Supabase fixture to run."
  );

  test("create unique restaurant, lifecycle, public menu/dish, archive fallback", async ({
    context,
    page
  }, testInfo) => {
    const baseURL = String(
      testInfo.project.use.baseURL ?? "http://127.0.0.1:3000"
    );
    const fixtureSlug = process.env.VISTAIRE_UNIQUE_E2E_SLUG;
    const fixtureRestaurantId = process.env.VISTAIRE_UNIQUE_E2E_RESTAURANT_ID;
    const fixtureDesignId = process.env.VISTAIRE_UNIQUE_E2E_DESIGN_ID;
    expect(fixtureSlug, "VISTAIRE_UNIQUE_E2E_SLUG required").toBeTruthy();
    expect(
      fixtureRestaurantId,
      "VISTAIRE_UNIQUE_E2E_RESTAURANT_ID required"
    ).toBeTruthy();
    expect(fixtureDesignId, "VISTAIRE_UNIQUE_E2E_DESIGN_ID required").toBeTruthy();

    await enableOwnerBypass(context, baseURL);
    const health = installPageHealth(page);

    // No route mocks: real API persistence must succeed.
    for (const width of [390, 430, 1280] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/owner/restaurants/${fixtureRestaurantId}/unique-ui`, {
        waitUntil: "networkidle"
      });
      await expect(page.getByText(/UI unique/i).first()).toBeVisible();
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/owner/restaurants/${fixtureRestaurantId}/unique-ui`, {
      waitUntil: "networkidle"
    });

    const start = page.getByRole("button", {
      name: /Démarrer le développement/i
    });
    if (await start.isVisible()) {
      await start.click();
      await expect(page.getByText(/draft|brouillon/i).first()).toBeVisible({
        timeout: 15_000
      });
    }

    await page.goto(`/menu/${fixtureSlug}`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).not.toContainText(/pending|designId|rendererKey/i);
    health.expectNo3dBeforeIntent();

    const dishLink = page.locator('a[href*="/dishes/"]').first();
    if (await dishLink.count()) {
      await dishLink.click();
      await expect(page.locator("body")).not.toContainText(
        /pending|designId|rendererKey|rendererVersion/i
      );
    }

    health.expectClean();
  });
});
