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
  test(`${path} ends at one immersive footer and retains localized public destinations`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFallback(page, path);
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveCount(1);
    await expect(footer).toHaveAttribute("id", "footer");
    await expect(page.locator(".public-footer-wrap")).toHaveCount(0);
    await expect(footer.getByRole("heading")).toBeInViewport();
    for (const href of links) await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
    const endGap = await footer.evaluate(el => document.documentElement.scrollHeight - el.getBoundingClientRect().bottom - scrollY);
    expect(Math.abs(endGap)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator(".menu-toggle").click();
    for (const href of links.slice(0, -1)) {
      await expect(page.locator(`.menu-page-links a[href="${href}"]`)).toBeVisible();
    }
  });
}

for (const viewport of [
  { width: 320, height: 740 },
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
    for (const theme of ["dark", "light"]) {
      if (theme === "light") {
        // A stored preference tests the visible guide; clicking the theme
        // control intentionally teaches/dismisses the initial guide.
        await page.evaluate(() => localStorage.setItem("vistaire-public-theme", "light"));
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(".world-fallback")).toBeVisible();
      }
      await expect(page.locator("html")).toHaveAttribute("data-vistaire-theme", theme);
      const guide = page.locator("[data-scroll-guide]");
      await expect(guide).toHaveCount(1);
      await expect(guide).toHaveAttribute("aria-hidden", "false");
      await page.evaluate(() => document.fonts.ready);
      const geometry = await guide.evaluate(el => {
        const guide = el.getBoundingClientRect();
        const overlaps = [...document.querySelectorAll(".site-header a, .site-header button, #hero a, #hero button")]
          .filter(control => {
            const box = control.getBoundingClientRect();
            return box.width > 0 && box.height > 0 &&
              box.left < guide.right && box.right > guide.left &&
              box.top < guide.bottom && box.bottom > guide.top;
          }).map(control => control.textContent?.trim());
        return {
          left: guide.left, right: guide.right, top: guide.top, bottom: guide.bottom,
          viewportWidth: innerWidth, viewportHeight: innerHeight, overlaps,
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
      expect(geometry.overlaps, `${theme} guide at ${viewport.width}px`).toEqual([]);
    }
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
