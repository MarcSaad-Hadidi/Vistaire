import { expect, test, type Page } from "@playwright/test";

const MENU_URL = "/menu/trouvable?lang=fr-CA&table=12&zone=terrasse&view=list";
const BACK_TO_TOP_LABEL = /Retour en haut|Back to top/i;
const MODEL_BUTTON_LABEL = /VOIR EN 3D|VIEW IN 3D/i;

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
}

async function scrollToMenuEnd(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" }));
}

async function openDishWithModel(page: Page) {
  const dishButtons = page.locator(
    "#trouvable-dish-results button[aria-haspopup='dialog']"
  );
  const count = await dishButtons.count();

  for (let index = 0; index < count; index += 1) {
    await dishButtons.nth(index).click();
    const dialog = page.locator(
      '[role="dialog"][aria-labelledby="trouvable-dish-title"]'
    );
    const modelButton = dialog.getByRole("button", { name: MODEL_BUTTON_LABEL });
    if (await modelButton.isVisible()) return { dialog, modelButton };
    await page.keyboard.press("Escape");
  }

  throw new Error("The public Trouvable fixture has no dish with a 3D model");
}

async function openTrouvableModel(
  page: Page,
  userAgent: string,
  platform: string,
  maxTouchPoints: number
) {
  await page.addInitScript(
    ({ userAgent: nextUserAgent, platform: nextPlatform, maxTouchPoints: nextTouchPoints }) => {
      Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => nextUserAgent });
      Object.defineProperty(navigator, "platform", { configurable: true, get: () => nextPlatform });
      Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => nextTouchPoints });
    },
    { userAgent, platform, maxTouchPoints }
  );
  await page.goto(MENU_URL, { waitUntil: "domcontentloaded" });
  const { dialog, modelButton } = await openDishWithModel(page);
  await modelButton.click();
  await expect(page.locator("model-viewer")).toHaveCount(1, { timeout: 20_000 });
  return dialog;
}

async function dispatchArStatusFailed(page: Page) {
  await page.evaluate(() => {
    const modelViewer = document.querySelector("model-viewer");
    if (!modelViewer) throw new Error("Expected model-viewer element");
    modelViewer.dispatchEvent(
      new CustomEvent("ar-status", {
        bubbles: true,
        detail: { status: "failed" }
      })
    );
  });
}

async function triggerArFallback(page: Page, userAgent: string, platform: string, maxTouchPoints: number) {
  const dialog = await openTrouvableModel(page, userAgent, platform, maxTouchPoints);
  await page.waitForTimeout(300);
  await dispatchArStatusFailed(page);
  return dialog;
}

test.describe("Trouvable Retour en haut", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 1280, height: 900 }
  ]) {
    test(`is visible only after leaving the page top at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(MENU_URL, { waitUntil: "domcontentloaded" });

      const button = page.getByRole("button", { name: BACK_TO_TOP_LABEL });
      await expect(button).toBeHidden();
      await scrollToMenuEnd(page);
      await expect(button).toBeVisible();

      const box = await button.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalOverflow(page);

      await button.click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
      await expect(button).toBeHidden();
      await expect.poll(() => page.evaluate(() => document.activeElement === document.querySelector("main"))).toBe(true);
    });
  }

  test("is hidden while a dish sheet is open and returns immediately with reduced motion", async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(MENU_URL, { waitUntil: "domcontentloaded" });
    await scrollToMenuEnd(page);

    const button = page.getByRole("button", { name: BACK_TO_TOP_LABEL });
    await expect(button).toBeVisible();
    await page.locator("#trouvable-dish-results button[aria-haspopup='dialog']").first().click();
    await expect(page.locator('[role="dialog"][aria-labelledby="trouvable-dish-title"]')).toBeVisible();
    await expect(button).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"][aria-labelledby="trouvable-dish-title"]')).toBeHidden();
  });
});

test.describe("Trouvable AR fallback copy handoff", () => {
  test.describe.configure({ timeout: 90_000 });
  test("uses Safari copy wording on iPhone in-app browsers and preserves the absolute dish URL", async ({
    page,
    context,
    baseURL
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(baseURL ?? "http://127.0.0.1:3000").origin
    });
    const dialog = await openTrouvableModel(
      page,
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1 Brave/1.67.0",
      "iPhone",
      5
    );

    await expect(dialog.getByRole("heading", { name: "Ouvrez cette fiche dans Safari" })).toBeVisible();
    await expect(dialog.getByText("Ouvrez cette fiche dans Chrome")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Copier le lien pour Safari" }).click();
    const copyStatus = dialog.locator('p[role="status"]');
    await expect(copyStatus).toHaveCount(1);
    await expect(copyStatus).toContainText("Lien copié");

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const copiedUrl = new URL(copied);
    expect(copiedUrl.origin).toBe(new URL(page.url()).origin);
    expect(copiedUrl.pathname).toMatch(/^\/menu\/trouvable\/dishes\/.+/);
    expect(copiedUrl.searchParams.get("lang")).toBe("fr-CA");
    expect(copiedUrl.searchParams.get("table")).toBe("12");
    expect(copiedUrl.searchParams.get("zone")).toBe("terrasse");
    expect(copiedUrl.searchParams.get("view")).toBe("list");
    await expect(dialog).toBeVisible();
  });

  test("uses Chrome wording on Android Firefox without telling the user to leave Chrome", async ({ page }) => {
    const dialog = await openTrouvableModel(
      page,
      "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
      "Linux armv8l",
      5
    );

    await expect(dialog.getByRole("heading", { name: "Ouvrez cette fiche dans Chrome" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Copier le lien pour Chrome" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Afficher devant moi" })).toHaveCount(0);
  });

  test("Chrome Android activation failure shows a device message instead of Chrome handoff", async ({
    page
  }) => {
    const dialog = await triggerArFallback(
      page,
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36",
      "Linux armv8l",
      5
    );

    await expect(
      dialog.getByRole("heading", {
        name: "La réalité augmentée n'est pas disponible sur cet appareil"
      })
    ).toBeVisible();
    await expect(dialog.getByText("Ouvrez cette fiche dans Chrome")).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(1);
  });
});
