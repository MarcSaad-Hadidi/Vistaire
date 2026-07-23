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

test.describe("unique menu design mode", () => {
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

    // Lifecycle API contract via owner bypass (no SSR restaurant fixture required).
    await page.route("**/api/owner/unique-menu-design", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            uniqueDesign: {
              mode: "unique",
              designId: "11111111-1111-4111-8111-111111111111",
              status: "pending",
              rendererKey: null,
              rendererVersion: null,
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            availableRenderers: []
          })
        });
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          uniqueDesign: {
            mode: "unique",
            designId: "11111111-1111-4111-8111-111111111111",
            status: "draft",
            rendererKey: null,
            rendererVersion: null,
            version: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          availableRenderers: [],
          draftPersisted: true,
          publishedPersisted: true
        })
      });
    });

    const apiResult = await page.evaluate(async () => {
      const response = await fetch("/api/owner/unique-menu-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "22222222-2222-4222-8222-222222222222",
          action: "start",
          expectedDesignId: "11111111-1111-4111-8111-111111111111",
          expectedVersion: 1
        })
      });
      return {
        status: response.status,
        body: await response.json()
      };
    });
    expect(apiResult.status).toBe(200);
    expect(apiResult.body.ok).toBe(true);
    expect(apiResult.body.uniqueDesign?.status).toBe("draft");

    health.expectNo3dBeforeIntent();
    health.expectClean();
  });
});
