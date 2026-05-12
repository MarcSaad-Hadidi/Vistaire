import { expect, test } from "@playwright/test";

const BRAVE_IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 Brave/1.67.0";
const REMOVED_TOP_LEVEL_AR_LABEL = ["Voir", "devant", "moi"].join(" ");

test.describe("AR browser handoff", () => {
  test.use({ userAgent: BRAVE_IOS_UA });

  test("Brave iOS keeps AR handoff inside the loaded 3D viewer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/demo/dishes/ravioles-romarin", {
      waitUntil: "domcontentloaded"
    });

    const arLink = page.locator('a[rel="ar"][href$=".usdz"]');
    await expect(arLink).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: REMOVED_TOP_LEVEL_AR_LABEL })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Afficher devant moi" })
    ).toHaveCount(0);

    const voir3d = page.getByRole("button", { name: "Voir en 3D" });
    await voir3d.scrollIntoViewIfNeeded();
    await voir3d.click({ force: true });
    await expect(page.locator("model-viewer")).toHaveCount(1, {
      timeout: 15_000
    });

    await expect(
      page.getByText(/Réalité augmentée disponible dans Safari/i)
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/ouvrez cette fiche dans Safari sur iPhone/i).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Copier le lien/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Continuer en 3D/i }).first()
    ).toBeVisible();
    await expect(arLink).toHaveCount(0);
  });
});
