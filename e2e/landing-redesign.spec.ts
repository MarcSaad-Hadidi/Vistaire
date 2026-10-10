import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

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

// A processed-pose acknowledgement replaces the former four blind RAF waits.
// It is published only after a rendered/update pass (or explicit occlusion),
// not when App first mutates state. Repeat positions can reuse a valid pose.
async function waitForProcessedPose(page: Page, framesBeforeResize?: number, requireGripFrame = false, diagnostic?: { target: number; artifact: string }) {
  const startedAt = new Date().toISOString();
  let pendingDiagnostic: Promise<void> | undefined;
  const timer = diagnostic ? setTimeout(() => {
    pendingDiagnostic = (async () => {
      let captureTimer: ReturnType<typeof setTimeout> | undefined;
      let snapshot = null;
      let captureError: string | null = null;
      try {
        snapshot = await Promise.race([
          page.evaluate(() => {
            const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas');
            const opening = document.querySelector<HTMLElement>('.opening-journey');
            const data = canvas?.dataset;
            const openingTop = opening ? opening.getBoundingClientRect().top + scrollY : null;
            const stageHeight = opening?.firstElementChild?.getBoundingClientRect().height ?? null;
            const layoutStageHeight = opening?.firstElementChild ? Number.parseFloat(getComputedStyle(opening.firstElementChild).height) : null;
            const grip = document.querySelector('#grip');
            return { scrollY, openingTop, stageHeight, layoutStageHeight,
              expectedDistance: openingTop != null && layoutStageHeight ? Math.max(0, (scrollY - openingTop) / layoutStageHeight) : null,
              canvasExists: Boolean(canvas), openingExists: Boolean(opening), fallbackExists: Boolean(document.querySelector('.world-fallback')),
              hidden: document.hidden, visibility: document.visibilityState, chapter: document.documentElement.dataset.chapter,
              selectedSocialCards: [...document.querySelectorAll('.social-pager button')].map(button => button.getAttribute('aria-current')),
              viewport: { width: innerWidth, height: innerHeight }, clientWidth: canvas?.clientWidth, clientHeight: canvas?.clientHeight,
              gripFocus: grip?.querySelector('.scene-focus')?.getBoundingClientRect().toJSON(), gripStage: grip?.firstElementChild?.getBoundingClientRect().toJSON(), worldHeight: document.querySelector<HTMLElement>('.world')?.clientHeight,
              dataset: { ...data } };
          }),
          new Promise<null>(resolve => { captureTimer = setTimeout(() => resolve(null), 1_000); }),
        ]);
      } catch (error) { captureError = String(error); }
      finally { clearTimeout(captureTimer); }
      if (snapshot === null && captureError === null) captureError = 'Pending pose capture exceeded 1s';
      try {
        await Promise.race([
          writeFile(diagnostic.artifact, JSON.stringify({ target: diagnostic.target, startedAt, observedAt: new Date().toISOString(), framesBeforeResize, requireGripFrame, snapshot, captureError }, null, 2)),
          new Promise<never>((_, reject) => { captureTimer = setTimeout(() => reject(new Error('Pending pose persistence exceeded 1s')), 1_000); }),
        ]);
      } finally { clearTimeout(captureTimer); }
    })().catch(error => console.warn('Could not preserve pending pose diagnostics:', error));
  }, 15_000) : undefined;
  try {
    await page.waitForFunction(({ framesBeforeResize, requireGripFrame }) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas');
    const opening = document.querySelector<HTMLElement>('.opening-journey');
    if (!canvas || !opening) return false;
    const data = canvas.dataset;
    // This unpadded, border-box stage has a declared CSS height. Its translated
    // visual rect loses precision far down the long journey (844→844.001953125).
    const stageHeight = Number.parseFloat(getComputedStyle(opening.firstElementChild!).height);
    if (!Number.isFinite(stageHeight) || stageHeight <= 0) return false;
    const openingTop = opening.getBoundingClientRect().top + scrollY;
    const distance = Math.max(0, (scrollY - openingTop) / stageHeight);
    if (!Number.isFinite(Number(data.processedScrollDistance)) || Math.abs(Number(data.processedScrollDistance) - distance) > 1e-6) return false;
    if (data.processedViewportRevision !== data.viewportResizes || !data.processedViewportRevision) return false;
    if (Number(data.processedViewportWidth) !== canvas.clientWidth || Number(data.processedViewportHeight) !== canvas.clientHeight) return false;
    if (data.suspended !== 'true' && framesBeforeResize !== undefined && (!Number.isFinite(framesBeforeResize) || !Number.isFinite(Number(data.frames)) || Number(data.frames) <= framesBeforeResize)) return false;
    if (requireGripFrame) {
      if (data.section !== 'grip' || !data.focusBounds) return false;
      const chapter = document.querySelector<HTMLElement>('#grip')!;
      const focus = chapter.querySelector('.scene-focus')!.getBoundingClientRect();
      const stage = chapter.firstElementChild!.getBoundingClientRect();
      const actual = JSON.parse(data.focusBounds);
      const scaleX = canvas.clientWidth / innerWidth;
      const scaleY = canvas.clientHeight / document.querySelector<HTMLElement>('.world')!.clientHeight;
      if ([actual.x - focus.left * scaleX, actual.y - (focus.top - stage.top) * scaleY, actual.width - focus.width * scaleX, actual.height - focus.height * scaleY].some(value => !Number.isFinite(value) || Math.abs(value) > 0.1)) return false;
    }
    return true;
    }, { framesBeforeResize, requireGripFrame }, { timeout: 0 });
  } finally {
    clearTimeout(timer);
    if (pendingDiagnostic) await pendingDiagnostic;
  }
}

