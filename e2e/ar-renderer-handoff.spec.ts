import { expect, type Page, test } from "@playwright/test";

const FIREFOX_ANDROID_UA =
  "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0";

async function simulateAndroidBrowser(page: Page, userAgent: string) {
  await page.addInitScript((ua) => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => ua
    });
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      get: () => "Linux armv8l"
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      get: () => 5
    });
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      value: {
        platform: "Android",
        brands: [
          { brand: "Not A Brand", version: "99" },
          { brand: "Chromium", version: "125" }
        ]
      }
    });
  }, userAgent);
}

test.describe("Sauge Noire Android AR fallback", () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows a themed copy-only fallback below 3D without leaving the dish", async ({
    page,
    context,
    baseURL
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(baseURL ?? "http://127.0.0.1:3000").origin
    });
    await simulateAndroidBrowser(page, FIREFOX_ANDROID_UA);
    await page.goto(
      "/menu/sauge-noire/dishes/truite-des-laurentides?lang=fr-CA&view=sauge-3",
      { waitUntil: "domcontentloaded" }
    );
    const detail = page.getByTestId("sauge-noire-dish-detail");
    await expect(detail).toBeVisible({ timeout: 20_000 });
    const viewerButton = detail.getByRole("button", { name: "VOIR EN 3D" });
    await expect(viewerButton).toBeVisible();
    await viewerButton.click();
    await expect(detail.getByRole("button", { name: "MASQUER LA 3D" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    const viewer = page.locator("model-viewer");
    const fallback = page.locator('[data-ar-fallback-variant="sauge-noire"]');
    await expect(viewer).toHaveCount(1, { timeout: 20_000 });
    await expect(fallback).toBeVisible({ timeout: 20_000 });
    await expect(fallback).toHaveAttribute("data-ar-experience", "handoff");
    await expect(fallback).toHaveAttribute("data-ar-recommended-browser", "chrome");

    const viewerBounds = await viewer.boundingBox();
    const fallbackBounds = await fallback.boundingBox();
    expect(viewerBounds).not.toBeNull();
    expect(fallbackBounds).not.toBeNull();
    expect(fallbackBounds!.y).toBeGreaterThanOrEqual(
      viewerBounds!.y + viewerBounds!.height
    );

    await expect(fallback.getByRole("button", { name: /Partager/i })).toHaveCount(0);
    const copyButton = fallback.getByRole("button", { name: /Copier le lien/i });
    await expect(copyButton).toBeVisible();
    await expect(copyButton).toHaveCSS("background-color", "rgb(38, 55, 43)");
    await expect(copyButton).toHaveCSS("color", "rgb(250, 244, 233)");
    await copyButton.click();
    await expect(fallback.getByText(/Lien copié/i)).toBeVisible();

    await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
  });
});
