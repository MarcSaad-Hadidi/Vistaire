import { expect, type Page, test } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;

type PageHealth = {
  expectClean: () => void;
  networkIssues: string[];
  consoleErrors: string[];
};

function shouldTrackPageUrl(page: Page, url: string) {
  if (url.startsWith("data:") || url.startsWith("blob:")) return false;

  try {
    const target = new URL(url);
    const currentUrl = page.url();
    if (!currentUrl.startsWith("http")) return true;

    return target.origin === new URL(currentUrl).origin;
  } catch {
    return true;
  }
}

function installPageHealth(page: Page): PageHealth {
  const networkIssues: string[] = [];
  const consoleErrors: string[] = [];

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
    if (!shouldTrackPageUrl(page, url)) return;

    const status = response.status();
    if (status === 404 || status >= 500) {
      networkIssues.push(`${status} ${url}`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? "request failed";

    if (failure === "net::ERR_ABORTED") return;
    if (!shouldTrackPageUrl(page, url)) return;
    networkIssues.push(`${failure} ${url}`);
  });

  return {
    consoleErrors,
    networkIssues,
    expectClean() {
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      expect(networkIssues, networkIssues.join("\n")).toEqual([]);
    }
  };
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

async function expectHealthyResponse(response: { status: () => number } | null) {
  expect(response, "route should return a response").not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("Maison Elyse public QR menu", () => {
  test("mobile scan journey starts with welcome, sections and premium filters", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse?table=12&zone=terrasse", {
        waitUntil: "domcontentloaded"
      })
    );

    await expect(
      page.getByRole("heading", { level: 1, name: /Bienvenue chez Maison/i })
    ).toBeVisible();
    await expect(page.getByText(/Table 12/)).toBeVisible();
    await expect(page.getByText(/Zone terrasse/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Entr/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Plats signatures/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Desserts/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sans gluten" })).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /Plats signatures/i }).click();

    await expect(
      page.getByRole("heading", { name: "Plats signatures" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Tous" })).toBeVisible();
    await expect(page.getByRole("button", { name: "3D / AR" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sans gluten" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Homard bleu/i })).toBeVisible();
    expect(modelRequests).toEqual([]);
    health.expectClean();
  });

  test("public dish detail exposes 3D and AR only after user intent", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await page.setViewportSize({ width: 430, height: 932 });
    await expectHealthyResponse(
      await page.goto("/menu/maison-elyse/dishes/homard-bisque", {
        waitUntil: "domcontentloaded"
      })
    );

    await expect(page.getByRole("heading", { level: 1, name: /Homard bleu/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Voir en 3D" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Afficher devant moi" })).toBeVisible();
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Afficher devant moi" }).click();
    await expect
      .poll(() => page.locator("model-viewer").count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(() => modelRequests.some((url) => new URL(url).pathname.endsWith(".glb")), {
        timeout: 15_000
      })
      .toBe(true);
    health.expectClean();
  });

  test("mixed-case Maison Elyse slug and demo route remain healthy", async ({
    page
  }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expectHealthyResponse(
      await page.goto("/menu/maison-Elyse", { waitUntil: "domcontentloaded" })
    );
    await expect(
      page.getByRole("heading", { level: 1, name: /Bienvenue chez Maison/i })
    ).toBeVisible();
    expect(modelRequests).toEqual([]);
    await expectNoHorizontalOverflow(page);

    await expectHealthyResponse(
      await page.goto("/demo", { waitUntil: "domcontentloaded" })
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("model-viewer")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    health.expectClean();
  });
});
