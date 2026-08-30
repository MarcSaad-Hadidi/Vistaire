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

const MAISON_DISH_URL =
  "/menu/maison-elyse/dishes/homard-bisque?lang=fr-CA&table=12&zone=terrasse&view=carte";

async function expectNoEarlyImmersiveLoad(page: Page, requests: string[]) {
  await expect(page.getByRole("heading", { level: 1 }).last()).toBeVisible();
  await expect(page.locator("model-viewer")).toHaveCount(0);
  await expect(page.locator('a[rel="ar"][href$=".usdz"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Afficher devant moi" })).toHaveCount(0);
  expect(requests).toEqual([]);
}

async function openMaisonDishPage(page: Page) {
  await page.goto(MAISON_DISH_URL, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: /Homard bleu/i }).first()
  ).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("load");
}

async function open3dViewer(page: Page) {
  const voir3d = page.locator(
    'button[aria-controls="maison-elyse-dish-model-viewer"]'
  );

  await expect(voir3d).toBeVisible({ timeout: 20_000 });
  await voir3d.scrollIntoViewIfNeeded();
  await expect(voir3d).toBeEnabled();
  // Server-rendered Maison controls can receive the first click before React
  // hydration attaches the toggle. Retry only while the panel stays closed.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await voir3d.click();
    try {
      await expect(voir3d).toHaveAttribute("aria-expanded", "true", {
        timeout: 1_000
      });
      break;
    } catch {
      // Keep retrying until the last attempt.
    }
  }
  await expect(voir3d).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("model-viewer")).toHaveCount(1, { timeout: 20_000 });
}

test.describe("AR browser handoff", () => {
  test.describe.configure({ timeout: 90_000 });
  test("Brave iOS does not expose Quick Look or fetch USDZ before 3D intent", async ({
    page
  }) => {
    const requests = collectModelAssetRequests(page);

    await simulateIosBrowser(page, BRAVE_IOS_UA);
    await page.setViewportSize({ width: 390, height: 844 });
    await openMaisonDishPage(page);

    await expectNoEarlyImmersiveLoad(page, requests);
    const voir3d = page.getByRole("button", { exact: true, name: "Voir en 3D" });
    await expect(voir3d).toBeVisible({ timeout: 20_000 });
    await voir3d.scrollIntoViewIfNeeded();
    await expect(page.locator('a[rel="ar"][href$=".usdz"]')).toHaveCount(0);
    expect(requests.some((url) => new URL(url).pathname.endsWith(".usdz"))).toBe(
      false
    );
  });
});

