import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { zeroScaleEquivalentPoses } from './support/restaurant-capture-invariants.mjs';
// @ts-expect-error -- use the same authored timing as the runtime, not copied scroll constants.
import { CINEMATIC_TIMING } from '../components/immersive/SceneDirector.js';
// @ts-expect-error -- use the runtime's authored normal-motion hand-entry distance.
import { PRICING_ENTRY_VIEWPORTS } from '../components/immersive/PricingPhoneLayout.js';

// Isolated correctness experiment. This does not activate the candidate and is
// deliberately separate from the identical-assets performance benchmark.
const profiles: { id: string; width: number; height: number; touch: boolean; resize?: { width: number; height: number } }[] = [
  { id: 'phone', width: 390, height: 844, touch: true },
  { id: 'phone430', width: 390, height: 844, resize: { width: 430, height: 932 }, touch: true },
  { id: 'phoneLandscape', width: 390, height: 844, resize: { width: 844, height: 390 }, touch: true },
  { id: 'desktop', width: 1440, height: 900, touch: false },
  { id: 'desktop1337', width: 1440, height: 900, resize: { width: 1337, height: 591 }, touch: false },
  { id: 'wide', width: 2560, height: 720, touch: false },
  { id: 'wide3440', width: 2560, height: 720, resize: { width: 3440, height: 1440 }, touch: false },
];
const selected = process.env.VISTAIRE_RESTAURANT_AB_PROFILE;
if (selected && !profiles.some(profile => profile.id === selected)) throw new Error('Unknown restaurant A/B profile');
const comparisonMode = process.env.VISTAIRE_RESTAURANT_AB_MODE ?? 'asset';
if (!['asset', 'guarded-index'].includes(comparisonMode)) throw new Error('Unknown restaurant A/B mode');
const guardedIndex = comparisonMode === 'guarded-index';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const assetPath = '/immersive-assets/restaurant/restaurant-visible-59412334.glb';
const source = readFileSync(`public${assetPath}`);
// Run the native ESM generator, outside Playwright's CommonJS source transform.
const candidate = { bytes: guardedIndex ? source : execFileSync(process.execPath,
  ['scripts/3d/prune-restaurant-offscreen-experiment.mjs', '--stdout'], { maxBuffer: 4 * 1024 * 1024 }) };
expect(hash(source)).toBe('594123340aa71cf74cb0e83c69b966c399230fc03e2188ed5cb80931d05f4f66');
expect(hash(candidate.bytes)).toBe(guardedIndex ? hash(source) : 'e92a37f1eafc320091ef6ed3764f3552e82e3c443a1cf25f5965a4b400cbaf6f');
const requestedLaptop = new WeakSet<Page>();
const rendered = test.extend({
  launchOptions: async ({}, provideOptions) => { await provideOptions({ args: ['--use-angle=swiftshader', '--use-gl=angle'] }); },
});

type Waypoint = { label: string; y: number; section?: string; transition?: string; fraction?: number; openingProgress?: number; cached?: boolean; pricingActive?: boolean; handProgress?: number; visibleSelector?: string };
type MediaWindow = Window & { restaurantABMedia?: HTMLMediaElement[] };
async function freezeDecodedVideo(page: Page) {
  await page.addInitScript(() => {
    const media: HTMLMediaElement[] = [];
    (window as MediaWindow).restaurantABMedia = media;
    const pending = new WeakMap<HTMLMediaElement, { src: string; promise: Promise<void> }>();
    HTMLMediaElement.prototype.play = function () {
      const previous = pending.get(this);
      if (previous?.src === this.src) return previous.promise;
      if (!media.includes(this)) media.push(this);
      const promise = (async (video: HTMLMediaElement) => {
        video.pause();
        video.preload = 'auto';
        const wait = (event: string) => new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`A/B media ${event} timeout`)), 30_000);
          video.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
        });
        if (video.readyState < 1) {
          const loaded = wait('loadedmetadata');
          video.load();
          await loaded;
        }
        const seeked = wait('seeked');
        video.currentTime = 0.25;
        await seeked;
        if (video.readyState < 2) await wait('loadeddata');
        video.pause();
      })(this);
      pending.set(this, { src: this.src, promise });
      return promise;
    };
  });
}

