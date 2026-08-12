import { expect, type Page, type Request, test } from "@playwright/test";

const appOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").origin;
const fixtureOrigin = `http://127.0.0.1:${process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT ?? "3110"}`;

function installLoopbackGuard(page: Page) {
  const allowedOrigins = new Set([appOrigin, fixtureOrigin]);
  return page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if ((url.protocol === "http:" || url.protocol === "https:") && !allowedOrigins.has(url.origin)) {
      await route.abort("blockedbyclient");
      throw new Error(`Today blocked a non-fixture request to ${url.protocol}//blocked.invalid`);
    }
    await route.continue();
  });
}

function watchPageHealth(page: Page) {
  const consoleErrors: string[] = [];
  const badResponses: string[] = [];
  const heavyOrAssistant: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() === 404 || response.status() >= 500) badResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    if (/\.(?:glb|usdz)(?:\?|$)|\/admin\/api\/assistant/i.test(request.url())) heavyOrAssistant.push(request.url());
  });
  return () => {
    expect(consoleErrors).toEqual([]);
    expect(badResponses).toEqual([]);
    expect(heavyOrAssistant).toEqual([]);
  };
}

async function enterLocalPreview(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  await expect(preview).toBeVisible();
  await preview.click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: /Aujourd’hui — Centre de pilotage du service/ })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installLoopbackGuard(page);
  await page.routeWebSocket("**/*", async (route) => {
    const origin = new URL(route.url()).origin.replace(/^ws/, "http");
    if (origin !== appOrigin) {
      await route.close({ code: 1008, reason: "Only the local app WebSocket is allowed" });
      throw new Error("Today blocked a non-app WebSocket");
    }
    route.connectToServer();
  });
});

test("Today exposes honest evidence states across responsive FR/EN light/dark views", async ({ page }) => {
  const healthy = watchPageHealth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterLocalPreview(page);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 834, height: 1112 },
    { width: 1448, height: 1086 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('[data-today-region="pulse"] article')).toHaveCount(6);
    await expect(page.locator('[data-today-region="menu-health"] [data-evidence-id]')).toBeVisible();
    await expect(page.locator('[data-today-region="activity"] [data-evidence-kind="unmeasured"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Today — Service command centre/ })).toBeVisible();
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator('[data-admin-theme="dark"]')).toBeVisible();
  await expect(page.locator('[data-today-region="activity"] [role="status"]')).toContainText("not yet measured");
  healthy();
});

test("Today quick actions perform GET navigation only", async ({ page }) => {
  await enterLocalPreview(page);
  const unsafeRequests: Request[] = [];
  let watchActions = false;
  page.on("request", (request) => {
    if (watchActions && !["GET", "HEAD"].includes(request.method())) unsafeRequests.push(request);
  });

  const quickActions = page.locator('[data-today-region="quick-actions"] nav');
  await expect(quickActions.getByRole("link")).toHaveCount(4);
  await expect(quickActions.getByRole("link", { name: "Gérer les disponibilités" })).toHaveAttribute("href", "/admin/availability");
  await expect(quickActions.getByRole("link", { name: "Explorer l’intelligence menu" })).toHaveAttribute("href", "/admin/insights");
  await expect(quickActions.getByRole("link", { name: "Consulter les rapports" })).toHaveAttribute("href", "/admin/reports");
  await expect(quickActions.getByRole("link", { name: "Vérifier la qualité" })).toHaveAttribute("href", "/admin/more");

  watchActions = true;
  const availability = quickActions.getByRole("link", { name: "Gérer les disponibilités" });
  await availability.focus();
  await expect(availability).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/availability$/);
  expect(unsafeRequests.map((request) => `${request.method()} ${request.url()}`)).toEqual([]);
});
