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

  test("shows the Android fallback in the 3D zone without leaving the dish", async ({
    page
  }) => {
    await simulateAndroidBrowser(page, FIREFOX_ANDROID_UA);
    await page.goto(
      "/menu/sauge-noire/dishes/truite-des-laurentides?lang=fr-CA&view=sauge-3",
      { waitUntil: "domcontentloaded" }
    );
    const detail = page.getByTestId("sauge-noire-dish-detail");
    await expect(detail).toBeVisible({ timeout: 20_000 });
    const viewerButton = detail.getByRole("button", { name: "VOIR EN 3D" });
    await expect(viewerButton).toBeVisible();
    await expect(async () => {
      await viewerButton.click();
      await expect(detail.getByRole("button", { name: "MASQUER LA 3D" })).toHaveAttribute(
        "aria-expanded",
        "true",
        { timeout: 1_000 }
      );
    }).toPass({ timeout: 20_000 });
    await expect(page.locator("model-viewer")).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('[data-ar-experience="handoff"]')).toBeVisible({
      timeout: 20_000
    });
    await expect(page.locator('[data-ar-recommended-browser="chrome"]')).toBeVisible();
    await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
  });
});