async function samplePlan(page: Page) {
  return page.evaluate(({ timing, entryViewports }) => {
    const opening = document.querySelector<HTMLElement>('.opening-journey')!;
    const top = opening.getBoundingClientRect().top + scrollY;
    const stage = Number.parseFloat(getComputedStyle(opening.firstElementChild!).height);
    const leg = stage * timing.transitionScreens;
    const hold = stage * timing.aiHoldScreens;
    const max = document.documentElement.scrollHeight - innerHeight;
    const points: Waypoint[] = [
      { label: 'hero-hold', y: top, section: 'hero', openingProgress: 0 },
      { label: 'ai-hold', y: top + leg + hold / 2, section: 'ai', openingProgress: 0.5 },
      { label: 'wearable-hold', y: top + leg * 2 + hold, section: 'wearable', openingProgress: 1 },
    ];
    for (const [from, start] of [['hero-ai', top], ['ai-wearable', top + leg + hold]] as const)
      for (const fraction of [0.25, 0.5, 0.75]) points.push({ label: `${from}-${fraction}`, y: start + leg * fraction, openingProgress: (from === 'hero-ai' ? 0 : 0.5) + fraction / 2 });
    for (const chapter of document.querySelectorAll<HTMLElement>('.chapter')) {
      if (['hero', 'ai', 'wearable'].includes(chapter.id)) continue;
      const bounds = chapter.getBoundingClientRect();
      const stageHeight = chapter.firstElementChild?.getBoundingClientRect().height ?? innerHeight;
      points.push({ label: `${chapter.id}-hold`, y: bounds.top + scrollY + Math.max(0, bounds.height - stageHeight) / 2, section: chapter.id });
      if (chapter.dataset.exitStart) for (const fraction of [0.25, 0.5, 0.75]) {
        const start = Number(chapter.dataset.exitStart), end = Number(chapter.dataset.exitEnd);
        points.push({ label: `${chapter.id}-${chapter.dataset.exitTo}-${fraction}`, y: start + (end - start) * fraction, transition: `${chapter.id}:${chapter.dataset.exitTo}`, fraction });
      }
    }
    // The opening wearable chapter also owns the first external join.
    const wearable = document.querySelector<HTMLElement>('#wearable')!;
    if (wearable.dataset.exitStart) for (const fraction of [0.25, 0.5, 0.75]) {
      const start = Number(wearable.dataset.exitStart), end = Number(wearable.dataset.exitEnd);
      points.push({ label: `wearable-${wearable.dataset.exitTo}-${fraction}`, y: start + (end - start) * fraction, transition: `wearable:${wearable.dataset.exitTo}`, fraction });
    }
    const pricing = document.querySelector<HTMLElement>('#open-weight')!;
    const intro = document.querySelector<HTMLElement>('.pricing-hero')!;
    const visual = document.querySelector<HTMLElement>('.pricing-hand-visual')!;
    const faq = document.querySelector<HTMLElement>('.landing-faq')!;
    const pricingTop = pricing.getBoundingClientRect().top + scrollY;
    const introEnd = intro.getBoundingClientRect().bottom + scrollY;
    const entry = visual.clientHeight * entryViewports;
    Object.assign(points.find(point => point.label === 'open-weight-hold')!, {
      y: pricingTop + entry + visual.clientHeight * 0.2, cached: true, pricingActive: true, handProgress: 1,
    });
    points.push({ label: 'pricing-entry', y: pricingTop + 1, section: 'open-weight', cached: true, pricingActive: true });
    for (const fraction of [0.25, 0.5, 0.75]) points.push({ label: `pricing-hand-${fraction}`,
      y: pricingTop + entry * fraction, section: 'open-weight', cached: true, pricingActive: true, handProgress: fraction });
    points.push({ label: 'pricing-exit-half', y: introEnd - visual.clientHeight * 0.5,
      section: 'open-weight', cached: true, pricingActive: true, handProgress: 1 });
    points.push({ label: 'faq-room', y: faq.getBoundingClientRect().top + scrollY + 1,
      section: 'open-weight', cached: true, pricingActive: false, visibleSelector: '.landing-faq' });
    const footerTop = document.querySelector<HTMLElement>('#footer')!.getBoundingClientRect().top + scrollY;
    Object.assign(points.find(point => point.label === 'footer-hold')!, {
      // A compact desktop footer can be visible before its top reaches scrollY.
      section: Math.min(max, footerTop) >= footerTop - 1 ? 'footer' : 'open-weight',
      cached: true, pricingActive: false, visibleSelector: '#footer',
    });
    return points.map(point => ({ ...point, y: Math.round(Math.min(max, Math.max(0, point.y))) })).sort((a, b) => a.y - b.y);
  }, { timing: CINEMATIC_TIMING, entryViewports: PRICING_ENTRY_VIEWPORTS });
}

