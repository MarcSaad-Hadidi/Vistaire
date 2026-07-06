import { expect, type Page, test } from "@playwright/test";

const BRAVE_IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 Brave/1.67.0";
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;

async function simulateIosBrowser(page: Page, userAgent: string) {
  await page.addInitScript((ua) => {
    Object.defineProperty(navigator, "userAgent", { get: () => ua });
    Object.defineProperty(navigator, "platform", { get: () => "iPhone" });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  }, userAgent);
}

function collectModelAssetRequests(page: Page) {
  const requests: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;

    if (MODEL_ASSET_RE.test(pathname)) {
      requests.push(request.url());
    }
  });

  return requests;
}

async function expectNoEarlyImmersiveLoad(page: Page, requests: string[]) {
  await expect(page.getByRole("heading", { level: 1 }).last()).toBeVisible();
  await expect(page.locator("model-viewer")).toHaveCount(0);
  await expect(page.locator('a[rel="ar"][href$=".usdz"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Afficher devant moi" })).toHaveCount(0);
  expect(requests).toEqual([]);
}

async function openDemoDish(page: Page, dishName: RegExp) {
  await page.goto("/demo", {
    waitUntil: "domcontentloaded"
  });

  const phoneViewport = page.getByTestId("demo-phone-viewport");
  await phoneViewport.getByRole("button", { name: "Voir toute la carte" }).click();
  const dishButton = phoneViewport.getByRole("button", { name: dishName });
  await dishButton.scrollIntoViewIfNeeded();
  await expect(dishButton).toBeVisible();
  await dishButton.click();
  await expect(phoneViewport.getByRole("heading", { level: 1, name: dishName })).toBeVisible();
}

async function open3dViewer(page: Page) {
  const voir3d = page.getByRole("button", { name: "Voir en 3D" });

  await voir3d.scrollIntoViewIfNeeded();
  await expect(voir3d).toBeEnabled();
  await voir3d.click();
  await expect
    .poll(() => page.locator("model-viewer").count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
}

test.describe("AR browser handoff", () => {
  test("Brave iOS keeps source-only dishes in 3D without early Quick Look handoff", async ({
    page
  }) => {
    const requests = collectModelAssetRequests(page);

    await simulateIosBrowser(page, BRAVE_IOS_UA);
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemoDish(page, /Ravioles/i);

    await expectNoEarlyImmersiveLoad(page, requests);
    await expect(page.getByRole("button", { name: "Voir en 3D" })).toBeVisible();
    await expect(page.locator('a[rel="ar"][href$=".usdz"]')).toHaveCount(0);
    expect(requests.some((url) => new URL(url).pathname.endsWith(".usdz"))).toBe(
      false
    );
  });
});

test.describe("AR fallback resilience", () => {
  test("iOS Safari does not preload GLB or USDZ before explicit 3D intent", async ({
    page
  }) => {
    const requests = collectModelAssetRequests(page);

    await simulateIosBrowser(page, IOS_SAFARI_UA);
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemoDish(page, /Homard/i);

    await expectNoEarlyImmersiveLoad(page, requests);
    await open3dViewer(page);
    await expect
      .poll(() =>
        requests.some((url) => {
          const pathname = new URL(url).pathname;
          return pathname.endsWith(".glb") && pathname.includes("homard-bisque");
        })
      )
      .toBe(true);
  });

  test("failed GLB still keeps the dish page usable with a retry affordance", async ({
    page
  }) => {
    await simulateIosBrowser(page, IOS_SAFARI_UA);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/*.glb", (route) => route.abort());

    await openDemoDish(page, /Homard/i);

    const voir3d = page.getByRole("button", { name: "Voir en 3D" });
    await voir3d.scrollIntoViewIfNeeded();
    await expect(voir3d).toBeEnabled();
    await voir3d.click();

    await expect(page.getByText(/La vue 3D n.a pas pu/i)).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByRole("button", { name: /R.essayer/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).last()).toBeVisible();
  });
});
