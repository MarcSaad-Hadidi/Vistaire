import { expect, type Page, test } from "@playwright/test";

const BRAVE_IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 Brave/1.67.0";
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

async function simulateIosBrowser(page: Page, userAgent: string) {
  await page.addInitScript((ua) => {
    Object.defineProperty(navigator, "userAgent", { get: () => ua });
    Object.defineProperty(navigator, "platform", { get: () => "iPhone" });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  }, userAgent);
}

async function open3dViewer(page: Page) {
  const voir3d = page.getByRole("button", { name: "Voir en 3D" });
  await voir3d.scrollIntoViewIfNeeded();
  await expect(voir3d).toBeEnabled();
  await expect
    .poll(
      async () => {
        await voir3d.evaluate((button) =>
          (button as HTMLButtonElement).click()
        );
        return page.locator("model-viewer").count();
      },
      { timeout: 15_000 }
    )
    .toBe(1);
}

test.describe("AR browser handoff", () => {
  test("Brave iOS keeps AR handoff inside the loaded 3D viewer", async ({ page }) => {
    await simulateIosBrowser(page, BRAVE_IOS_UA);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/demo/dishes/ravioles-romarin", {
      waitUntil: "domcontentloaded"
    });

    const arLink = page.locator('a[rel="ar"][href$=".usdz"]');
    await expect(arLink).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Afficher devant moi" })
    ).toHaveCount(0);

    await open3dViewer(page);

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

test.describe("AR fallback resilience", () => {
  test("iOS Safari exposes the AR button without gating it on AR warmup", async ({
    page
  }) => {
    await simulateIosBrowser(page, IOS_SAFARI_UA);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/demo/dishes/cocktail-maison-elyse", {
      waitUntil: "domcontentloaded"
    });
    await page.route(/\.usdz(?:$|\?)/, (route) => route.abort());

    await open3dViewer(page);

    const viewer = page.locator("model-viewer");
    await viewer.evaluate((element) => {
      Object.defineProperty(element, "loaded", {
        configurable: true,
        get: () => true
      });
      element.dispatchEvent(new Event("load"));
    });

    const arButton = page.locator('a[rel="ar"][href$=".usdz"]', {
      hasText: "Afficher devant moi"
    });
    await expect(arButton).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('model-viewer button[slot="ar-button"]', {
        hasText: "Afficher devant moi"
      })
    ).toHaveCount(0);
    await expect(
      page.getByText(/Pr.paration de l.affichage devant vous/i)
    ).toHaveCount(0);
    await expect(
      page.locator('link[data-vistaire-asset-warmup="ar"]')
    ).toHaveCount(0);

    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new PageTransitionEvent("pageshow"));
    });

    await expect(arButton).toBeVisible();
    await expect(arButton).toBeEnabled();
  });

  test("iOS Safari still offers Quick Look when the GLB fails", async ({
    page
  }) => {
    await simulateIosBrowser(page, IOS_SAFARI_UA);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/*.glb", (route) => route.abort());

    await page.goto("/demo/dishes/ravioles-romarin", {
      waitUntil: "domcontentloaded"
    });

    const voir3d = page.getByRole("button", { name: "Voir en 3D" });
    await voir3d.scrollIntoViewIfNeeded();
    await expect(voir3d).toBeEnabled();
    await expect
      .poll(
        async () => {
          await voir3d.evaluate((button) =>
            (button as HTMLButtonElement).click()
          );
          return page
            .getByText(/La vue 3D n.a pas pu être chargée/i)
            .count();
        },
        { timeout: 20_000 }
      )
      .toBe(1);

    await expect(
      page.getByText(/La vue 3D n.a pas pu être chargée/i)
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('a[rel="ar"][href$=".usdz"]', {
        hasText: "Afficher devant moi"
      })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
  });
});