async function diagnosticSnapshot(page: Page, expectedViewport?: { width: number; height: number }) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      page.evaluate(expectedViewport => {
        const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas');
        const root = getComputedStyle(document.documentElement);
        const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().toJSON() ?? null;
        return { scroll: scrollY, viewport: { width: innerWidth, height: innerHeight }, expectedViewport,
          journeyVH: root.getPropertyValue('--vistaire-journey-vh'), sceneVH: root.getPropertyValue('--vistaire-scene-vh'),
          world: rect('.world'), openingStage: rect('.opening-stage'), grip: rect('#grip'), gripStage: rect('#grip > .stage'), canvasRect: canvas?.getBoundingClientRect().toJSON() ?? null,
          resizeDiagnostics: (window as typeof window & { sceneResizeDiagnostics?: { read: () => unknown } }).sceneResizeDiagnostics?.read() ?? null,
          rafDiagnostics: (window as typeof window & { sceneRAFDiagnostics?: { read: () => unknown } }).sceneRAFDiagnostics?.read() ?? null,
          dataset: { ...canvas?.dataset } };
      }, expectedViewport),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1_000); }),
    ]);
  } catch { return null; }
  finally { clearTimeout(timer); }
}

// Passive owned-RAF evidence for the rare Home-settle failure. The wrapper
// never schedules a probe frame, forces layout, or changes callback arguments.
async function installSceneRAFDiagnostics(page: Page) {
  await page.addInitScript(() => {
    const nativeRAF = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const sceneCallbacks = new WeakSet<FrameRequestCallback>();
    const pending = new Map<number, { callback: FrameRequestCallback; requestedAt: number }>();
    const samples: unknown[] = [];
    let callbacks = 0, droppedSamples = 0;
    let canvas: HTMLCanvasElement | null = null;
    const state = () => {
      if (!canvas?.isConnected) canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas');
      const data = canvas?.dataset;
      return { frames: Number(data?.frames ?? 0), settled: data?.settled, reasons: data?.settlingReasons,
        section: data?.section, hidden: document.hidden, visibility: document.visibilityState };
    };
    const ownedPending = () => [...pending.entries()]
      .filter(([, request]) => sceneCallbacks.has(request.callback))
      .map(([id, request]) => ({ id, requestedAt: request.requestedAt }));
    const record = (sample: unknown) => {
      samples.push(sample);
      if (samples.length > 20) { samples.shift(); droppedSamples++; }
    };
    window.requestAnimationFrame = callback => {
      const requestedAt = performance.now();
      const id = nativeRAF(function (this: Window, timestamp) {
        pending.delete(id);
        const startedAt = performance.now();
        const before = state();
        const pendingBefore = ownedPending().length;
        try { Reflect.apply(callback, this, [timestamp]); }
        finally {
          const endedAt = performance.now();
          const after = state();
          if (after.frames > before.frames) sceneCallbacks.add(callback);
          if (sceneCallbacks.has(callback)) {
            callbacks++;
            record({ kind: 'callback', id, requestedAt, startedAt, endedAt,
              durationMs: endedAt - startedAt, rafTimestamp: timestamp,
              pendingBefore, pendingAfter: ownedPending().length, before, after });
          }
        }
      });
      pending.set(id, { callback, requestedAt });
      return id;
    };
    window.cancelAnimationFrame = id => {
      const request = pending.get(id);
      if (request && sceneCallbacks.has(request.callback))
        record({ kind: 'cancel', id, at: performance.now(), requestedAt: request.requestedAt, state: state() });
      pending.delete(id);
      nativeCancel(id);
    };
    (window as typeof window & { sceneRAFDiagnostics: { read: () => unknown } }).sceneRAFDiagnostics = {
      read: () => {
        const at = performance.now();
        return { at, callbacks, droppedSamples,
          pending: ownedPending().map(request => ({ ...request, ageMs: at - request.requestedAt })), samples, current: state() };
      },
    };
  });
}

