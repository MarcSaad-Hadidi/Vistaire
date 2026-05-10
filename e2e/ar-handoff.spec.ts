import { expect, test } from "@playwright/test";

const BRAVE_IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 Brave/1.67.0";

test.describe("AR browser handoff", () => {
  test.use({ userAgent: BRAVE_IOS_UA });

  test("Brave iOS is not sent directly to a USDZ download", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/demo/dishes/ravioles-romarin", {
      waitUntil: "networkidle"
    });

    const arLink = page.locator('a[rel="ar"][href$=".usdz"]', {
      hasText: "Voir devant moi"
    });
    await expect(arLink).toHaveCount(0);

    await page.getByRole("button", { name: "Voir devant moi" }).click();

    await expect(page.getByText(/ouvrez cette page dans Safari/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Copier le lien/i }).first()
    ).toBeVisible();
  });
});
