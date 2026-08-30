import { expect, type Page, test } from "@playwright/test";

const appOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").origin;
const fixtureOrigin = `http://127.0.0.1:${process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT ?? "3110"}`;

function watchPageHealth(page: Page) {
  const runtimeErrors: string[] = [];
  const networkFailures: string[] = [];
  const heavyAssets: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "request failed";
    const url = new URL(request.url());
    const cancelledBySameOriginNavigation = failure === "net::ERR_ABORTED" && url.origin === appOrigin;
    if (!cancelledBySameOriginNavigation) networkFailures.push(`${failure} ${url.pathname}`);
  });
  page.on("response", (response) => {
    if (response.status() === 404 || response.status() >= 500) networkFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on("request", (request) => {
    if (/\.(?:glb|usdz|mp4)(?:\?|$)/i.test(request.url())) heavyAssets.push(request.url());
  });
  return () => {
    expect(runtimeErrors).toEqual([]);
    expect(networkFailures).toEqual([]);
    expect(heavyAssets).toEqual([]);
  };
}

async function enterLocalPreview(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
  }
  await page.goto("/admin/insights", { waitUntil: "networkidle" });
}

test.beforeAll(() => {
  expect(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE).toBe("1");
});

test.beforeEach(async ({ page }) => {
  const allowedOrigins = new Set([appOrigin, fixtureOrigin]);
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && !allowedOrigins.has(url.origin)) {
      await route.abort("blockedbyclient");
      throw new Error("Insights blocked a non-fixture HTTP request");
    }
    await route.continue();
  });
  await page.routeWebSocket("**/*", async (socket) => {
    const origin = new URL(socket.url()).origin.replace(/^ws/, "http");
    if (origin !== appOrigin) {
      await socket.close({ code: 1008, reason: "Non-loopback connection blocked" });
      throw new Error("Insights blocked a non-app WebSocket");
    }
    socket.connectToServer();
  });
});

test("Intelligence supports reduced motion, keyboard and responsive reading order", async ({ page }) => {
  const healthy = watchPageHealth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await enterLocalPreview(page);
    await expect(page.getByRole("heading", { name: /Intelligence menu/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ce que les preuves permettent d’affirmer" })).toBeVisible();
    await expect(page.getByText("Funnel non mesuré")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const control of await page.getByRole("navigation", { name: "Période analysée" }).getByRole("link").all()) {
      const box = await control.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  }

  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toHaveCount(1);
  healthy();
});
