import { expect, type Page, test } from "@playwright/test";

async function enterLocalPreview(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/admin$/);
    await page.waitForLoadState("networkidle");
  }
  await expect(page.getByRole("heading", { name: "Maison Élysée", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const isNetworkRequest = ["http:", "https:"].includes(requestUrl.protocol);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname);
    if (isNetworkRequest && !isLoopback) {
      await route.abort("blockedbyclient");
      throw new Error(`Admin Foundation blocked a non-loopback request to ${requestUrl.protocol}//blocked.invalid`);
    }
    await route.continue();
  });

  await page.routeWebSocket("**/*", async (webSocketRoute) => {
    const requestUrl = new URL(webSocketRoute.url());
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname);
    if (!isLoopback) {
      await webSocketRoute.close({ code: 1008, reason: "Non-loopback connection blocked" });
      throw new Error(`Admin Foundation blocked a non-loopback WebSocket to ${requestUrl.protocol}//blocked.invalid`);
    }
    webSocketRoute.connectToServer();
  });
});

test("five admin destinations remain visible without horizontal overflow", async ({ page }) => {
  await enterLocalPreview(page);

  const expected = [
    ["/admin", "Aujourd’hui"],
    ["/admin/availability", "Disponibilités"],
    ["/admin/insights", "Intelligence"],
    ["/admin/reports", "Rapports"],
    ["/admin/more", "Plus"]
  ] as const;

  for (const viewport of [
    { width: 1448, height: 1086, visible: "desktop" },
    { width: 390, height: 844, visible: "mobile" },
    { width: 430, height: 932, visible: "mobile" }
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/admin", { waitUntil: "networkidle" });
    const visibleNav = page.locator(`[data-admin-nav="${viewport.visible}"]`);
    await expect(visibleNav).toBeVisible();
    await expect(visibleNav.locator("a")).toHaveCount(5);
    for (const [href, label] of expected) {
      await expect(visibleNav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("preferences persist in SSR-scoped admin cookies", async ({ page }) => {
  await enterLocalPreview(page);
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator('[data-admin-locale="en"]')).toBeVisible();
  await page.getByRole("button", { name: "Dark" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('[data-admin-theme="dark"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary restaurant navigation" })).toBeVisible();
  const cookies = await page.context().cookies();
  for (const name of ["vistaire-admin-locale", "vistaire-admin-theme"]) {
    const cookie = cookies.find((candidate) => candidate.name === name);
    expect(cookie?.path).toBe("/admin");
    expect(cookie?.httpOnly).toBe(true);
  }
  const rootCookieHeader = await page.evaluate(async () => {
    const response = await fetch("/", { cache: "no-store" });
    return response.ok;
  });
  expect(rootCookieHeader).toBe(true);
});