async function waitForRenderedReady(page: Page, timeout = 60_000) {
  await page.waitForFunction(entryViewports => {
    const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas');
    const opening = document.querySelector<HTMLElement>('.opening-journey');
    if (!canvas || !opening) return false;
    const d = canvas.dataset;
    const stage = Number.parseFloat(getComputedStyle(opening.firstElementChild!).height);
    const openingTop = opening.getBoundingClientRect().top + scrollY;
    const distance = Math.max(0, (scrollY - openingTop) / stage);
    const decoded = ((window as MediaWindow).restaurantABMedia ?? []).every(video => video.paused && !video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - 0.25) < 0.001);
    const pricingTop = document.querySelector<HTMLElement>('#open-weight')!.getBoundingClientRect().top + scrollY;
    const lowerPage = scrollY >= pricingTop;
    const intro = document.querySelector<HTMLElement>('.pricing-hero')!;
    const visual = document.querySelector<HTMLElement>('.pricing-hand-visual')!;
    const handVisible = intro.getBoundingClientRect().bottom > 0;
    const handProgress = Math.min(1, Math.max(0, (scrollY - pricingTop) / (visual.clientHeight * entryViewports)));
    const cachedReady = d.pricingBackdrop === 'ready' && Number(d.pricingBackdropGeneration) > 0 &&
      d.pricingBackdropPose?.startsWith('pricing-entry:') &&
      Number(d.pricingBackdropWidth) === canvas.width && Number(d.pricingBackdropHeight) === canvas.height &&
      (handVisible ? d.pricingActive === 'true' && visual.dataset.handReady === 'true' &&
        d.pricingHand === 'fair-photo-shared-3d-phone' && Math.abs(Number(d.pricingHandProgress) - handProgress) < 1e-6
        : d.pricingActive === 'false' && d.suspended === 'true');
    return (!lowerPage || cachedReady) && !d.loadingModel && !d.modelError && d.ready === 'true' && d.framingReady === 'true' && decoded &&
      Math.abs(Number(d.processedScrollDistance) - distance) < 1e-6 &&
      d.processedViewportRevision === d.viewportResizes &&
      Number(d.processedViewportWidth) === canvas.clientWidth && Number(d.processedViewportHeight) === canvas.clientHeight &&
      (d.suspended === 'true' || d.settled === 'true') &&
      (d.section !== 'sustainability' && !d.transition?.includes('sustainability') || d.laptopReady === 'true');
  }, PRICING_ENTRY_VIEWPORTS, { timeout });
}

async function at(page: Page, y: number) {
  const readyDeadline = Date.now() + 60_000;
  await page.evaluate(target => scrollTo({ top: target, behavior: 'instant' }), y);
  await waitForRenderedReady(page);
  // Do not force a hero/catalogue preload. If the normal nearby laptop request
  // already began, let it finish before preparing the exact capture pose.
  if (requestedLaptop.has(page)) {
    const remaining = () => {
      const budget = readyDeadline - Date.now();
      expect(budget, 'original resource-readiness deadline').toBeGreaterThan(0);
      return budget;
    };
    await expect(page.locator('.scene-canvas')).toHaveAttribute('data-laptop-ready', 'true', { timeout: remaining() });
    await waitForRenderedReady(page, remaining());
  }
  const rendered = await page.locator('.scene-canvas').evaluate(element => ({
    frames: Number((element as HTMLCanvasElement).dataset.frames),
    distance: Number((element as HTMLCanvasElement).dataset.processedScrollDistance),
    scroll: scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight,
    cached: (element as HTMLCanvasElement).dataset.pricingBackdrop === 'ready',
  }));
  if (!rendered.cached) {
    // A seeked event can publish ready media just before its next texture upload.
    // A same-position synthetic redraw uses damped quaternion interpolation,
    // whose last bit depends on frame history. A real nudge and exact return
    // instead use the production scroll pose (damping=1), with no tolerance.
    const nudge = rendered.scroll > 0 ? rendered.scroll - 1 : Math.min(1, rendered.maxScroll);
    expect(nudge, 'a distinct in-range production scroll position').not.toBe(rendered.scroll);
    await page.evaluate(target => scrollTo({ top: target, behavior: 'instant' }), nudge);
    await waitForRenderedReady(page);
    await page.waitForFunction(previous => {
      const d = document.querySelector<HTMLCanvasElement>('.scene-canvas')!.dataset;
      return scrollY === previous.y && Number(d.frames) > previous.frames &&
        Number(d.processedScrollDistance) !== previous.distance && d.pricingBackdrop !== 'ready';
    }, { y: nudge, frames: rendered.frames, distance: rendered.distance }, { timeout: 30_000 });
    const nudgedFrame = await page.locator('.scene-canvas').evaluate(element => Number((element as HTMLCanvasElement).dataset.frames));
    await page.evaluate(target => scrollTo({ top: target, behavior: 'instant' }), rendered.scroll);
    await waitForRenderedReady(page);
    await page.waitForFunction(previous => {
      const d = document.querySelector<HTMLCanvasElement>('.scene-canvas')!.dataset;
      return scrollY === previous.y && Number(d.frames) > previous.frames &&
        Number(d.processedScrollDistance) === previous.distance && d.pricingBackdrop !== 'ready';
    }, { y: rendered.scroll, frames: nudgedFrame, distance: rendered.distance }, { timeout: 30_000 });
  }
  return readRenderedState(page);
}