// Desktop Chromium viewport emulation has no physical browser toolbar. A
// requested height must reach the frozen CSS references before a scroll target
// is computed; width may be observed before the frozen height catches up.
async function waitForViewportLayout(page: Page, expected: { width: number; height: number }) {
  await page.waitForFunction(({ width, height }) => {
    const root = getComputedStyle(document.documentElement);
    const world = document.querySelector<HTMLElement>('.world');
    const stage = document.querySelector<HTMLElement>('.opening-stage');
    const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas');
    return innerWidth === width && innerHeight === height && world && stage && canvas
      && [parseFloat(root.getPropertyValue('--vistaire-journey-vh')) * 100,
        parseFloat(root.getPropertyValue('--vistaire-scene-vh')) * 100,
        world.getBoundingClientRect().height, stage.getBoundingClientRect().height,
        canvas.clientHeight, Number(canvas.dataset.processedViewportHeight)]
        .every(value => Number.isFinite(value) && Math.abs(value - height) < 0.1)
      && canvas.clientWidth === width && Number(canvas.dataset.processedViewportWidth) === width
      && canvas.dataset.processedViewportRevision === canvas.dataset.viewportResizes;
  }, expected, { timeout: 15_000 });
}

renderedTest.describe('optional scene framing diagnostics (Chromium software WebGL)', () => {
  renderedTest.skip(({ browserName }) => browserName !== 'chromium', 'SwiftShader verification uses Chromium');

  renderedTest('default rendering skips hulls and wakes for an essential phone while QA hulls stay optional', async ({ page }, testInfo) => {
    renderedTest.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const requests: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/immersive-assets/dishes/framing-hulls.json') requests.push(request.url());
    });
    // Identify the real Scene callback by its rendered frame publication, and
    // track owned RAF handles. Pending ownership distinguishes sleep from a
    // software renderer whose callbacks are merely delayed.
    await page.addInitScript(() => {
      const nativeRAF = window.requestAnimationFrame.bind(window);
      const nativeCancel = window.cancelAnimationFrame.bind(window);
      const sceneCallbacks = new WeakSet<FrameRequestCallback>();
      const pending = new Map<number, FrameRequestCallback>();
      // Three loads these textures through detached ImageLoader elements.
      // Observe their real completion so a late texture wake cannot conceal a
      // missing phone-completion wake after the scene has gone to sleep.
      const texturePaths = new Set(['/immersive-assets/restaurant-stone.webp', '/immersive-assets/phone-poster-maison-elyse.webp']);
      const images: WeakRef<HTMLImageElement>[] = [];
      const observed = new WeakSet<HTMLImageElement>();
      const loaded = new Set<string>();
      const createElementNS = document.createElementNS;
      document.createElementNS = function (this: Document, ...args: Parameters<Document['createElementNS']>) {
        const element = Reflect.apply(createElementNS, this, args);
        if (element instanceof HTMLImageElement) images.push(new WeakRef(element));
        return element;
      } as typeof createElementNS;
      const probe = {
        callbacks: 0,
        get pending() { return [...pending.values()].filter(callback => sceneCallbacks.has(callback)).length; },
        get texturesReady() {
          for (const reference of images) {
            const image = reference.deref();
            if (!image?.src) continue;
            const url = new URL(image.currentSrc || image.src, location.href);
            if (url.origin !== location.origin || !texturePaths.has(url.pathname)) continue;
            const record = () => { if (image.complete && image.naturalWidth > 0) loaded.add(url.pathname); };
            if (!observed.has(image)) { observed.add(image); image.addEventListener('load', record, { once: true }); }
            record(); // Includes cached loads completed before the first read.
          }
          return loaded.size === texturePaths.size;
        },
      };
      (window as typeof window & { sceneWakeProbe: typeof probe }).sceneWakeProbe = probe;
      window.requestAnimationFrame = callback => {
        const id = nativeRAF(function (this: Window, timestamp) {
          pending.delete(id);
          const before = Number(document.querySelector<HTMLCanvasElement>('.scene-canvas')?.dataset.frames ?? 0);
          try { Reflect.apply(callback, this, [timestamp]); }
          finally {
            const after = Number(document.querySelector<HTMLCanvasElement>('.scene-canvas')?.dataset.frames ?? 0);
            if (after > before) sceneCallbacks.add(callback);
            if (sceneCallbacks.has(callback)) probe.callbacks++;
          }
        });
        pending.set(id, callback);
        return id;
      };
      window.cancelAnimationFrame = id => { pending.delete(id); nativeCancel(id); };
    });
    const phonePattern = '**/immersive-assets/phone/iphone_16_-_free.glb';
    let releasePhone!: () => void;
    const phoneReleased = new Promise<void>(resolve => { releasePhone = resolve; });
    let phoneRequestHeld = false;
    await page.route(phonePattern, async route => { phoneRequestHeld = true; await phoneReleased; await route.continue(); });
    const canvas = page.locator('.scene-canvas');
    try {
      await page.goto('/#wearable', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      for (const attribute of ['restaurant', 'support', 'laptop'])
        await expect(canvas).toHaveAttribute(`data-${attribute}-ready`, 'true', { timeout: 120_000 });
      await expect(canvas).toHaveAttribute('data-rendered-model', 'homard');
      await expect(canvas).toHaveAttribute('data-section', 'wearable');
      expect(phoneRequestHeld).toBe(true);
      await expect(canvas).toHaveAttribute('data-phone-ready', 'false');
      await expect(canvas).not.toHaveAttribute('data-ready', 'true');
      await expect.poll(() => page.evaluate(() =>
        (window as typeof window & { sceneWakeProbe: { texturesReady: boolean } }).sceneWakeProbe.texturesReady,
      ), { timeout: 15_000 }).toBe(true);
      await expect.poll(() => page.evaluate(async () => {
        const probe = (window as typeof window & { sceneWakeProbe: { callbacks: number; pending: number } }).sceneWakeProbe;
        if (!probe.callbacks || probe.pending || document.querySelector<HTMLCanvasElement>('.scene-canvas')?.dataset.settled !== 'true') return false;
        const before = probe.callbacks;
        await new Promise(resolve => setTimeout(resolve, 500));
        return probe.pending === 0 && probe.callbacks === before;
      }), { timeout: 15_000 }).toBe(true);
      const asleep = await canvas.evaluate(el => ({ frames: Number((el as HTMLCanvasElement).dataset.frames), scrollY,
        callbacks: (window as typeof window & { sceneWakeProbe: { callbacks: number } }).sceneWakeProbe.callbacks }));
      releasePhone();
      // No scroll, gesture or retry may wake the missing-phone completion.
      await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
      await expect(canvas).toHaveAttribute('data-phone-ready', 'true');
      await expect(canvas).toHaveAttribute('data-phone', 'iphone-16');
      await expect(canvas).toHaveAttribute('data-section', 'wearable');
      await expect.poll(() => canvas.evaluate(el => Number((el as HTMLCanvasElement).dataset.frames))).toBeGreaterThan(asleep.frames);
      const awake = await canvas.evaluate(el => ({ scrollY, scale: Number((el as HTMLCanvasElement).dataset.phoneScale?.split(',')[0]),
        callbacks: (window as typeof window & { sceneWakeProbe: { callbacks: number } }).sceneWakeProbe.callbacks }));
      expect(awake.callbacks).toBeGreaterThan(asleep.callbacks);
      expect(awake.scrollY).toBe(asleep.scrollY);
      expect(awake.scale).toBeGreaterThan(0);
      await expect(canvas).toHaveAttribute('data-framing-ready', 'disabled');
      await expect(canvas).not.toHaveAttribute('data-dish-bounds', /.+/);
      await expect(canvas).not.toHaveAttribute('data-focus-bounds', /.+/);
      await expect(page.locator('.preloader')).toHaveCount(0);
      await expect(page.locator('.world-fallback')).toHaveCount(0);
      expect(requests).toEqual([]);
      const image = testInfo.outputPath('rendered-phone-essential-wake.png');
      await page.screenshot({ path: image });
      await testInfo.attach('phone-essential-wake', { path: image, contentType: 'image/png' });
    } finally {
      releasePhone();
      await page.unroute(phonePattern).catch(error => console.warn('Phone route cleanup after release failed:', error));
    }

    let releaseHull!: () => void;
    const released = new Promise<void>(resolve => { releaseHull = resolve; });
    await page.route('**/immersive-assets/dishes/framing-hulls.json', async route => {
      await released;
      await route.continue();
    });
    try {
      await page.goto('/?sceneDiagnostics=1', { waitUntil: 'domcontentloaded' });
      await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
      await expect(canvas).toHaveAttribute('data-rendered-model', 'homard');
      await expect(page.locator('.preloader')).toHaveCount(0);
      await expect(page.locator('.world-fallback')).toHaveCount(0);
      await expect(canvas).toHaveAttribute('data-framing-ready', 'false');
      expect(requests).toHaveLength(1);
      await expect(canvas).not.toHaveAttribute('data-dish-bounds', /.+/);
      releaseHull();
      await expect(canvas).toHaveAttribute('data-framing-ready', 'true', { timeout: 60_000 });
      // Ready describes the fetch; a later rendered update publishes the bounds.
      await expect(canvas).toHaveAttribute('data-dish-bounds', /^\{/, { timeout: 60_000 });
      await expect(canvas).toHaveAttribute('data-focus-bounds', /^\{/);
      expect(requests).toHaveLength(1);
    } finally { releaseHull(); }
  });

  renderedTest('a rejected QA hull stays diagnostic-only while the real scene renders and resizes', async ({ page }, testInfo) => {
    renderedTest.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/immersive-assets/dishes/framing-hulls.json', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.goto('/?sceneDiagnostics=1', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('.scene-canvas');
    let expectedViewport = { width: 390, height: 844 };
    let before: { frames: number; revision: number } | null = null;
    try {
      await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
      await expect(canvas).toHaveAttribute('data-framing-ready', 'error');
      await expect(canvas).toHaveAttribute('data-framing-error', /.+/);
      await expect(canvas).toHaveAttribute('data-rendered-model', 'homard');
      await expect(page.locator('.preloader')).toHaveCount(0);
      await expect(page.locator('.world-fallback')).toHaveCount(0);
      await expect(canvas).not.toHaveAttribute('data-dish-bounds', /.+/);
      await waitForViewportLayout(page, expectedViewport);
      before = await canvas.evaluate(el => ({ frames: Number((el as HTMLCanvasElement).dataset.frames),
        revision: Number((el as HTMLCanvasElement).dataset.processedViewportRevision) }));
      // One combined width/height resize, before the long food-model journey.
      // The helper unit replay supplies deterministic stale-CSS-probe coverage.
      expectedViewport = { width: 430, height: 932 };
      await page.setViewportSize(expectedViewport);
      await waitForViewportLayout(page, expectedViewport);
      await waitForProcessedPose(page, before.frames);
      await expect(canvas).toHaveAttribute('data-suspended', 'false');
      expect(Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(before.frames);
      expect(Number(await canvas.getAttribute('data-processed-viewport-revision'))).toBeGreaterThan(before.revision);
      await expect(canvas).toHaveAttribute('data-ready', 'true');
      await expect(canvas).toHaveAttribute('data-rendered-model', 'homard');
      await expect(page.locator('.world-fallback')).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      const snapshot = await diagnosticSnapshot(page, expectedViewport);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          writeFile(testInfo.outputPath('rendered-resize-telemetry.json'), JSON.stringify({ expectedViewport, before, snapshot, errors }, null, 2)),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Early resize persistence exceeded 1s')), 1_000); }),
        ]);
      } catch (error) { console.warn('Could not preserve early resize diagnostics:', error); }
      finally { clearTimeout(timer); }
    }
  });
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
      await page.goto(`${path}?sceneDiagnostics=1`, { waitUntil: 'domcontentloaded' });
      const canvas = page.locator('.scene-canvas');
      await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
      await expect(canvas).toHaveAttribute('data-framing-ready', 'true', { timeout: 60_000 });
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
      let lastDiagnostic: Awaited<ReturnType<typeof diagnosticSnapshot>> = null;
      const saveTelemetry = async () => {
        const telemetryPath = testInfo.outputPath('rendered-scroll-telemetry.json');
        await writeFile(telemetryPath, JSON.stringify({
          renderer: 'Chromium SwiftShader; target poses sampled with reduced motion, not physical input or FPS',
          geometry, windows, phase: segment, lastDiagnostic, errors, samples: telemetry,
          units: 'World positions/look use authored Three.js units; scale and alpha are dimensionless; view offsets and text positions are normalized by canvas/stage size. Hidden pricing samples are excluded from motion speed. Root orientations use quaternion angular distance in radians; world paths are normalized independently by their own traveled length.',
        }, null, 2));
      };
      const at = async (y: number, settle = false) => {
        await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y);
        await waitForProcessedPose(page, undefined, false, { target: y, artifact: testInfo.outputPath('rendered-pending-pose-telemetry.json') });
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
            dataset: { ...data },
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
      try {
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
          segment = `screenshot:${name}`;
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
      } finally {
        // Keep the failing window too; later suites clear test-results.
        lastDiagnostic = await diagnosticSnapshot(page);
        await saveTelemetry();
      }
    });
  }
});

