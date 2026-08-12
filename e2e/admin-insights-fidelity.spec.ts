import { expect, type Page, test } from "@playwright/test";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

async function enterLocalPreview(page: Page, route = "/admin/insights") {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
  }
  await page.goto(route, { waitUntil: "networkidle" });
}

test.beforeAll(() => {
  expect(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE).toBe("1");
});

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && !LOOPBACK.has(url.hostname)) {
      await route.abort("blockedbyclient");
      throw new Error(`Insights fidelity blocked a non-loopback request: ${url.origin}`);
    }
    await route.continue();
  });
  await page.routeWebSocket("**/*", async (socket) => {
    const url = new URL(socket.url());
    if (!LOOPBACK.has(url.hostname)) {
      await socket.close({ code: 1008, reason: "Non-loopback connection blocked" });
      throw new Error(`Insights fidelity blocked a non-loopback WebSocket: ${url.origin}`);
    }
    socket.connectToServer();
  });
});

test("desktop Intelligence preserves the reference hierarchy without unsupported metrics", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.setViewportSize({ width: 1448, height: 1086 });
  await enterLocalPreview(page);

  await expect(page.getByRole("heading", { name: /Intelligence menu/ })).toBeVisible();
  await expect(page.locator("article").filter({ has: page.getByText(/Observation|Comparaison|Catalogue/) })).toHaveCount(3);
  await expect(page.getByText("Carte d’attention Vistaire")).toBeVisible();
  await expect(page.getByText("Aucun classement de recherches k-anonyme n’est disponible dans ce bundle.")).toBeVisible();
  await expect(page.getByText("Funnel non mesuré")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/12\s?458|18[,.]6\s?%|9[,.]0\s?%/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test("range controls preserve the selected evidence window", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await enterLocalPreview(page, "/admin/insights?range=7d");
  await expect(page.getByRole("navigation", { name: "Période analysée" }).getByRole("link", { name: "7d" })).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