async function readRenderedState(page: Page) {
  return page.locator('.scene-canvas').evaluate(element => {
    const canvas = element as HTMLCanvasElement & { restaurantIndexCrop?: {
      state: string; reason: string; removedTriangles: number; backupBytes: number;
      roomDraws: number; croppedRoomDraws: number; restoreUploadBytes: number;
    } }, d = canvas.dataset;
    const gl = canvas.getContext('webgl2')!;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const pose = Object.fromEntries(['section', 'progress', 'transition', 'transitionProgress', 'openingProgress',
      'fittedCameraPosition', 'fittedLook', 'cameraViewOffset', 'cameraFov', 'cameraZoom',
      'atmosphere', 'roomPosition', 'roomYaw', 'restaurantAnchor', 'restaurantAnchorYaw',
      'renderedModel', 'support', 'phoneDemo', 'dishOpacity', 'supportAngle', 'cameraDolly', 'zoomMax',
      ...['dish', 'phone', 'support', 'laptop'].flatMap(name => ['Position', 'Scale', 'Quaternion'].map(key => name + key))]
      .map(key => [key, d[key] ?? '']));
    const world = document.querySelector<HTMLElement>('.world')!;
    const cache = d.pricingBackdrop === 'ready' ? {
      pose: d.pricingBackdropPose, generation: Number(d.pricingBackdropGeneration),
      width: Number(d.pricingBackdropWidth), height: Number(d.pricingBackdropHeight), theme: d.pricingBackdropTheme,
    } : null;
    const rect = canvas.getBoundingClientRect();
    return { pose, cache, crop: canvas.restaurantIndexCrop ? { ...canvas.restaurantIndexCrop,
      installed: d.restaurantCrop, setupReason: d.restaurantCropReason ?? '' } : null,
      documentTheme: document.documentElement.dataset.vistaireTheme === 'light' ? 'light' : 'dark',
      layout: { viewport: [innerWidth, innerHeight], world: [world.clientWidth, world.clientHeight],
        canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } },
      framing: Object.fromEntries(['focusBounds', 'cameraBaselineDistance', 'cameraDistance', 'fittedZoom',
        'zoomFitLimited', 'dishTableRatio', 'model', 'supportReady', 'phoneReady', 'laptopReady',
        'processedViewportWidth', 'processedViewportHeight', 'processedViewportRevision', 'viewportResizes']
        .map(key => [key, d[key] ?? ''])),
      timeline: { transition: world.dataset.transition ?? '', transitionProgress: Number(world.dataset.transitionProgress) },
      pricing: { active: d.pricingActive === 'true', handProgress: Number(d.pricingHandProgress) },
      suspended: d.suspended === 'true', frames: Number(d.frames), scroll: scrollY, scrollX,
      lastRenderCounters: { frame: Number(d.frames), mode: cache ? (d.suspended === 'true' ? 'cached-room-idle' : 'cached-room-hand') : 'cinematic',
        drawCalls: d.suspended === 'true' ? null : Number(d.drawCalls),
        triangles: d.suspended === 'true' ? null : Number(d.triangles),
        cpuSubmissionMs: cache ? null : Number(d.renderCPUms),
        shadowUpdated: cache ? null : d.shadowUpdated === 'true' },
      renderer: { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
        drawingBuffer: [canvas.width, canvas.height], dpr: devicePixelRatio, normalMotion: !matchMedia('(prefers-reduced-motion: reduce)').matches },
      media: ((window as MediaWindow).restaurantABMedia ?? []).map(video => ({ src: new URL(video.src).pathname, currentTime: video.currentTime, readyState: video.readyState, paused: video.paused })) };
  });
}

function captureIdentity(state: Awaited<ReturnType<typeof readRenderedState>>) {
  // Frame IDs are compared within each page, never between A/B contexts.
  // A new draw during capture would make its exact pixel/pose pairing ambiguous.
  return { pose: state.pose, cache: state.cache, crop: state.crop, documentTheme: state.documentTheme,
    framing: state.framing, timeline: state.timeline, pricing: state.pricing,
    suspended: state.suspended, frames: state.frames, scroll: state.scroll, scrollX: state.scrollX,
    layout: state.layout, renderer: state.renderer,
    media: state.media };
}

