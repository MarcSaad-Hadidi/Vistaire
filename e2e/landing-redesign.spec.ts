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

// Launch options are worker-scoped and cannot be set inside a describe group.
// Keep actual SwiftShader rendering local to these two regressions; this does
// not represent physical GPU or trackpad validation.
const renderedTest = test.extend({
  launchOptions: async ({ browserName }, provideOptions) => {
    await provideOptions(browserName === 'chromium'
      ? { args: ['--use-angle=swiftshader', '--use-gl=angle'] }
      : {});
  },
});

renderedTest.describe('rendered scroll choreography (Chromium software WebGL)', () => {
  renderedTest.skip(({ browserName }) => browserName !== 'chromium', 'SwiftShader verification uses Chromium');
  for (const [path, viewport] of [
    ['/', { width: 1440, height: 900 }],
    ['/en', { width: 390, height: 844 }],
  ] as const) {
    renderedTest(`${path} renders reversible chapter poses and resumes after pricing`, async ({ page }, testInfo) => {
      renderedTest.setTimeout(240_000);
      await page.setViewportSize(viewport);
      // Remove temporal damping for deterministic target-pose comparisons.
      // The separate stop/resume sample below restores normal motion.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const canvas = page.locator('.scene-canvas');
      await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
      await expect(canvas).toHaveAttribute('data-laptop-ready', 'true', { timeout: 60_000 });
      await expect(page.locator('.world-fallback')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      const windows = await page.locator('.chapter[data-exit-start]').evaluateAll(elements => elements.map(el => ({
        from: el.id,
        to: (el as HTMLElement).dataset.exitTo!,
        start: Number((el as HTMLElement).dataset.exitStart),
        end: Number((el as HTMLElement).dataset.exitEnd),
      })));
      expect(windows).toHaveLength(9);
      const at = async (y: number) => {
        await page.evaluate(async y => {
          scrollTo({ top: y, behavior: 'instant' });
          for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }, y);
        return canvas.evaluate(el => {
          const data = (el as HTMLCanvasElement).dataset;
          const view = JSON.parse(data.cameraViewOffset ?? '{}');
          return {
            suspended: data.suspended,
            values: [data.fittedCameraPosition, data.fittedLook, data.supportPosition, data.phonePosition,
              data.dishScale, data.dishOpacity, data.roomPosition, data.roomYaw]
              .flatMap(value => (value ?? '').split(',').map(Number))
              .concat([view.offsetX / el.clientWidth, view.offsetY / el.clientHeight]),
          };
        });
      };
      for (const window of windows) {
        const ys = window.from === 'open-weight'
          ? [window.end - 2, window.end + 2]
          : [window.start - 2, window.start + 2, (window.start + window.end) / 2, window.end - 2, window.end + 2];
        const forward: Awaited<ReturnType<typeof at>>[] = [];
        for (const y of ys) {
          const pose = await at(y);
          // Pricing is intentionally opaque; there is no rendered pose there.
          if (window.to === 'open-weight' && y >= window.end) {
            expect(pose.suspended).toBe('true');
          } else {
            expect(pose.suspended).toBe('false');
            expect(pose.values.every(Number.isFinite)).toBe(true);
          }
          forward.push(pose);
        }
        for (const pair of [[0, 1], [ys.length - 2, ys.length - 1]]) {
          const [a, b] = pair.map(i => forward[i]);
          if (a.suspended === 'true' || b.suspended === 'true') continue;
          for (let i = 0; i < a.values.length; i++) expect(Math.abs(a.values[i] - b.values[i]), `${window.from}:${window.to} boundary pose`).toBeLessThan(0.15);
        }
        for (let i = ys.length - 1; i >= 0; i--) {
          const reverse = await at(ys[i]);
          if (reverse.suspended === 'true') continue;
          reverse.values.forEach((value, n) => expect(value).toBeCloseTo(forward[i].values[n], 3));
        }
      }
      // Cross the internal opening chapter labels and sampled camera anchors.
      const motion = await page.locator('.opening-journey').evaluate(el =>
        Number((el as HTMLElement).style.getPropertyValue('--opening-motion-vh')) * el.firstElementChild!.clientHeight / 100);
      for (const p of [0.12, 0.28, 0.3, 0.42, 0.56, 0.72, 0.8, 0.86, 1]) {
        const [a, b] = [await at(motion * p - 2), await at(motion * p + 2)];
        a.values.forEach((value, n) => expect(Math.abs(value - b.values[n])).toBeLessThan(0.15));
      }
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const feature = windows.find(window => window.from === 'features')!;
      await at((feature.start + feature.end) / 2);
      await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 10_000 });
      await expect(canvas).toHaveAttribute('data-transition', 'features:encryption');
      // Keep actual rendered evidence, including successful runs. The workflow
      // uploads these before another browser family clears test-results.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const productEntry = windows.find(window => window.to === 'product')!;
      const productExit = windows.find(window => window.from === 'product')!;
      for (const [name, section, y] of [
        ['room', 'hero', 0],
        ['phone', 'wearable', motion],
        ['support', 'product', (productEntry.end + productExit.start) / 2],
      ] as const) {
        await at(y);
        await expect(canvas).toHaveAttribute('data-section', section);
        await expect(canvas).toHaveAttribute('data-suspended', 'false');
        await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 10_000 });
        await expect(page.locator('.preloader')).toHaveCount(0);
        expect(await canvas.evaluate(el => Number((el as HTMLCanvasElement).dataset.drawCalls))).toBeGreaterThan(0);
        const screenshotPath = testInfo.outputPath(`rendered-${name}.png`);
        await page.screenshot({ path: screenshotPath });
        await testInfo.attach(`rendered-${name}`, { path: screenshotPath, contentType: 'image/png' });
      }
      expect(errors).toEqual([]);
    });
  }
});