renderedTest.describe('complete-food zoom fit (Chromium software WebGL)', () => {
  renderedTest.skip(({ browserName }) => browserName !== 'chromium', 'SwiftShader verification uses Chromium');
  for (const [path, viewport] of [['/', { width: 1440, height: 900 }], ['/en', { width: 390, height: 844 }]] as const) {
    renderedTest(`${path} keeps every food model inside its frame while zooming, rotating and resizing`, async ({ page }, testInfo) => {
      // CI completed six desktop models while the original aggregate budget
      // expired during burger zoom polling. Retain every pose/action and the
      // 15s settle/viewport waits; only this measured whole-workload ceiling
      // grows. timeout:0 pose waits/evaluations still rely on that global cap.
      renderedTest.setTimeout(viewport.width > 768 ? 900_000 : 600_000);
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await installSceneRAFDiagnostics(page);
      // Observe native resize delivery and the real CSS viewport probes. This
      // bounded QA recorder never dispatches/retries a resize or repairs layout.
      await page.addInitScript(() => {
        const samples: unknown[] = [];
        let resizeEvents = 0, droppedSamples = 0, pendingFrame = 0;
        const snapshot = (kind: string) => {
          const input = {
            kind, at: performance.now(), innerWidth, innerHeight,
            screenWidth: screen.width, screenHeight: screen.height,
            maxTouchPoints: navigator.maxTouchPoints,
            coarseNoHover: matchMedia('(hover: none) and (pointer: coarse)').matches,
            coarsePointer: matchMedia('(pointer: coarse)').matches,
            finePointer: matchMedia('(pointer: fine)').matches,
            hover: matchMedia('(hover: hover)').matches,
          };
          // This listener is installed before production handlers. Do not force
          // style/layout here and accidentally hide a stale-probe resize race.
          if (kind === 'resize') return input;
          const root = document.documentElement;
          const style = root ? getComputedStyle(root) : null;
          return {
            ...input, clientWidth: root?.clientWidth, clientHeight: root?.clientHeight,
            probes: [...(document.body?.children ?? [])]
              .filter((element): element is HTMLElement => element instanceof HTMLElement &&
                ['100svh', '100lvh'].includes(element.style.height) && element.style.contain === 'strict')
              .map(element => ({ unit: element.style.height, rect: element.getBoundingClientRect().toJSON(), computedHeight: getComputedStyle(element).height })),
            journeyVH: style?.getPropertyValue('--vistaire-journey-vh'),
            sceneVH: style?.getPropertyValue('--vistaire-scene-vh'),
          };
        };
        const record = (kind: string) => {
          samples.push(snapshot(kind));
          if (samples.length > 20) { samples.shift(); droppedSamples++; }
        };
        addEventListener('resize', () => {
          resizeEvents++;
          record('resize');
          if (!pendingFrame) pendingFrame = requestAnimationFrame(() => {
            pendingFrame = 0;
            record('next-frame');
          });
        }, { passive: true });
        addEventListener('DOMContentLoaded', () => record('document-ready'), { once: true });
        (window as typeof window & { sceneResizeDiagnostics: { read: () => unknown } }).sceneResizeDiagnostics = {
          read: () => ({ resizeEvents, droppedSamples, samples, current: snapshot('current') }),
        };
      });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${path}?sceneDiagnostics=1`, { waitUntil: 'domcontentloaded' });
      const canvas = page.locator('.scene-canvas');
      await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
      await expect(canvas).toHaveAttribute('data-framing-ready', 'true', { timeout: 60_000 });
      await expect(canvas).toHaveAttribute('data-laptop-ready', 'true', { timeout: 60_000 });
      await expect(page.locator('.preloader')).toHaveCount(0);
      let expectedViewport: { width: number; height: number } = viewport;
      const atGrip = async (framesBeforeResize?: number) => {
        await waitForViewportLayout(page, expectedViewport);
        const target = await page.locator('#grip').evaluate(el => {
          const y = el.getBoundingClientRect().top + scrollY + ((el as HTMLElement).offsetHeight - el.firstElementChild!.clientHeight) / 2;
          scrollTo({ top: y, behavior: 'instant' });
          return y;
        });
        await waitForProcessedPose(page, framesBeforeResize, true, { target, artifact: testInfo.outputPath('rendered-pending-pose-telemetry.json') });
        await expect(canvas).toHaveAttribute('data-section', 'grip');
      };
      type Fit = { model: string | undefined; frame: { x: number; y: number; width: number; height: number }; food: { x: number; y: number; width: number; height: number } | null; scale: number; requested: number; fitted: number; meshScale: string | undefined; quaternion: string | undefined; width: number; height: number; viewport: { width: number; height: number }; canvasRect: { x: number; y: number; width: number; height: number }; dataset: Record<string, string | undefined> };
      const hullsByUrl = JSON.parse(readFileSync('public/immersive-assets/dishes/framing-hulls.json', 'utf8')).byUrl as Record<string, { id: string; vertices: [number, number, number][] }>;
      const desktopFootprints: Record<string, number> = { homard: 1.75, souffle: 1.65, huitres: 1.5, sushi: 2, 'chocolat-fume': 1.5, poutine: 1.75, burger: 1.1 };
      const samples: { scenario: string; fit: Fit; minimumFoodY?: number }[] = [];
      let phase = 'initial';
      let lastDiagnostic: Awaited<ReturnType<typeof diagnosticSnapshot>> = null;
      const artifact = testInfo.outputPath('rendered-zoom-fit-telemetry.json');
      const saveTelemetry = () => writeFile(artifact, JSON.stringify({ renderer: 'Chromium SwiftShader', phase, expectedViewport, lastDiagnostic, errors, samples }, null, 2));
      const capture = async (count = 1, reset = false) => canvas.evaluate(async (el, { count, reset }) => {
        const result = [];
        if (reset) document.querySelector<HTMLButtonElement>('.reset-dish')!.click();
        for (let i = 0; i < count; i++) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          const d = (el as HTMLCanvasElement).dataset;
          result.push({ model: d.renderedModel, frame: JSON.parse(d.focusBounds!), food: JSON.parse(d.dishBounds ?? 'null'), scale: Number(d.dishScale?.split(',')[0]), requested: Number(d.cameraDolly), fitted: Number(d.fittedZoom), meshScale: d.dishMeshScale, quaternion: d.dishQuaternion, width: el.clientWidth, height: el.clientHeight, viewport: { width: innerWidth, height: innerHeight }, canvasRect: el.getBoundingClientRect().toJSON(), dataset: { ...d } });
        }
        return result;
      }, { count, reset }) as Promise<Fit[]>;
      const check = (fit: Fit, scenario: string) => {
        const sample: { scenario: string; fit: Fit; minimumFoodY?: number } = { scenario, fit };
        samples.push(sample);
        if (!fit.food) {
          expect(scenario.startsWith('chapter-handoff:'), 'only an outgoing dish may disappear').toBe(true);
          expect(fit.scale).toBeLessThan(0.003);
          return;
        }
        const hull = fit.model === 'homard'
          ? hullsByUrl[viewport.width < 768 ? '/media/homard-mobile.glb' : '/media/homard.glb']
          : Object.values(hullsByUrl).find(hull => hull.id === fit.model)!;
        expect(hull, `${scenario}: actual shipped food hull`).toBeDefined();
        const displayScale = fit.width < 768 ? (fit.model === 'burger' ? 0.55 : 1) : desktopFootprints[fit.model!] / 2.35;
        const positionY = Number(fit.dataset.dishPosition!.split(',')[1]);
        const [scaleX, scaleY, scaleZ] = fit.dataset.dishScale!.split(',').map(value => Number(value) * displayScale);
        const [qx, qy, qz, qw] = fit.quaternion!.split(',').map(Number);
        // Independently transform each shipped vertex with the captured pose:
        // scale, rotate by the unit quaternion, then translate into world Y.
        sample.minimumFoodY = Math.min(...hull.vertices.map(([x, y, z]) =>
          positionY + 2 * (qx * qy + qw * qz) * x * scaleX
            + (1 - 2 * (qx * qx + qz * qz)) * y * scaleY
            + 2 * (qy * qz - qw * qx) * z * scaleZ));
        expect(sample.minimumFoodY, `${scenario}: food remains above the opaque tabletop`).toBeGreaterThanOrEqual(-0.02 - 1e-5);
        expect(fit.food.x, `${scenario}: left`).toBeGreaterThanOrEqual(fit.frame.x - 2);
        expect(fit.food.y, `${scenario}: top`).toBeGreaterThanOrEqual(fit.frame.y - 2);
        expect(fit.food.x + fit.food.width, `${scenario}: right`).toBeLessThanOrEqual(fit.frame.x + fit.frame.width + 2);
        expect(fit.food.y + fit.food.height, `${scenario}: bottom`).toBeLessThanOrEqual(fit.frame.y + fit.frame.height + 2);
        if (!scenario.startsWith('chapter-handoff:')) {
          expect(fit.viewport, `${scenario}: requested viewport is current`).toEqual(expectedViewport);
          const scaleX = fit.canvasRect.width / fit.width;
          const scaleY = fit.canvasRect.height / fit.height;
          expect(fit.canvasRect.x + fit.food.x * scaleX, `${scenario}: viewport left`).toBeGreaterThanOrEqual(-2);
          expect(fit.canvasRect.y + fit.food.y * scaleY, `${scenario}: viewport top`).toBeGreaterThanOrEqual(-2);
          expect(fit.canvasRect.x + (fit.food.x + fit.food.width) * scaleX, `${scenario}: viewport right`).toBeLessThanOrEqual(fit.viewport.width + 2);
          expect(fit.canvasRect.y + (fit.food.y + fit.food.height) * scaleY, `${scenario}: viewport bottom`).toBeLessThanOrEqual(fit.viewport.height + 2);
          expect(fit.frame.height, `${scenario}: meaningful food frame`).toBeGreaterThanOrEqual(120);
          expect(fit.food.height, `${scenario}: food remains visible`).toBeGreaterThan(12);
          expect(fit.food.width, `${scenario}: food remains visible`).toBeGreaterThan(12);
        }
        expect(fit.fitted).toBeGreaterThan(0);
        expect(fit.fitted).toBeLessThanOrEqual(fit.requested + 0.02);
      };
      try {
        phase = 'initial-grip';
        await atGrip();
        for (const id of ['homard', 'souffle', 'huitres', 'sushi', 'chocolat-fume', 'poutine', 'burger']) {
          phase = `${id}:selection`;
          await page.locator(`.dish-switch [data-dish-id="${id}"]`).click();
          await expect(canvas).toHaveAttribute('data-rendered-model', id, { timeout: 90_000 });
          await atGrip();
          const meshScale = await canvas.getAttribute('data-dish-mesh-scale');
          // Exercise the actual button handlers; batch requests before a frame
          // so the fit cap, rather than repeated disabled clicks, is tested.
          phase = `${id}:maximum`;
          await page.locator('.dish-zoom button').nth(1).evaluate(el => {
            for (let i = 0; i < 15; i++) (el as HTMLButtonElement).click();
          });
          await expect.poll(async () => Number(await canvas.getAttribute('data-camera-dolly'))).toBeCloseTo(4, 2);
          await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
          for (const fit of await capture()) check(fit, `${id}:maximum`);
          expect(await canvas.getAttribute('data-dish-mesh-scale')).toBe(meshScale);
          phase = `${id}:damped-rotation`;
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
          phase = `${id}:home-settle`;
          await page.locator('.rotation-range').focus();
          await page.keyboard.press('Home'); // yaw −π, the reproduced reset case
          await expect(page.locator('.rotation-range')).toHaveAttribute('aria-valuenow', '0');
          await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
          phase = `${id}:damped-reset`;
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
          phase = `resize:${size.width}x${size.height}`;
          const framesBeforeResize = Number(await canvas.getAttribute('data-frames'));
          expectedViewport = size;
          await page.setViewportSize(size);
          await atGrip(framesBeforeResize);
          for (const fit of await capture()) check(fit, `resize:${size.width}x${size.height}`);
        }
        const window = await page.locator('#grip').evaluate(el => ({ start: Number((el as HTMLElement).dataset.exitStart), end: Number((el as HTMLElement).dataset.exitEnd) }));
        for (const fraction of [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) {
          phase = `chapter-handoff:${fraction}`;
          const target = window.start + (window.end - window.start) * fraction;
          await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), target);
          await waitForProcessedPose(page, undefined, false, { target, artifact: testInfo.outputPath('rendered-pending-pose-telemetry.json') });
          for (const fit of await capture()) check(fit, `chapter-handoff:${fraction}`);
        }
        await saveTelemetry();
        await testInfo.attach('zoom-fit-telemetry', { path: artifact, contentType: 'application/json' });
        expect(errors).toEqual([]);
      } finally {
        // Preserve the violating fit or last completed pose on assertions/timeouts.
        lastDiagnostic = await diagnosticSnapshot(page, expectedViewport);
        await saveTelemetry();
      }
    });
  }
});
