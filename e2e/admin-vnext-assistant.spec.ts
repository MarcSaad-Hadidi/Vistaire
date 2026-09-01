import { expect, type Page, test } from "@playwright/test";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

test.beforeAll(() => {
  expect(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE).toBe("1");
});

async function enterLocalPreview(page: Page) {
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
  }
  await page.goto("/admin/insights", { waitUntil: "networkidle" });
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && !LOOPBACK.has(url.hostname)) {
      await route.abort("blockedbyclient");
      throw new Error("Intelligence E2E blocked a non-loopback HTTP request");
    }
    await route.continue();
  });
  await page.routeWebSocket("**/*", async (socket) => {
    const url = new URL(socket.url());
    if (!LOOPBACK.has(url.hostname)) {
      await socket.close({ code: 1008, reason: "Non-loopback connection blocked" });
      throw new Error("Intelligence E2E blocked a non-loopback WebSocket");
    }
    socket.connectToServer();
  });
});

test("Intelligence is honest and responsive at reference and mobile widths", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  for (const viewport of [{ width: 1448, height: 1086 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await enterLocalPreview(page);
    await expect(page.getByRole("heading", { name: /Intelligence menu/ })).toBeVisible();
    await expect(page.getByText("L’essentiel Vistaire")).toBeVisible();
    await expect(page.getByText("Funnel non mesuré")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  expect(runtimeErrors).toEqual([]);
});

test("assistant drawer traps focus, closes with Escape and restores the trigger", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterLocalPreview(page);
  const trigger = page.getByRole("button", { name: "Poser une question" });
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Lire les signaux du menu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Votre question")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Fermer l’assistant" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
