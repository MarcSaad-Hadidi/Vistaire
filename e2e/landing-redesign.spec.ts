import { expect, test, type Page } from "@playwright/test";

async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type.startsWith("webgl") ? null : Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
}

async function openFallback(page: Page, path = "/") {
  await disableWebGL(page);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".world-fallback")).toBeVisible();
  await expect(page.locator(".preloader")).toHaveCount(0);
}

for (const [path, links] of [
  ["/", ["/menu-digital-restaurant", "/menu-qr-code-restaurant", "/menu-3d-ar-restaurant", "/menu-pdf-vs-menu-digital", "/apercu-restaurateur", "/demo", "/contact", "/prendre-rendez-vous", "/guides/anatomie-menu-digital-premium"]],
  ["/en", ["/en/digital-restaurant-menu", "/en/qr-code-restaurant-menu", "/en/3d-ar-restaurant-menu", "/en/pdf-vs-digital-menu", "/en/restaurant-preview", "/en/vistaire-menu", "/en/contact", "/en/book-a-call", "/en/guides/premium-digital-menu-anatomy"]],
] as const) {
  test(`${path} shares the complete localized public footer in native document flow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFallback(page, path);
    const footer = page.locator(".public-footer-wrap");
    await footer.scrollIntoViewIfNeeded();
    for (const href of links) await expect(footer.locator(`a[href="${href}"]`).first()).toBeVisible();
    expect(await footer.evaluate((el) => el.getBoundingClientRect().top + scrollY)).toBeGreaterThan(await page.locator("#footer").evaluate((el) => el.getBoundingClientRect().top + scrollY));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

for (const viewport of [
  { width: 375, height: 812 }, { width: 390, height: 844 },
  { width: 430, height: 932 }, { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`immersive landing stays usable without WebGL at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openFallback(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("VISTAIRE");
    const film = page.locator(".fallback-film");
    await expect(film).toHaveAttribute("src", /\/immersive-media\/cinematic-(portrait|landscape)\.mp4/);
    await expect.poll(() => film.evaluate((el) => (el as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await expect(film).toHaveJSProperty("muted", true);
    await expect(film).toHaveJSProperty("loop", true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}

for (const path of ["/", "/en"]) {
  test(`${path} delivers initial headings and localized real routes without JavaScript`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/<h1\b[^>]*>VISTAIRE<\/h1>/);
    expect(html).toContain(path === "/en" ? '/en/book-a-call' : '/prendre-rendez-vous');
    expect(html).toContain(path === "/en" ? '/en/guides/premium-digital-menu-anatomy' : '/guides/anatomie-menu-digital-premium');
  });
}

test("a Next navigation releases the immersive viewport and queued scroll work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await openFallback(page);
  await page.locator(".menu-toggle").click();
  await expect(page.locator(".menu-toggle")).toHaveAttribute("aria-expanded", "true");
  await page.locator('.menu-page-links a[href="/a-propos"]').click();
  await expect(page).toHaveURL(/\/a-propos$/);
  await expect(page.locator("[data-public-vistaire]")).toBeVisible();
  await expect(page.locator("[data-immersive-vistaire]")).toHaveCount(0);
  const state = await page.evaluate(() => ({
    stage: document.documentElement.style.getPropertyValue("--vistaire-journey-vh"),
    scene: document.documentElement.style.getPropertyValue("--vistaire-scene-vh"),
    compact: document.documentElement.classList.contains("journey-compact"),
    bodyLocked: document.body.style.overflow === "hidden",
  }));
  expect(state).toEqual({ stage: "", scene: "", compact: false, bodyLocked: false });
  expect(errors).toEqual([]);
});

test("collections support keyboard selection and accessible stand rotation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFallback(page, "/#product");
  const tabs = page.getByRole("tablist", { name: "Collections de supports" });
  await tabs.getByRole("tab", { selected: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { selected: true })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", await tabs.getByRole("tab", { selected: true }).getAttribute("id") ?? "");
  const stand = page.locator(".support-gesture");
  await stand.focus();
  await page.keyboard.press("ArrowRight");
  await expect(stand).toHaveAttribute("aria-valuenow", "15");
});