for (const profile of profiles.filter(profile => !selected || profile.id === selected)) {
  rendered(`restaurant spatial candidate pixel A/B ${profile.id}`, async ({ browser, browserName }, testInfo) => {
    rendered.setTimeout(20 * 60_000);
    expect(browserName).toBe('chromium');
    const contexts = await Promise.all([0, 1].map(() => browser.newContext({ baseURL: testInfo.project.use.baseURL,
      viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1, hasTouch: profile.touch,
      reducedMotion: 'no-preference', locale: 'fr-CA', timezoneId: 'America/Toronto' })));
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    const evidence: unknown[] = [];
    const errors: string[] = [];
    const requests = [0, 0];
    let complete = false;
    let phase = 'initializing';
    let layoutEvidence: unknown = null;
    try {
      for (const [index, page] of pages.entries()) {
        await freezeDecodedVideo(page);
        page.on('pageerror', error => errors.push(`${index}: ${error.message}`));
        page.on('request', request => {
          if (new URL(request.url()).pathname.endsWith('/macbook.glb')) requestedLaptop.add(page);
        });
        page.on('response', response => {
          const path = new URL(response.url()).pathname;
          if (/^\/(immersive-assets|videos)\//.test(path) && response.status() >= 400)
            errors.push(`${index}: ${response.status()} ${path}`);
        });
        await page.route(`**${assetPath}`, async route => {
          requests[index]++;
          await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: index ? candidate.bytes : source });
        });
        await page.goto(`/?sceneDiagnostics=1${guardedIndex && index === 1 ? '&restaurantCrop=guarded' : ''}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.scene-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
        await expect(page.locator('.scene-canvas')).toHaveAttribute('data-framing-ready', 'true', { timeout: 60_000 });
        if (guardedIndex && index === 1)
          await expect(page.locator('.scene-canvas')).toHaveAttribute('data-restaurant-crop', 'installed', { timeout: 60_000 });
        await page.evaluate(() => document.fonts.ready);
        // Preserve layout, remove DOM occlusion from canvas-only comparison.
        await page.addStyleTag({ content: 'body * { visibility: hidden !important } .scene-canvas { visibility: visible !important }' });
        await at(page, 1); // Ensure the first hero sample is a real timeline change.
      }
      if (profile.resize) {
        await Promise.all(pages.map(page => page.setViewportSize(profile.resize!)));
        await Promise.all(pages.map(page => at(page, 0)));
      }
      const layouts = await Promise.all(pages.map(page => page.evaluate(() => {
        const world = document.querySelector<HTMLElement>('.world')!;
        const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas')!;
        return { viewport: [innerWidth, innerHeight], world: [world.clientWidth, world.clientHeight],
          canvas: [canvas.clientWidth, canvas.clientHeight],
          sceneFrames: Object.fromEntries([...document.querySelectorAll<HTMLElement>('.chapter')].map(chapter => {
            const focus = chapter.querySelector<HTMLElement>('.scene-focus');
            if (!focus) return [chapter.id, null];
            const r = focus.getBoundingClientRect(), stage = chapter.firstElementChild!.getBoundingClientRect();
            return [chapter.id, { x: (r.left + r.width / 2) / innerWidth,
              y: (r.top - stage.top + r.height / 2) / world.clientHeight,
              width: r.width / innerWidth, height: r.height / world.clientHeight }];
          })),
        };
      })));
      expect(layouts[1], 'same measured calibration frames').toEqual(layouts[0]);
      layoutEvidence = layouts[0];
      const canonicalPoses = new Map<string, string>();
      const compare = async (label: string, y: number, expected?: Partial<Waypoint>) => {
        phase = label;
        const states = await Promise.all(pages.map(page => at(page, y)));
        const sample = { label, y, expected, states };
        evidence.push(sample); // Retain both poses even when a guard fails before pixel capture.
        expect(states[1].renderer, `${label}: renderer/buffer`).toEqual(states[0].renderer);
        expect(states[1].layout, `${label}: canvas and viewport geometry`).toEqual(states[0].layout);
        expect(states[0].renderer.normalMotion).toBe(true);
        expect(states[0].renderer.renderer).toContain('SwiftShader');
        const renderedPoses = zeroScaleEquivalentPoses(states[0].pose, states[1].pose);
        Object.assign(sample, { zeroScaleMatrices: renderedPoses.map(value => value.zeroScaleMatrices) });
        expect(renderedPoses[1], `${label}: exact rendered camera/scene transform`).toEqual(renderedPoses[0]);
        if (guardedIndex) {
          expect(states[0].crop, `${label}: query-off remains untouched`).toBeNull();
          expect(states[1].crop?.installed).toBe('installed');
          expect(['cropped', 'full']).toContain(states[1].crop?.state);
          expect(states[1].crop?.removedTriangles).toBe(19_150);
          expect(states[1].crop?.backupBytes).toBe(261_678);
        }
        expect(states[1].cache, `${label}: canonical cache pose/generation/buffer/theme`).toEqual(states[0].cache);
        expect(states[1].timeline, `${label}: actual document timeline`).toEqual(states[0].timeline);
        if (states[0].cache) {
          const [prefix, values, background] = states[0].cache.pose!.split(':');
          expect(prefix).toBe('pricing-entry');
          const numbers = values.split(',').map(Number);
          expect(numbers).toHaveLength(23); // position3 + quaternion4 + projection16
          expect(numbers.every(Number.isFinite)).toBe(true);
          expect(background).toMatch(/^[0-9a-f]{6}$/);
          for (const state of states) expect(state.cache!.theme).toBe(state.documentTheme);
          const key = JSON.stringify([states[0].renderer.drawingBuffer, states[0].pose.renderedModel,
            states[0].pose.support, states[0].documentTheme]);
          if (canonicalPoses.has(key)) expect(states[0].cache.pose, `${label}: same canonical entry on forward/reverse/direct access`).toBe(canonicalPoses.get(key));
          else canonicalPoses.set(key, states[0].cache.pose!);
          expect(states[0].cache.generation).toBeGreaterThan(0);
          expect([states[0].cache.width, states[0].cache.height]).toEqual(states[0].renderer.drawingBuffer);
          expect(states[1].pricing, `${label}: rendered pricing hand state`).toEqual(states[0].pricing);
        }
        if (expected?.cached) expect(states[0].cache, `${label}: actual visible room cache required`).not.toBeNull();
        if (expected?.pricingActive != null) expect(states[0].pricing.active).toBe(expected.pricingActive);
        if (expected?.handProgress != null) expect(states[0].pricing.handProgress).toBeCloseTo(expected.handProgress, 2);
        if (expected?.visibleSelector) expect(await pages[0].locator(expected.visibleSelector).evaluate(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.bottom > 0 && bounds.top < innerHeight;
        }), `${label}: named lower-page content in viewport`).toBe(true);
        if (expected?.section) expect(states[0].pose.section, `${label}: actual chapter`).toBe(expected.section);
        if (expected?.transition) {
          expect(states[0].timeline.transition, `${label}: actual join`).toBe(expected.transition);
          expect(states[0].timeline.transitionProgress).toBeCloseTo(expected.fraction!, 2);
        }
        if (expected?.openingProgress != null)
          expect(Number(states[0].pose.openingProgress), `${label}: opening pose`).toBeCloseTo(expected.openingProgress, 2);
        if (label.endsWith('zoom-0.6')) expect(Number(states[0].pose.cameraDolly)).toBeCloseTo(0.6, 6);
        if (label.endsWith('-reset')) expect(Number(states[0].pose.cameraDolly)).toBeCloseTo(1, 6);
        if (label.endsWith('close-up-max')) {
          expect(Number(states[0].pose.zoomMax)).toBeGreaterThan(1);
          expect(Number(states[0].pose.cameraDolly)).toBeCloseTo(Number(states[0].pose.zoomMax), 6);
        }
        expect(states[1].suspended, `${label}: occlusion`).toBe(states[0].suspended);
        if (states[0].suspended) expect(states[0].cache, `${label}: suspension must retain a ready visible room`).not.toBeNull();
        // Offers, FAQ and footer remain visible even when the renderer is idle.
        // Every sample, including a cached/suspended one, must pass pixel parity.
        // Element screenshots auto-scroll and wait for utility-world RAF
        // stability, which stalled on both wide profiles after actual-ready
        // guards passed. Capture the verified fixed viewport rectangle without
        // moving the page; independently guard geometry and pose on both sides.
        const beforeCapture = await Promise.all(pages.map(readRenderedState));
        const capture = { bounds: beforeCapture.map(state => state.layout.canvas),
          beforeFrames: beforeCapture.map(state => state.frames), afterFrames: [] as number[],
          stages: [] as { page: number; stage: string; elapsedMs: number; hidden?: boolean }[] };
        Object.assign(sample, { capture });
        try {
          for (const [index, state] of beforeCapture.entries()) {
            expect(captureIdentity(state), `${label}: stable before capture ${index}`).toEqual(captureIdentity(states[index]));
            expect(Object.values(state.layout.canvas).every(Number.isFinite), `${label}: finite capture rectangle`).toBe(true);
            expect(state.layout.canvas.width).toBeGreaterThan(0);
            expect(state.layout.canvas.height).toBeGreaterThan(0);
            expect(state.renderer.dpr).toBe(1);
            expect(state.layout.canvas, `${label}: complete fixed canvas in viewport`).toEqual({
              x: 0, y: 0, width: state.layout.viewport[0], height: state.layout.viewport[1],
            });
          }
        } catch (error) {
          Object.assign(sample, { beforeCapture });
          throw error;
        }
        const screenshots: Buffer[] = [];
        const afterCapture: Awaited<ReturnType<typeof readRenderedState>>[] = [];
        const captureStarted = Date.now();
        const recordCapture = (page: number, stage: string, hidden?: boolean) =>
          capture.stages.push({ page, stage, elapsedMs: Date.now() - captureStarted, hidden });
        const retainScreenshots = async () => {
          Object.assign(sample, { screenshotHashes: screenshots.map(hash) });
          for (const [index, screenshot] of screenshots.entries()) {
            const name = `${label}-${index ? 'candidate' : 'baseline'}.png`;
            const path = testInfo.outputPath(name);
            // Reporter-only body attachments were absent from the first ZIPs.
            await writeFile(path, screenshot);
            await testInfo.attach(name, { path, contentType: 'image/png' });
          }
        };
        // Both contexts share a software-rendering browser. Do not issue two
        // compositor captures concurrently. Foregrounding is preparation, not
        // permission to accept a changed pose or frame. A single pair deadline
        // retains the former concurrent captures' maximum wall-time budget.
        try {
          await rendered.step(`${label}: serial foreground capture`, async () => {
            for (const [index, page] of pages.entries()) {
              recordCapture(index, 'foreground-start');
              await page.bringToFront();
              recordCapture(index, 'foreground-ready', await page.evaluate(() => document.hidden));
              const foreground = await readRenderedState(page);
              expect(captureIdentity(foreground), `${label}: foreground preserves capture state ${index}`)
                .toEqual(captureIdentity(beforeCapture[index]));
              const remaining = 30_000 - (Date.now() - captureStarted);
              expect(remaining, `${label}: shared capture budget`).toBeGreaterThan(0);
              recordCapture(index, 'screenshot-start');
              screenshots.push(await page.screenshot({
                fullPage: false, clip: beforeCapture[index].layout.canvas, timeout: remaining,
              }));
              recordCapture(index, 'screenshot-complete');
              afterCapture.push(await readRenderedState(page));
              capture.afterFrames.push(afterCapture[index].frames);
            }
          }, { timeout: 30_000 });
        } catch (error) {
          Object.assign(sample, { beforeCapture, afterCapture });
          // Preserve any completed first image if the second capture fails.
          // Evidence I/O has its own bound; never retry or extend capture time.
          await rendered.step(`${label}: retain partial capture`, retainScreenshots, { timeout: 5_000 })
            .catch(retentionError => Object.assign(sample, { captureRetentionError: String(retentionError) }));
          throw error;
        }
        try {
          for (const [index, state] of afterCapture.entries()) {
            expect(captureIdentity(state), `${label}: stable through capture ${index}`).toEqual(captureIdentity(beforeCapture[index]));
            expect(state.media.every(video => video.readyState >= 2), `${label}: decoded media retained`).toBe(true);
          }
        } catch (error) {
          Object.assign(sample, { beforeCapture, afterCapture }); // Full mismatch evidence only when needed.
          await retainScreenshots();
          throw error;
        }
        const pixels = await Promise.all(screenshots.map(png => sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
        expect(pixels[1].info).toEqual(pixels[0].info);
        expect([pixels[0].info.width, pixels[0].info.height], `${label}: complete CSS-pixel capture`).toEqual([
          beforeCapture[0].layout.canvas.width, beforeCapture[0].layout.canvas.height,
        ]);
        let changedPixels = 0, maxChannelDifference = 0;
        for (let i = 0; i < pixels[0].data.length; i += 3) {
          let changed = false;
          for (let c = 0; c < 3; c++) {
            const diff = Math.abs(pixels[0].data[i + c] - pixels[1].data[i + c]);
            changed ||= diff > 0; maxChannelDifference = Math.max(maxChannelDifference, diff);
          }
          if (changed) changedPixels++;
        }
        Object.assign(sample, { changedPixels, maxChannelDifference, pixelHashes: pixels.map(pixel => hash(pixel.data)) });
        if (changedPixels || ['forward-hero-hold', 'forward-encryption-grip-0.5', 'forward-open-weight-hold', 'forward-faq-room', 'forward-footer-hold'].includes(label))
          await retainScreenshots();
        expect(changedPixels, `${label}: candidate must be pixel-identical at the matched pose`).toBe(0);
      };
      const plans = await Promise.all(pages.map(samplePlan));
      expect(plans[1]).toEqual(plans[0]);
      expect(plans[0].filter(point => point.label.endsWith('-hold'))).toHaveLength(12);
      expect(plans[0].filter(point => point.label.endsWith('-0.5') && !point.label.startsWith('pricing-hand-'))).toHaveLength(11);
      expect(plans[0].filter(point => point.cached)).toHaveLength(8);
      for (const direction of ['forward', 'reverse'] as const)
        for (const point of direction === 'forward' ? plans[0] : [...plans[0]].reverse())
          await compare(`${direction}-${point.label}`, point.y, point);
      const grip = plans[0].find(point => point.label === 'grip-hold')!;
      const offers = plans[0].find(point => point.label === 'open-weight-hold')!;
      const faq = plans[0].find(point => point.label === 'faq-room')!;
      for (const dish of ['homard', 'souffle', 'huitres', 'sushi', 'chocolat-fume', 'poutine', 'burger']) {
        await Promise.all(pages.map(async page => {
          await at(page, grip.y);
          await page.locator(`[data-dish-id="${dish}"]`).evaluate(button => (button as HTMLButtonElement).click());
          await expect(page.locator('.scene-canvas')).toHaveAttribute('data-rendered-model', dish, { timeout: 120_000 });
          // Two separate React updates reach the actual supported 60% control.
          for (const target of [0.8, 0.6]) {
            await page.locator('.dish-zoom button').nth(0).evaluate(button => (button as HTMLButtonElement).click());
            await expect.poll(() => page.locator('.scene-canvas').evaluate(el => Number((el as HTMLCanvasElement).dataset.cameraDolly)),
              { timeout: 30_000 }).toBeCloseTo(target, 3);
          }
          await at(page, grip.y + 1); // Timeline change gives an exact fitted pose.
        }));
        await compare(`grip-${dish}-zoom-0.6`, grip.y);
        await Promise.all(pages.map(page => page.locator('.reset-dish').evaluate(button => (button as HTMLButtonElement).click())));
        await Promise.all(pages.map(page => at(page, grip.y + 1)));
        await compare(`grip-${dish}-reset`, grip.y);
        if (dish === 'sushi') {
          await Promise.all(pages.map(page => page.evaluate(() => {
            const cap = Number(document.querySelector<HTMLCanvasElement>('.scene-canvas')!.dataset.zoomMax);
            const button = document.querySelectorAll<HTMLButtonElement>('.dish-zoom button')[1];
            for (let n = 0; n < Math.ceil((cap - 1) / 0.2); n++) button.click();
          })));
          await Promise.all(pages.map(page => at(page, grip.y + 1)));
          await compare('grip-sushi-close-up-max', grip.y);
          await Promise.all(pages.map(page => page.locator('.reset-dish').evaluate(button => (button as HTMLButtonElement).click())));
          await Promise.all(pages.map(page => at(page, grip.y + 1)));
          await compare('grip-sushi-close-up-reset', grip.y);
        }
        // Entry framing can depend on the selected dish's measured bounds.
        await compare(`dish-${dish}-offers-cache`, offers.y, offers);
        await compare(`dish-${dish}-faq-cache`, faq.y, faq);
      }
      // Re-enter directly at the FAQ after releasing the room, independently
      // of the normal offers approach and reverse journey above.
      await Promise.all(pages.map(page => at(page, 0)));
      await compare('direct-faq-cache', faq.y, faq);
      const footer = plans[0].find(point => point.label === 'footer-hold')!;
      await Promise.all(pages.map(page => at(page, 0)));
      await compare('direct-footer-cache', footer.y, footer);
      expect(requests).toEqual([1, 1]);
      expect(errors).toEqual([]);
      if (guardedIndex) {
        const observed = evidence as { states: Awaited<ReturnType<typeof readRenderedState>>[] }[];
        expect(observed.some(sample => sample.states[1].crop?.state === 'cropped' &&
          Number(sample.states[1].crop.croppedRoomDraws) > 0),
        'guarded mode must submit at least one actual cropped room draw').toBe(true);
      }
      complete = true;
    } finally {
      const lastObserved = await Promise.allSettled(pages.map(page => page.evaluate(() => ({
        scroll: scrollY, viewport: { width: innerWidth, height: innerHeight },
        canvas: { ...document.querySelector<HTMLCanvasElement>('.scene-canvas')?.dataset },
        media: ((window as MediaWindow).restaurantABMedia ?? []).map(video => ({
          src: new URL(video.src).pathname, time: video.currentTime, readyState: video.readyState,
          paused: video.paused, seeking: video.seeking, error: video.error?.code ?? null,
        })),
      }))));
      await writeFile(testInfo.outputPath('restaurant-geometry-ab.json'), JSON.stringify({
        complete, phase, profile, comparisonMode, browser: browser.version(), sourceSHA256: hash(source), candidateSHA256: hash(candidate.bytes),
        query: guardedIndex ? ['off', 'restaurantCrop=guarded'] : null,
        normalLaptopRequested: pages.map(page => requestedLaptop.has(page)),
        methodology: 'Same production build, separate contexts, DPR1 SwiftShader, normal-motion rendered poses, fixed decoded video at 0.25s; exact camera and canonical cached-room pose guards then zero-pixel-difference canvas screenshots, including idle offers/FAQ/footer. Not physical GPU/FPS or universal aspect proof.',
        requests, errors, layoutEvidence, lastObserved, samples: evidence,
      }, null, 2));
      await Promise.all(contexts.map(context => context.close()));
    }
  });
}
