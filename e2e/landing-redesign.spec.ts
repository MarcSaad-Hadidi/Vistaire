import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

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
    await expect(footer.locator(".footer-bottom")).toBeInViewport();
    for (const href of links) await expect(footer.locator(`[data-footer-navigation] a[href="${href}"]`)).toHaveCount(1);
    await expect(footer.locator("[data-footer-navigation] section")).toHaveCount(6);
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
      // Software rasterization is slow; this is a bounded correctness budget,
      // never a performance/FPS acceptance threshold.
      renderedTest.setTimeout(viewport.width > 768 ? 600_000 : 480_000);
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
      const geometry = await page.evaluate(() => ({
        viewport: { width: innerWidth, height: innerHeight },
        stage: document.querySelector('.opening-stage')!.clientHeight,
        canvasHeight: document.querySelector('.world')!.clientHeight,
        chapters: [...document.querySelectorAll<HTMLElement>('.chapter')].map(el => ({
          id: el.id, top: el.getBoundingClientRect().top + scrollY,
          height: el.getBoundingClientRect().height, stage: el.firstElementChild!.clientHeight,
        })),
      }));
      const pricing = geometry.chapters.find(chapter => chapter.id === 'open-weight')!;
      const telemetry: { segment: string; target: number; snapshot: unknown }[] = [];
      let segment = 'initial';
      const saveTelemetry = async () => {
        const telemetryPath = testInfo.outputPath('rendered-scroll-telemetry.json');
        await writeFile(telemetryPath, JSON.stringify({
          renderer: 'Chromium SwiftShader; target poses sampled with reduced motion, not physical input or FPS',
          geometry, windows, samples: telemetry,
          units: 'World positions/look use authored Three.js units; scale and alpha are dimensionless; view offsets and text positions are normalized by canvas/stage size. Hidden pricing samples are excluded from motion speed. Root orientations use quaternion angular distance in radians; world paths are normalized independently by their own traveled length.',
        }, null, 2));
      };
      const at = async (y: number, settle = false) => {
        await page.evaluate(async y => {
          scrollTo({ top: y, behavior: 'instant' });
          for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }, y);
        if (settle) await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
        const snapshot = await canvas.evaluate(el => {
          const data = (el as HTMLCanvasElement).dataset;
          const view = JSON.parse(data.cameraViewOffset ?? '{}');
          const vector = (value: string | undefined) => (value ?? '').split(',').map(Number);
          const channels = Object.fromEntries([
            ['camera', vector(data.fittedCameraPosition)], ['look', vector(data.fittedLook)],
            ...['dish', 'support', 'phone', 'laptop'].flatMap(name => ['Position', 'Scale', 'Quaternion'].map(kind => [name + kind, vector(data[name + kind])])),
            ['dishOpacity', [Number(data.dishOpacity)]],
            ['viewOffset', [view.offsetX / el.clientWidth, view.offsetY / el.clientHeight]],
          ]) as Record<string, number[]>;
          return {
            scroll: scrollY,
            channels,
            section: data.section,
            progress: Number(data.progress),
            transition: data.transition,
            transitionProgress: Number(data.transitionProgress),
            suspended: data.suspended,
            camera: data.fittedCameraPosition,
            look: data.fittedLook,
            supportPosition: data.supportPosition,
            phonePosition: data.phonePosition,
            dishScale: data.dishScale,
            dishOpacity: Number(data.dishOpacity),
            roomPosition: data.roomPosition,
            roomYaw: Number(data.roomYaw),
            laptopAngle: Number(data.laptopAngle),
            renderCPUms: Number(data.renderCPUms),
            viewOffset: [view.offsetX / el.clientWidth, view.offsetY / el.clientHeight],
            copy: Object.fromEntries([...document.querySelectorAll<HTMLElement>('.chapter')].map(chapter => {
              const text = chapter.querySelector('.is-current h3') || chapter.querySelector('h1:not(.sr-only),h2:not(.sr-only),h3:not(.sr-only),p:not(.sr-only)')!;
              let opacity = 1;
              for (let ancestor: Element | null = text; ancestor && ancestor !== chapter.parentElement; ancestor = ancestor.parentElement)
                opacity *= Number(getComputedStyle(ancestor).opacity);
              const rect = text.getBoundingClientRect();
              return [chapter.id, { opacity, top: rect.top / el.clientHeight, left: rect.left / el.clientWidth }];
            })),
            values: [data.fittedCameraPosition, data.fittedLook, data.supportPosition, data.phonePosition,
              data.dishScale, data.dishOpacity, data.roomPosition, data.roomYaw]
              .flatMap(value => (value ?? '').split(',').map(Number))
              .concat([view.offsetX / el.clientWidth, view.offsetY / el.clientHeight])
              .concat(...Object.values(channels)),
          };
        });
        telemetry.push({ segment, target: y, snapshot });
        return snapshot;
      };
      for (const window of windows) {
        segment = `transition:${window.from}:${window.to}:forward`;
        // Add uniform samples to the original five seam/midpoint samples.
        const ys = [...new Set([
          window.start - 2, window.start + 2, window.end - 2, window.end + 2,
          ...Array.from({ length: 9 }, (_, i) => window.start + (window.end - window.start) * i / 8),
        ])].sort((a, b) => a - b);
        expect((window.end - window.start) / geometry.stage).toBeCloseTo(window.to === 'footer' ? Math.min(3.2, (window.end - windows.at(-2)!.end) / geometry.stage) : 3.2, 6);
        const forward: Awaited<ReturnType<typeof at>>[] = [];
        for (const y of ys) {
          const pose = await at(y);
          // Pricing is intentionally opaque; there is no rendered pose there.
          if (pose.scroll >= pricing.top && pose.scroll <= pricing.top + Math.round(pricing.height) - geometry.canvasHeight) {
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
        const regular = Array.from({ length: 9 }, (_, i) => forward[ys.findIndex(y => Math.abs(y - window.start - (window.end - window.start) * i / 8) < 0.001)]);
        // Normalize each path by its own traveled distance. World units of a
        // phone, room and camera are not interchangeable physical velocities.
        if (regular.every(sample => sample.suspended !== 'true')) {
          for (const name of Object.keys(regular[0].channels)) {
            const distances = regular.slice(1).map((sample, i) => {
              const a = regular[i].channels[name], b = sample.channels[name];
              return name.endsWith('Quaternion')
                ? 2 * Math.acos(Math.min(1, Math.abs(a.reduce((sum, v, n) => sum + v * b[n], 0))))
                : Math.hypot(...a.map((v, n) => v - b[n]));
            });
            const length = distances.reduce((a, b) => a + b, 0);
            if (length < 0.001) continue;
            const mean = length / ((regular.at(-1)!.scroll - regular[0].scroll) / geometry.stage);
            const speeds = distances.map((distance, i) => distance / ((regular[i + 1].scroll - regular[i].scroll) / geometry.stage));
            expect(Math.max(...speeds) / mean, `${window.from}:${window.to} ${name} normalized velocity`).toBeLessThan(1.42);
          }
        }
        // Copy uses a deliberate 1.6-stage active fade in each half of the
        // common 3.2-stage handoff; normalize that active interval, not its
        // intentional zero-opacity hold (whole-window peak would be 8/3).
        for (const [id, active] of [[window.from, regular.slice(0, 5)], [window.to, regular.slice(4)]] as const) {
          if (id === 'open-weight') continue; // Interactive pricing is native.
          for (const field of ['opacity', 'top'] as const) {
            const steps = active.slice(1).map((sample, i) => Math.abs(sample.copy[id][field] - active[i].copy[id][field]));
            const length = steps.reduce((a, b) => a + b, 0);
            if (length < 0.0001) continue;
            const mean = length / ((active.at(-1)!.scroll - active[0].scroll) / geometry.stage);
            const speeds = steps.map((distance, i) => distance / ((active[i + 1].scroll - active[i].scroll) / geometry.stage));
            expect(Math.max(...speeds) / mean, `${id}: rendered text ${field} active-phase velocity`).toBeLessThan(1.42);
          }
        }
        if (window.from !== 'open-weight' && window.to !== 'open-weight') {
          expect(regular[4].copy[window.from].opacity).toBeLessThan(0.001);
          expect(regular[4].copy[window.to].opacity).toBeLessThan(0.001);
        }
        // Retain reversal checks for all original seam/midpoint positions.
        segment = `transition:${window.from}:${window.to}:reverse`;
        const reverseYs = [window.end + 2, window.end - 2, (window.start + window.end) / 2, window.start + 2, window.start - 2];
        for (const y of reverseYs) {
          const i = ys.findIndex(sample => Math.abs(sample - y) < 0.001);
          const reverse = await at(y);
          if (reverse.suspended === 'true') continue;
          reverse.values.forEach((value, n) => expect(value).toBeCloseTo(forward[i].values[n], 3));
        }
        await saveTelemetry();
      }
      // The measured 6.2-stage sticky travel contains a 4-stage active
      // presentation between the common 1.1-stage entry/exit portions.
      for (const chapter of geometry.chapters.slice(3, 10)) {
        segment = `presentation:${chapter.id}`;
        for (const fraction of [0, 0.25, 0.5, 0.75, 1])
          await at(chapter.top + geometry.stage * (1.1 + 4 * fraction));
      }
      await saveTelemetry();
      // Cross the internal opening chapter labels and sampled camera anchors.
      const motion = await page.locator('.opening-journey').evaluate(el =>
        Number((el as HTMLElement).style.getPropertyValue('--opening-motion-vh')) * el.firstElementChild!.clientHeight / 100);
      segment = 'opening-anchors';
      for (const p of [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
        const [a, b] = [await at(motion * p - 2), await at(motion * p + 2)];
        a.values.forEach((value, n) => expect(Math.abs(value - b.values[n])).toBeLessThan(0.15));
      }
      await saveTelemetry();
      await testInfo.attach('rendered-scroll-telemetry', { path: testInfo.outputPath('rendered-scroll-telemetry.json'), contentType: 'application/json' });
      segment = 'normal-motion-stop';
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const feature = windows.find(window => window.from === 'features')!;
      await at((feature.start + feature.end) / 2);
      await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 10_000 });
      await expect(canvas).toHaveAttribute('data-transition', 'features:encryption');
      segment = 'normal-motion-laptop-hinge';
      const laptopChapter = geometry.chapters.find(chapter => chapter.id === 'sustainability')!;
      for (const fraction of [0, 0.25, 0.5, 0.75, 1])
        await at(laptopChapter.top + geometry.stage * (1.1 + 4 * fraction), true);
      await saveTelemetry();
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
        await expect(canvas).toHaveAttribute('data-table-setting-visible', 'false');
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

renderedTest.describe('complete-food zoom fit (Chromium software WebGL)', () => {
  renderedTest.skip(({ browserName }) => browserName !== 'chromium', 'SwiftShader verification uses Chromium');
  for (const [path, viewport] of [['/', { width: 1440, height: 900 }], ['/en', { width: 390, height: 844 }]] as const) {
    renderedTest(`${path} keeps every food model inside its frame while zooming, rotating and resizing`, async ({ page }, testInfo) => {
      renderedTest.setTimeout(600_000);
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const canvas = page.locator('.scene-canvas');
      await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
      await expect(canvas).toHaveAttribute('data-laptop-ready', 'true', { timeout: 60_000 });
      await expect(page.locator('.preloader')).toHaveCount(0);
      const atGrip = async () => {
        await page.locator('#grip').evaluate(async el => {
          scrollTo({ top: el.getBoundingClientRect().top + scrollY + ((el as HTMLElement).offsetHeight - el.firstElementChild!.clientHeight) / 2, behavior: 'instant' });
          for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        });
        await expect(canvas).toHaveAttribute('data-section', 'grip');
      };
      await atGrip();
      type Fit = { model: string | undefined; frame: { x: number; y: number; width: number; height: number }; food: { x: number; y: number; width: number; height: number } | null; scale: number; requested: number; fitted: number; meshScale: string | undefined; quaternion: string | undefined; width: number; height: number };
      const samples: { scenario: string; fit: Fit }[] = [];
      const capture = async (count = 1, reset = false) => canvas.evaluate(async (el, { count, reset }) => {
        const result = [];
        if (reset) document.querySelector<HTMLButtonElement>('.reset-dish')!.click();
        for (let i = 0; i < count; i++) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          const d = (el as HTMLCanvasElement).dataset;
          result.push({ model: d.renderedModel, frame: JSON.parse(d.focusBounds!), food: JSON.parse(d.dishBounds ?? 'null'), scale: Number(d.dishScale?.split(',')[0]), requested: Number(d.cameraDolly), fitted: Number(d.fittedZoom), meshScale: d.dishMeshScale, quaternion: d.dishQuaternion, width: el.clientWidth, height: el.clientHeight });
        }
        return result;
      }, { count, reset }) as Promise<Fit[]>;
      const check = (fit: Fit, scenario: string) => {
        samples.push({ scenario, fit });
        if (!fit.food) {
          expect(scenario.startsWith('chapter-handoff:'), 'only an outgoing dish may disappear').toBe(true);
          expect(fit.scale).toBeLessThan(0.003);
          return;
        }
        expect(fit.food.x, `${scenario}: left`).toBeGreaterThanOrEqual(fit.frame.x - 2);
        expect(fit.food.y, `${scenario}: top`).toBeGreaterThanOrEqual(fit.frame.y - 2);
        expect(fit.food.x + fit.food.width, `${scenario}: right`).toBeLessThanOrEqual(fit.frame.x + fit.frame.width + 2);
        expect(fit.food.y + fit.food.height, `${scenario}: bottom`).toBeLessThanOrEqual(fit.frame.y + fit.frame.height + 2);
        if (!scenario.startsWith('chapter-handoff:')) {
          expect(fit.frame.height, `${scenario}: meaningful food frame`).toBeGreaterThanOrEqual(120);
          expect(fit.food.height, `${scenario}: food remains visible`).toBeGreaterThan(12);
          expect(fit.food.width, `${scenario}: food remains visible`).toBeGreaterThan(12);
        }
        expect(fit.fitted).toBeGreaterThan(0);
        expect(fit.fitted).toBeLessThanOrEqual(fit.requested + 0.02);
      };
      for (const id of ['homard', 'souffle', 'huitres', 'sushi', 'chocolat-fume', 'poutine', 'burger']) {
        await page.locator(`.dish-switch [data-dish-id="${id}"]`).click();
        await expect(canvas).toHaveAttribute('data-rendered-model', id, { timeout: 90_000 });
        await atGrip();
        const meshScale = await canvas.getAttribute('data-dish-mesh-scale');
        // Exercise the actual button handlers; batch requests before a frame
        // so the fit cap, rather than repeated disabled clicks, is tested.
        await page.locator('.dish-zoom button').nth(1).evaluate(el => {
          for (let i = 0; i < 15; i++) (el as HTMLButtonElement).click();
        });
        await expect.poll(async () => Number(await canvas.getAttribute('data-camera-dolly'))).toBeCloseTo(4, 2);
        await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
        for (const fit of await capture()) check(fit, `${id}:maximum`);
        expect(await canvas.getAttribute('data-dish-mesh-scale')).toBe(meshScale);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const box = await page.locator('.dish-gesture').boundingBox();
        expect(box).not.toBeNull();
        const frames = capture(16);
        await page.mouse.move(box!.x + box!.width * 0.45, box!.y + box!.height * 0.3);
        await page.mouse.down();
        await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.7, { steps: 4 });
        await page.mouse.up();
        const rotationFrames = await frames;
        for (const fit of rotationFrames) check(fit, `${id}:damped-rotation`);
        expect(new Set(rotationFrames.map(fit => fit.quaternion)).size, `${id}: capture must contain actual rotation`).toBeGreaterThan(1);
        await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
        for (const fit of await capture()) check(fit, `${id}:rotated`);
        await expect(canvas).toHaveAttribute('data-table-setting-visible', 'false');
        const screenshot = testInfo.outputPath(`rendered-zoom-${id}.png`);
        await page.screenshot({ path: screenshot });
        await testInfo.attach(`zoom-${id}`, { path: screenshot, contentType: 'image/png' });
        await page.locator('.rotation-range').focus();
        await page.keyboard.press('Home'); // yaw −π, the reproduced reset case
        await expect(page.locator('.rotation-range')).toHaveAttribute('aria-valuenow', '0');
        await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
        const resetFrames = await capture(16, true);
        for (const fit of resetFrames) check(fit, `${id}:damped-reset`);
        expect(Math.min(...resetFrames.map(fit => fit.requested))).toBeLessThan(1.4);
        await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
        // Leave the final burger zoomed for the resize/handoff checks below.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        if (id === 'burger') {
          await page.locator('.dish-zoom button').nth(1).evaluate(el => {
            for (let i = 0; i < 15; i++) (el as HTMLButtonElement).click();
          });
          await expect.poll(async () => Number(await canvas.getAttribute('data-camera-dolly'))).toBeCloseTo(4, 2);
        }
      }
      // CSS viewport/orientation changes while already zoomed, not a claim
      // about desktop browser-zoom UI or physical mobile address bars.
      for (const size of viewport.width < 768 ? [{ width: 430, height: 932 }, { width: 844, height: 390 }, viewport] : [{ width: 1337, height: 591 }, viewport]) {
        await page.setViewportSize(size);
        await atGrip();
        for (const fit of await capture()) check(fit, `resize:${size.width}x${size.height}`);
      }
      const window = await page.locator('#grip').evaluate(el => ({ start: Number((el as HTMLElement).dataset.exitStart), end: Number((el as HTMLElement).dataset.exitEnd) }));
      for (const fraction of [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) {
        await page.evaluate(async y => {
          scrollTo({ top: y, behavior: 'instant' });
          for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }, window.start + (window.end - window.start) * fraction);
        for (const fit of await capture()) check(fit, `chapter-handoff:${fraction}`);
      }
      const artifact = testInfo.outputPath('rendered-zoom-fit-telemetry.json');
      await writeFile(artifact, JSON.stringify({ renderer: 'Chromium SwiftShader', samples }, null, 2));
      await testInfo.attach('zoom-fit-telemetry', { path: artifact, contentType: 'application/json' });
      expect(errors).toEqual([]);
    });
  }
});