test.describe("AR fallback resilience", () => {
  test.describe.configure({ timeout: 90_000 });
  test("iOS Safari does not preload GLB or USDZ before explicit 3D intent", async ({
    page
  }) => {
    const requests = collectModelAssetRequests(page);

    await simulateIosBrowser(page, IOS_SAFARI_UA);
    await page.setViewportSize({ width: 390, height: 844 });
    await openMaisonDishPage(page);

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

    await openMaisonDishPage(page);

    const voir3d = page.getByRole("button", { exact: true, name: "Voir en 3D" });
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

const FIREFOX_ANDROID_UA =
  "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0";
const CHROME_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const WEBVIEW_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36";
const INSTAGRAM_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 Instagram 312.0.0.0.0";
const BRAVE_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";

async function simulateAndroidBrowser(
  page: Page,
  userAgent: string,
  extras?: { brave?: boolean }
) {
  await page.addInitScript(
    ({ ua, brave }) => {
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
      if (brave) {
        Object.defineProperty(navigator, "brave", {
          configurable: true,
          value: {}
        });
      }
    },
    { ua: userAgent, brave: Boolean(extras?.brave) }
  );
}

async function dispatchSceneViewerFallback(page: Page) {
  await page.evaluate(() => {
    window.location.hash = "#model-viewer-no-ar-fallback";
  });
}

test.describe("Android AR diagnosis", () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ viewport: { width: 390, height: 844 } });

  test("Chrome Android shows the AR CTA without a Chrome handoff before any failure", async ({
    page
  }) => {
    const requests = collectModelAssetRequests(page);
    await simulateAndroidBrowser(page, CHROME_ANDROID_UA);
    await openMaisonDishPage(page);
    await expectNoEarlyImmersiveLoad(page, requests);
    await open3dViewer(page);
    await expect(page.getByRole("button", { name: "Afficher devant moi" })).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByText("Ouvrez cette fiche dans Chrome")).toHaveCount(0);
  });

  test("Chrome Android Scene Viewer fallback shows a device message, not Chrome handoff", async ({
    page
  }) => {
    await simulateAndroidBrowser(page, CHROME_ANDROID_UA);
    await openMaisonDishPage(page);
    await open3dViewer(page);
    await expect(page.locator("model-viewer")).toHaveCount(1, { timeout: 20_000 });
    await dispatchSceneViewerFallback(page);
    await expect(
      page.getByRole("heading", {
        name: "La réalité augmentée n'est pas disponible sur cet appareil"
      })
    ).toBeVisible();
    await expect(page.getByText("Ouvrez cette fiche dans Chrome")).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(1);
  });

  test("Firefox Android keeps 3D and shows Chrome handoff with a copyable dish URL", async ({
    page,
    context,
    baseURL
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(baseURL ?? "http://127.0.0.1:3000").origin
    });
    await simulateAndroidBrowser(page, FIREFOX_ANDROID_UA);
    await openMaisonDishPage(page);
    await open3dViewer(page);
    await expect(page.locator('[data-ar-recommended-browser="chrome"]')).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByRole("button", { name: "Afficher devant moi" })).toHaveCount(0);
    await expect(
      page.locator("#maison-elyse-dish-model-viewer [data-ar-experience]")
    ).toHaveCount(1);
    await page.getByRole("button", { name: /Copier le lien/i }).click();
    await expect(page.getByText(/Lien copié/i)).toBeVisible();
  });

  test("Android WebView shows Chrome handoff without fetching extra models just for the instruction", async ({
    page
  }) => {
    const requests = collectModelAssetRequests(page);
    await simulateAndroidBrowser(page, WEBVIEW_ANDROID_UA);
    await openMaisonDishPage(page);
    await expectNoEarlyImmersiveLoad(page, requests);
    await open3dViewer(page);
    await expect(page.locator('[data-ar-recommended-browser="chrome"]')).toBeVisible({
      timeout: 20_000
    });
    await expect(page.locator("model-viewer")).toHaveCount(1);
  });

  test("Brave Android and Instagram in-app browsers keep 3D and recommend Chrome", async ({
    page
  }) => {
    await simulateAndroidBrowser(page, BRAVE_ANDROID_UA, { brave: true });
    await openMaisonDishPage(page);
    await open3dViewer(page);
    await expect(page.locator('[data-ar-recommended-browser="chrome"]')).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByRole("button", { name: "Afficher devant moi" })).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(1);
  });

  test("Instagram Android in-app browser keeps 3D and recommends Chrome", async ({
    page
  }) => {
    await simulateAndroidBrowser(page, INSTAGRAM_ANDROID_UA);
    await openMaisonDishPage(page);
    await open3dViewer(page);
    await expect(page.locator('[data-ar-recommended-browser="chrome"]')).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByRole("button", { name: "Afficher devant moi" })).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(1);
  });

  test("Samsung Internet keeps 3D and recommends Chrome", async ({ page }) => {
    await simulateAndroidBrowser(
      page,
      "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36"
    );
    await openMaisonDishPage(page);
    await open3dViewer(page);
    await expect(page.locator('[data-ar-recommended-browser="chrome"]')).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByRole("button", { name: "Afficher devant moi" })).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(1);
  });

  test("Chrome Android activateAR rejection shows a device message, not Chrome handoff", async ({
    page
  }) => {
    await simulateAndroidBrowser(page, CHROME_ANDROID_UA);
    await openMaisonDishPage(page);
    await open3dViewer(page);
    const arButton = page.getByRole("button", { name: "Afficher devant moi" });
    await expect(arButton).toBeVisible({ timeout: 20_000 });
    await page.locator("model-viewer").evaluate((element) => {
      Object.assign(element, {
        activateAR: () => Promise.reject(new Error("scene-viewer-unavailable"))
      });
    });
    await arButton.click();
    await expect(
      page.getByRole("heading", {
        name: "La réalité augmentée n'est pas disponible sur cet appareil"
      })
    ).toBeVisible();
    await expect(page.getByText("Ouvrez cette fiche dans Chrome")).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(1);
  });
});

test.describe("Desktop 3D without AR CTA", () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ viewport: { width: 1280, height: 900 } });

  test("desktop 3D stays available without an AR CTA or Chrome handoff", async ({ page }) => {
    await openMaisonDishPage(page);
    await open3dViewer(page);
    await expect(page.locator("model-viewer")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Afficher devant moi" })).toHaveCount(0);
    await expect(page.getByText("Ouvrez cette fiche dans Chrome")).toHaveCount(0);
  });
});
