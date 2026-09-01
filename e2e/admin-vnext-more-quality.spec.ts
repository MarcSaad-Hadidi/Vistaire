import { expect, type Page, test } from "@playwright/test";

const appOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").origin;
const fixtureOrigin = `http://127.0.0.1:${process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT ?? "3110"}`;

async function installLocalNetworkGuard(page: Page) {
  await page.route("**/*", async (route) => {
    const target = new URL(route.request().url());
    if (["http:", "https:"].includes(target.protocol) && target.origin !== appOrigin && target.origin !== fixtureOrigin) {
      await route.abort("blockedbyclient");
      throw new Error(`Quality blocked a non-local request to ${target.protocol}//blocked.invalid`);
    }
    await route.continue();
  });
  await page.routeWebSocket("**/*", async (webSocketRoute) => {
    const target = new URL(webSocketRoute.url());
    const targetOrigin = target.origin.replace(/^ws/, "http");
    if (targetOrigin !== appOrigin) {
      await webSocketRoute.close({ code: 1008, reason: "Non-local connection blocked" });
      throw new Error(`Quality blocked a non-local WebSocket to ${target.protocol}//blocked.invalid`);
    }
    webSocketRoute.connectToServer();
  });
}

async function enterQuality(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: /prévisualisation locale/i });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
  }
  await page.goto("/admin/more", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Centre de qualité Vistaire", exact: true })).toBeVisible();
}

async function openDisplayPreferences(page: Page) {
  const summaries = page.locator('summary[aria-label="Préférences d’affichage"], summary[aria-label="Display preferences"]');
  for (let index = 0; index < await summaries.count(); index += 1) {
    if (await summaries.nth(index).isVisible()) {
      await summaries.nth(index).click();
      return;
    }
  }
  throw new Error("Visible display preferences disclosure not found.");
}

test.beforeEach(async ({ page }) => {
  await installLocalNetworkGuard(page);
});
test("quality center presents catalog evidence without inventing operational outcomes", async ({ page }) => {
  const consoleErrors: string[] = [];
  const serverFailures: string[] = [];
  const heavyAssets: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) serverFailures.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  page.on("request", (request) => { if (/\.(?:glb|usdz|mp4)(?:\?|$)/i.test(request.url())) heavyAssets.push(request.url()); });

  await enterQuality(page);
  await expect(page.getByText("Assets et contenus", { exact: true })).toBeVisible();
  await expect(page.getByText("Mesures d’expérience", { exact: true })).toBeVisible();
  await expect(page.getByText("Non mesuré", { exact: true })).toHaveCount(4);
  await expect(page.getByText("Source non connectée", { exact: true })).toHaveCount(4);
  await expect(page.getByText(/scans? en temps réel|taux de succès|7j\/7|SLA/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Contacter Vistaire" })).toHaveAttribute("href", /^mailto:contact@vistaire\.ca\?subject=/);
  expect(consoleErrors).toEqual([]);
  expect(serverFailures).toEqual([]);
  expect(heavyAssets).toEqual([]);
});

test("quality center stays accessible in both locales, themes and target viewports", async ({ page }) => {
  await enterQuality(page);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1448, height: 1086 }
  ]) {
    await page.setViewportSize(viewport);
    const html = page.locator("html");
    expect(await html.evaluate((node) => node.scrollWidth)).toBe(await html.evaluate((node) => node.clientWidth));
    await expect(page.getByRole("heading", { name: "Centre de qualité Vistaire", exact: true })).toBeVisible();
  }

  const support = page.getByRole("link", { name: "Contacter Vistaire" });
  await support.focus();
  await expect(support).toBeFocused();
  await openDisplayPreferences(page);
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Vistaire quality center", exact: true })).toBeVisible();
  await expect(page.getByText("Not measured", { exact: true })).toHaveCount(4);
  await openDisplayPreferences(page);
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator('[data-admin-theme="dark"]')).toBeVisible();
});
