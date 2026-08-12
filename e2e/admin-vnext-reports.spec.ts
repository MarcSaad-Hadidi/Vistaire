import { expect, type Page, test } from "@playwright/test";

const appOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").origin;
const fixtureOrigin = `http://127.0.0.1:${process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT ?? "3110"}`;

async function installLocalNetworkGuard(page: Page) {
  await page.route("**/*", async (route) => {
    const target = new URL(route.request().url());
    if (["http:", "https:"].includes(target.protocol) && target.origin !== appOrigin && target.origin !== fixtureOrigin) {
      await route.abort("blockedbyclient");
      throw new Error(`Reports blocked a non-local request to ${target.protocol}//blocked.invalid`);
    }
    await route.continue();
  });
  await page.routeWebSocket("**/*", async (webSocketRoute) => {
    const target = new URL(webSocketRoute.url());
    if (target.origin !== appOrigin) {
      await webSocketRoute.close({ code: 1008, reason: "Non-local connection blocked" });
      throw new Error(`Reports blocked a non-local WebSocket to ${target.protocol}//blocked.invalid`);
    }
    webSocketRoute.connectToServer();
  });
}

async function enterReports(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prÃ©visualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
  }
  await page.goto("/admin/reports", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Bilan du service", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installLocalNetworkGuard(page);
});

test("private report filters, evidence states and CSV export stay server backed", async ({ page }) => {
  const consoleErrors: string[] = [];
  const serverFailures: string[] = [];
  const heavyAssets: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) serverFailures.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  page.on("request", (request) => { if (/\.(?:glb|usdz|mp4)(?:\?|$)/i.test(request.url())) heavyAssets.push(request.url()); });

  await enterReports(page);
  await expect(page.getByRole("navigation", { name: "Filtres du rapport" })).toBeVisible();
  await page.getByRole("link", { name: "DÃ®ner", exact: true }).click();
  await expect(page).toHaveURL(/service=dinner/);
  await expect(page.getByText(/dÃ©coupage fiable par service/i).first()).toBeVisible();
  await page.getByRole("link", { name: "30 jours", exact: true }).click();
  await expect(page).toHaveURL(/range=30d/);

  const exportResponse = await page.request.get("/admin/api/reports/export?range=30d&service=dinner");
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["cache-control"]).toBe("private, no-store");
  expect(exportResponse.headers()["vary"]).toBe("Cookie");
  expect(exportResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(exportResponse.headers()["content-disposition"]).toMatch(/^attachment; filename="bilan-vistaire-\d{4}-\d{2}-\d{2}\.csv"$/);
  const bytes = await exportResponse.body();
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(new TextDecoder().decode(bytes)).toContain("Indicateur");

  expect(consoleErrors).toEqual([]);
  expect(serverFailures).toEqual([]);
  expect(heavyAssets).toEqual([]);
});

test("reports remain accessible in both locales, themes, print and target viewports", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "print", { configurable: true, value: () => { (window as typeof window & { __reportPrints?: number }).__reportPrints = ((window as typeof window & { __reportPrints?: number }).__reportPrints ?? 0) + 1; } });
  });
  await enterReports(page);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1448, height: 1086 }
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((node) => node.clientWidth));
    await expect(page.getByRole("heading", { name: "Bilan du service", exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "Imprimer le rapport" }).focus();
  await expect(page.getByRole("button", { name: "Imprimer le rapport" })).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as typeof window & { __reportPrints?: number }).__reportPrints)).toBe(1);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation", { name: "Filtres du rapport" })).toBeHidden();
  await expect(page.getByText("Preuves et fiabilitÃ©", { exact: true })).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Service report", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator('[data-admin-theme="dark"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", /\/admin\/api\/reports\/export\?range=/);
});

