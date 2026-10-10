import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Run from the repository against its already-built hermetic production server.
// This script changes no application source and starts no build or server.
const require = createRequire(path.resolve(process.env.VISTAIRE_REPO_ROOT || process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname))
  throw new Error('Use the hermetic local production server; external/production data is not a benchmark fixture.');
const output = path.resolve(process.env.VISTAIRE_BENCHMARK_OUTPUT || 'benchmark-results');
const sha = process.env.VISTAIRE_BENCHMARK_SHA || 'unverified';
await mkdir(output, { recursive: true });

function installProbe() {
  const nativeRAF = window.requestAnimationFrame.bind(window);
  performance.setResourceTimingBufferSize(2000);
  // Track the detached phone video without retaining disposed media or changing playback.
  const media = [];
  const nativeCreateElement = document.createElement;
  document.createElement = function (...args) {
    const element = Reflect.apply(nativeCreateElement, this, args);
    if (element.tagName === 'VIDEO' && media.length < 20) media.push(new WeakRef(element));
    return element;
  };
  // Count command submissions only. No readback, synchronization or GPU timing.
  // The same narrow wrappers are required in both baseline and candidate runs.
  const sceneContexts = new WeakMap();
  let drawSubmissions = 0;
  for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Context) continue;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const original = Context.prototype[name];
      if (typeof original !== 'function') continue;
      Context.prototype[name] = function (...args) {
        if (!sceneContexts.has(this)) sceneContexts.set(this, Boolean(this.canvas?.classList?.contains('scene-canvas')));
        if (sceneContexts.get(this)) drawSubmissions++;
        return Reflect.apply(original, this, args);
      };
    }
  }
  const ids = new WeakMap();
  const sceneIds = new Set();
  const callbacks = [], intervals = [], tasks = [], commits = [], snapshots = [];
  const cap = 50000;
  let nextId = 0, phase = 'startup', canvas = null, previous = null, overflow = 0;
  let rendererMetadata;
  let driverGeneration = 0;
  const phaseWindows = [{ name: 'startup', startedAt: 0, endedAt: null }];
  const readiness = {};
  function enterPhase(name) {
    const at = performance.now();
    phaseWindows.at(-1).endedAt = at;
    phaseWindows.push({ name, startedAt: at, endedAt: null });
    phase = name;
    previous = null; // An interval straddling phases belongs to neither workload.
  }
  function push(list, item) { if (list.length < cap) list.push(item); else overflow++; }
  function getCanvas() {
    if (!canvas?.isConnected) canvas = document.querySelector('.scene-canvas');
    return canvas;
  }
  window.requestAnimationFrame = function (callback) {
    if (!ids.has(callback)) ids.set(callback, ++nextId);
    const id = ids.get(callback);
    return nativeRAF(timestamp => {
      const beforeCanvas = getCanvas();
      const before = beforeCanvas?.dataset.frames;
      const submissionsBefore = drawSubmissions;
      const started = performance.now();
      const callbackPhase = phase;
      try { return callback(timestamp); }
      finally {
        const duration = performance.now() - started;
        const c = getCanvas();
        const submitted = drawSubmissions - submissionsBefore;
        const rendered = submitted > 0 || (c?.dataset.frames !== undefined && c.dataset.frames !== before);
        if (rendered) sceneIds.add(id);
        push(callbacks, { phase: callbackPhase, at: started, id, duration, rendered, drawSubmissions: submitted,
          submissionMs: rendered && c?.dataset.renderCPUms !== undefined ? Number(c.dataset.renderCPUms) : null });
      }
    });
  };
  // This independent light cadence probe is deliberately not counted as an app RAF.
  function tick(timestamp) {
    const phaseStart = phaseWindows.at(-1).startedAt;
    if (previous !== null && previous >= phaseStart && timestamp >= previous) push(intervals, { phase, at: timestamp, duration: timestamp - previous, hidden: document.hidden });
    previous = timestamp >= phaseStart ? timestamp : null;
    const c = getCanvas();
    if (!readiness.contentPresentMs && document.querySelector('h1')) readiness.contentPresentMs = performance.now();
    if (!readiness.first3DReadyMs && c?.dataset.ready === 'true') readiness.first3DReadyMs = performance.now();
    if (!readiness.usableScreenMs && document.querySelector('h1') && !document.querySelector('.preloader')) readiness.usableScreenMs = performance.now();
    nativeRAF(tick);
  }
  nativeRAF(tick);
  try { new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      const owner = phaseWindows.find(window => entry.startTime >= window.startedAt && entry.startTime + entry.duration <= (window.endedAt ?? performance.now()));
      push(tasks, { phase: owner?.name ?? 'phase-boundary', at: entry.startTime, duration: entry.duration });
    }
  }).observe({ type: 'longtask', buffered: true }); } catch { /* reported as unsupported below */ }
  let reactHookInstalled = false;
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    reactHookInstalled = true;
    let rendererId = 0;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true, renderers: new Map(), checkDCE() {},
      inject(renderer) { const id = ++rendererId; this.renderers.set(id, renderer); return id; },
      onCommitFiberRoot(id) { push(commits, { phase, at: performance.now(), rendererId: id }); },
      onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    };
  }
  const summary = values => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const q = p => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] : null;
    return { count: sorted.length, total: sorted.reduce((a, b) => a + b, 0), p50: q(.5), p95: q(.95), p99: q(.99), max: sorted.at(-1) ?? null };
  };
  window.__vistaireBenchmark = {
    phase(name) { enterPhase(name); },
    endPhase(name) {
      const completed = phaseWindows.at(-1);
      enterPhase('between-phases');
      const snapshot = this.snapshot(name);
      snapshot.phaseWindow = { ...completed };
      return snapshot;
    },
    stopDriver() { driverGeneration++; },
    loadingObserved() { return Number.isFinite(readiness.first3DReadyMs) && Number.isFinite(readiness.usableScreenMs); },
    animateScroll({ to, duration }) {
      return new Promise(resolve => {
        const start = scrollY, begun = performance.now(), generation = ++driverGeneration;
        const target = to === 'footer' ? document.documentElement.scrollHeight - innerHeight : 0;
        function step(now) {
          if (generation !== driverGeneration) { resolve(); return; }
          const t = Math.min(1, (now - begun) / duration);
          scrollTo({ top: start + (target - start) * t, behavior: 'instant' });
          if (t < 1) nativeRAF(step); else resolve();
        }
        nativeRAF(step);
      });
    },
    snapshot(name) {
      const c = getCanvas();
      const videos = [...new Set([...document.querySelectorAll('video'), ...media.map(ref => ref.deref()).filter(Boolean)])].map(v => ({
        connected: v.isConnected, socialId: v.closest('.social-rail article')?.querySelector('video') === v ? v.src.split('/').at(-1)?.split('.')[0] : null,
        source: new URL(v.currentSrc || v.src || location.href).pathname, paused: v.paused, time: v.currentTime,
        rate: v.playbackRate, readyState: v.readyState, rect: v.getBoundingClientRect().toJSON(),
        decodedFrames: v.getVideoPlaybackQuality?.().totalVideoFrames ?? null, droppedFrames: v.getVideoPlaybackQuality?.().droppedVideoFrames ?? null,
      }));
      const data = c ? Object.fromEntries(['ready', 'settled', 'suspended', 'section', 'frames', 'model', 'renderedModel',
        'support', 'supportReady', 'phoneReady', 'laptopReady', 'phoneRate', 'phoneDemo', 'drawCalls', 'triangles', 'renderCPUms']
        .map(key => [key, c.dataset[key] ?? null])) : null;
      const s = { name, at: performance.now(), scrollY, visibility: document.visibilityState,
        cssViewport: [innerWidth, innerHeight], canvasCSS: c ? [c.clientWidth, c.clientHeight] : null,
        drawingBuffer: c ? [c.width, c.height] : null, requestedDPR: devicePixelRatio, data, videos,
        heap: performance.memory ? { usedBytes: performance.memory.usedJSHeapSize, totalBytes: performance.memory.totalJSHeapSize,
          limitBytes: performance.memory.jsHeapSizeLimit, limitation: 'Chromium JS heap only; includes growing bounded probe arrays, so growth does not establish an application leak; not VRAM or full process memory' } : null };
      snapshots.push(s); return s;
    },
    report() {
      const phases = [...new Set([...callbacks, ...intervals, ...commits, ...tasks].map(s => s.phase))].filter(name => name !== 'navigate-away-and-return');
      const c = getCanvas();
      // Read immutable capability metadata once per document, outside active workloads.
      if (rendererMetadata === undefined && c) {
        rendererMetadata = null;
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (gl) {
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          rendererMetadata = { version: gl.getParameter(gl.VERSION), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
            timerQueryAvailable: !!(gl.getExtension('EXT_disjoint_timer_query_webgl2') || gl.getExtension('EXT_disjoint_timer_query')) };
        }
      }
      return { readiness, webgl: rendererMetadata ?? null, phaseWindows, overflow, sampleCounts: { callbacks: callbacks.length, intervals: intervals.length, tasks: tasks.length, commits: commits.length, snapshots: snapshots.length }, userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemoryGiB: navigator.deviceMemory ?? null, motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'normal',
        theme: document.documentElement.dataset.vistaireTheme ?? document.documentElement.dataset.theme ?? null,
        react: { hookInstalled: reactHookInstalled, rendererCount: window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size ?? 0,
          limitation: 'Counts all React root commits; not component render count or duration. Hook overhead is present in both runs.' },
        sceneCallbackIds: [...sceneIds], snapshots,
        phases: phases.map(name => {
          const cb = callbacks.filter(s => s.phase === name), scene = cb.filter(s => sceneIds.has(s.id));
          const raf = intervals.filter(s => s.phase === name && !s.hidden);
          const long = tasks.filter(s => s.phase === name);
          return { name, allAppRAFCPUms: summary(cb.map(s => s.duration)), sceneRAFCPUms: summary(scene.map(s => s.duration)),
            submissionCPUms: summary(scene.filter(s => s.rendered).map(s => s.submissionMs)),
            logicalRenderedCallbacks: scene.filter(s => s.rendered).length, webglDrawSubmissions: scene.reduce((sum, s) => sum + s.drawSubmissions, 0), sceneCallbackCount: scene.length,
            browserRAFIntervalMs: summary(raf.map(s => s.duration)), intervalsOver50ms: raf.filter(s => s.duration > 50).length,
            intervalsOver100ms: raf.filter(s => s.duration > 100).length, intervalsOver250ms: raf.filter(s => s.duration > 250).length,
            longTasks: summary(long.map(s => s.duration)), reactRootCommits: commits.filter(s => s.phase === name).length };
        }),
        resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, initiatorType: r.initiatorType, startTime: r.startTime,
          duration: r.duration, transferBytes: r.transferSize, encodedBodyBytes: r.encodedBodySize, decodedBodyBytes: r.decodedBodySize })),
        navigation: performance.getEntriesByType('navigation').map(r => r.toJSON()),
        longTaskSupported: PerformanceObserver.supportedEntryTypes.includes('longtask'),
      };
    },
  };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const profiles = [
  { name: 'desktop-css', viewport: { width: 1440, height: 900 }, route: '/' },
  { name: 'mobile-css', viewport: { width: 390, height: 844 }, route: '/en' },
];
const report = {
  schema: 2, harnessSHA256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'), sha, headSHA: process.env.VISTAIRE_BENCHMARK_HEAD_SHA || null, runURL: process.env.VISTAIRE_BENCHMARK_RUN_URL || null, baseURL, startedAt: new Date().toISOString(),
  host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, totalRAMBytes: os.totalmem() },
  methodology: {
    renderer: 'Chromium SwiftShader software WebGL, not physical GPU', browserArgs: ['--use-angle=swiftshader', '--use-gl=angle'],
    productionServer: 'Caller must start the verified production build; script does not start/build it.',
    cache: 'Cold = new browser context plus CDP HTTP cache clear, not cold OS/GPU/process. Warm = same-context reload.',
    trials: '3 cold/warm loading pairs, then 3 serial idle/phone/pricing workloads, then 3 journey/gesture/asset/menu-video stress cycles within a >=180-second warm session per profile. A failed stress phase keeps the full profile and soak incomplete; profiles serial; 25-minute script deadline.',
    phaseBoundaries: 'RAF intervals crossing a phase boundary are discarded; CDP/report serialization is between-phases. Long tasks are assigned by their actual time interval, or phase-boundary when crossing. Static WebGL capability metadata is cached once per document after readiness, before active workloads.',
    gesture: 'Fixed four-step pointer path, same endpoints and zoom actions for all schema-2 comparisons; schema-1 used20steps and cannot be compared directly.',
    cadence: 'RAF intervals are callback cadence, not physically presented frames or known screen refresh.',
    cpu: 'Scene RAF wall duration includes update/preparation/render submission and may include driver/backpressure stalls; it is not CPU utilization or GPU duration. It excludes separate React/tasks. Existing renderCPUms is submission-only. CDP TaskDuration/ScriptDuration include whole-page probe and scroll-driver work (seconds); they are not scene-only CPU.',
    probe: 'Bounded RAF/callback arrays, light cadence probe, WeakRef media registry, WebGL submission-count wrappers and React commit hook; same instrumentation must be used before/after. WebGL wrapper CPU overhead is included; counts are submissions, not GPU duration. No trace, readback, gl.finish or network throttling.',
    unmeasured: ['physical display refresh', 'physical GPU duration', 'power/thermal state', 'renderer geometry/texture/program counts', 'VRAM bytes', 'component-specific React duration', 'hardware touch/trackpad/AR'],
  }, profiles: [],
};
const save = () => writeFile(path.join(output, 'landing-performance.json'), JSON.stringify(report, null, 2));
await save();
const browser = await chromium.launch({ headless: true, args: report.methodology.browserArgs });
report.browserVersion = browser.version();
let failed = false;
const deadline = setTimeout(() => {
  failed = true; report.deadlineExceeded = true;
  void browser.close();
}, 25 * 60 * 1000);
try {
  for (const profile of profiles) {
    const result = { ...profile, requestedDPR: 1, loads: [], cycles: [], errors: [], warnings: [] };
    report.profiles.push(result);
    let context, page, client, activeAction = 'loading';
    const unexpectedErrors = () => result.errors.filter(error => !(error.type === 'requestfailed' && /ERR_ABORTED/.test(error.failure || ''))
      && !(error.type === 'console' && /ERR_ABORTED/.test(error.message || '')));
    result.workloads = { loading: { status: 'pending', comparable: false }, isolated: { status: 'pending', comparable: false }, stress: { status: 'pending', comparable: false }, soak: { status: 'pending', comparable: false } };
    const step = async (name, action) => { activeAction = name; return action(); };
    const recordProbeOverflow = data => {
      if (!(data?.overflow > 0)) return;
      if (!result.probeOverflowObserved) result.warnings.push('Probe sample cap exceeded; truncated metrics invalidate workload/profile comparisons.');
      result.probeOverflowObserved = true;
    };
    try {
      for (let trial = 1; trial <= 3; trial++) {
        if (context) await context.close();
        context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: 1, locale: 'fr-CA', reducedMotion: 'no-preference' });
        await context.addInitScript(installProbe);
        page = await context.newPage();
        page.setDefaultTimeout(30000);
        page.on('pageerror', error => result.errors.push({ trial, type: 'pageerror', message: error.message }));
        page.on('console', message => { if (message.type() === 'error') result.errors.push({ trial, type: 'console', message: message.text() }); });
        page.on('requestfailed', request => result.errors.push({ trial, type: 'requestfailed', url: request.url(), failure: request.failure()?.errorText }));
        page.on('response', response => { if (response.status() >= 400) result.errors.push({ trial, type: 'http', status: response.status(), url: response.url() }); });
        client = await context.newCDPSession(page);
        await client.send('Performance.enable');
        await client.send('Network.enable');
        await client.send('Network.clearBrowserCache');
        for (const cache of ['cold', 'warm']) {
          const navigationStarted = Date.now();
          if (cache === 'cold') await page.goto(new URL(profile.route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
          else await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
          const navigationToDOMContentLoadedMs = Date.now() - navigationStarted;
          await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.ready === 'true', null, { timeout: 120000 });
          await page.waitForFunction(() => !document.querySelector('.preloader'), null, { timeout: 120000 });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForFunction(() => window.__vistaireBenchmark.loadingObserved());
          const navigationToReadyObservedMs = Date.now() - navigationStarted;
          await page.evaluate(name => window.__vistaireBenchmark.snapshot(name), `${cache}-${trial}`);
          const data = await page.evaluate(() => window.__vistaireBenchmark.report());
          if (!data.webgl || documentIsFallback(data)) throw new Error('True WebGL scene unavailable; do not compare fallback performance.');
          recordProbeOverflow(data);
          result.loads.push({ trial, cache, comparable: !result.probeOverflowObserved && unexpectedErrors().length === 0, loadingWall: { navigationToDOMContentLoadedMs, navigationToReadyObservedMs }, ...data });
          if (result.probeOverflowObserved) throw new Error('Loading probe overflow; comparison invalid.');
          console.log(`${profile.name}: ${cache} ${trial} ready in ${data.readiness.first3DReadyMs?.toFixed(1)} ms`);
          await save();
        }
      }
      result.workloads.loading = { status: 'completed', comparable: unexpectedErrors().length === 0, pairs: 3 };
      await page.evaluate(() => window.__vistaireBenchmark.phase('between-phases'));
      const phase = async (name, action, minimumMs = 0) => {
        activeAction = `${name}:start`;
        const before = await client.send('Performance.getMetrics');
        const started = Date.now();
        const startSnapshot = await page.evaluate(name => {
          window.__vistaireBenchmark.phase(name);
          return window.__vistaireBenchmark.snapshot(`${name}:start`);
        }, name);
        const actionStarted = Date.now();
        let actionTimer;
        try {
          await Promise.race([action(), new Promise((_, reject) => {
            actionTimer = setTimeout(() => reject(new Error(`${name}: action exceeded 40s diagnostic budget`)), 40000);
          })]);
        } finally { clearTimeout(actionTimer); }
        await sleep(Math.max(0, minimumMs - (Date.now() - actionStarted)));
        const snapshot = await page.evaluate(name => window.__vistaireBenchmark.endPhase(name), name);
        if (snapshot.data?.ready !== 'true') throw new Error(`${name}: true WebGL readiness was lost (${snapshot.data?.ready ?? 'no canvas'}).`);
        const after = await client.send('Performance.getMetrics');
        const metrics = Object.fromEntries(after.metrics.map(m => [m.name, m.value]));
        const beforeMetrics = Object.fromEntries(before.metrics.map(m => [m.name, m.value]));
        const deltas = Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount']
          .map(key => [key, metrics[key] - beforeMetrics[key]]));
        let phonePlayback = null;
        if (name.endsWith(':phone-video') || name.includes(':social-video-')) {
          const menuIndex = Number(name.split(':social-video-')[1]);
          const socialSource = ['maison-elyse', 'trouvable', 'sauge-noire'][menuIndex];
          const matchesVideo = video => name.endsWith(':phone-video')
            ? !video.connected && video.source.startsWith('/videos/demo/')
            : video.connected && video.socialId === socialSource;
          const beforeVideo = startSnapshot.videos.find(matchesVideo);
          const afterVideo = snapshot.videos.find(matchesVideo);
          phonePlayback = { observed: Boolean(beforeVideo && afterVideo),
            decodedFramesAdvanced: beforeVideo?.decodedFrames != null && afterVideo?.decodedFrames != null
              ? afterVideo.decodedFrames - beforeVideo.decodedFrames : null,
            playingAtEnd: afterVideo ? !afterVideo.paused : null };
          if (!phonePlayback.observed || !(phonePlayback.decodedFramesAdvanced > 0) || !phonePlayback.playingAtEnd)
            result.warnings.push(`${name}: decoded moving video was not established; phase is invalid for comparison.`);
        }
        result.session = await page.evaluate(() => window.__vistaireBenchmark.report());
        recordProbeOverflow(result.session);
        const verified = !result.probeOverflowObserved && (!phonePlayback || (phonePlayback.observed && phonePlayback.decodedFramesAdvanced > 0 && phonePlayback.playingAtEnd));
        result.cycles.push({ name, status: verified ? 'completed' : 'invalid-workload', comparable: verified && unexpectedErrors().length === 0 && name !== 'navigate-away-and-return', elapsedMs: Date.now() - started, measurementWindowMs: name === 'navigate-away-and-return' ? null : snapshot.phaseWindow.endedAt - snapshot.phaseWindow.startedAt, startSnapshot, snapshot, phonePlayback,
          cdp: { deltas: name === 'navigate-away-and-return' ? null : deltas, JSHeapUsedBytes: metrics.JSHeapUsedSize, nodes: metrics.Nodes, documents: metrics.Documents },
          attribution: name === 'navigate-away-and-return' ? 'Lifecycle-only wall time and snapshots; document identity/counters may reset, so CPU deltas and RAF phase comparison are intentionally omitted.' : 'Same-document instrumented phase' });
        await save();
        if (result.probeOverflowObserved) throw new Error(`${name}: probe overflow; comparison invalid.`);
        if (phonePlayback && (!phonePlayback.observed || !(phonePlayback.decodedFramesAdvanced > 0) || !phonePlayback.playingAtEnd))
          throw new Error(`${name}: required decoded video workload was not verified; comparison invalid.`);
      };
      const at = async id => { await page.locator(`#${id}`).evaluate(el => {
        const stage = el.firstElementChild?.clientHeight || innerHeight;
        const travel = Math.max(0, el.offsetHeight - stage);
        scrollTo({ top: el.getBoundingClientRect().top + scrollY + travel * .5, behavior: 'instant' });
      });
        await page.waitForFunction(id => document.querySelector('.scene-canvas')?.dataset.section === id && !document.getElementById(id)?.inert, id);
      };
      const scroll = async (to, duration) => {
        await step(`scroll:${to}:driver`, () => page.evaluate(args => window.__vistaireBenchmark.animateScroll(args), { to, duration }));
        await step(`scroll:${to}:processed-endpoint`, () => page.waitForFunction(to => {
          const canvas = document.querySelector('.scene-canvas');
          const target = to === 'footer' ? document.documentElement.scrollHeight - innerHeight : 0;
          const chapter = document.getElementById(to);
          if (!canvas || !chapter) return false;
          const bounds = chapter.getBoundingClientRect();
          const travel = Math.max(1, bounds.height - chapter.firstElementChild.getBoundingClientRect().height);
          const expectedProgress = to === 'hero' ? 0 : Math.min(1, Math.max(0, -bounds.top / travel));
          const processedProgress = Number(canvas.dataset.progress);
          return Math.abs(scrollY - target) <= 1 && canvas.dataset.ready === 'true' && canvas.dataset.section === to && canvas.dataset.suspended !== 'true' && !chapter.inert
            && Number.isFinite(processedProgress) && Math.abs(processedProgress - expectedProgress) <= 0.00011;
        }, to));
      };
      const sessionStarted = Date.now();
      for (let repetition = 1; repetition <= 3; repetition++) {
        await phase(`r${repetition}:idle-setup`, async () => {
          await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
          await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.settled === 'true' && document.querySelector('.scene-canvas')?.dataset.section === 'hero');
        });
        await phase(`r${repetition}:idle`, async () => {}, 10000);
        await phase(`r${repetition}:phone-setup`, async () => {
          await page.evaluate(() => {
            const el = document.querySelector('.opening-journey');
            const stage = el.firstElementChild.clientHeight;
            const motion = Number(el.style.getPropertyValue('--opening-motion-vh')) * stage / 100;
            scrollTo({ top: motion + stage * .4, behavior: 'instant' });
          });
          await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.section === 'wearable');
        });
        await phase(`r${repetition}:phone-video`, async () => {}, 8000);
        await phase(`r${repetition}:pricing-setup`, async () => {
          await at('open-weight');
          await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.suspended === 'true');
        });
        await phase(`r${repetition}:pricing-idle`, async () => {}, 8000);
      }
      result.workloads.isolated = { status: 'completed', comparable: unexpectedErrors().length === 0, repetitions: 3, requiredPhases: ['idle', 'phone-video', 'pricing-idle'] };
      result.workloads.stress.status = 'in-progress';
      await save();
      for (let repetition = 1; repetition <= 3; repetition++) {
        await phase(`r${repetition}:journey-setup`, async () => {
          await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
          await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.section === 'hero' && document.querySelector('.scene-canvas')?.dataset.settled === 'true');
        });
        await phase(`r${repetition}:scroll-forward`, () => scroll('footer', 10000));
        await phase(`r${repetition}:scroll-reverse`, () => scroll('hero', 10000));
        await phase(`r${repetition}:dish-gesture`, async () => {
          await step('dish:arrive-grip', () => at('grip'));
          await sleep(800);
          const box = await page.locator('.dish-gesture').boundingBox();
          if (!box) throw new Error('Dish gesture target absent');
          await step('dish:pointer-position', () => page.mouse.move(box.x + box.width * .3, box.y + box.height * .4));
          await step('dish:pointer-down', () => page.mouse.down());
          await step('dish:four-step-drag', () => page.mouse.move(box.x + box.width * .7, box.y + box.height * .55, { steps: 4 }));
          await step('dish:pointer-up', () => page.mouse.up());
          await step('dish:zoom-out', () => page.locator('.dish-zoom button').nth(0).click());
          const zoomIn = page.locator('.dish-zoom button').nth(1);
          if (await zoomIn.isEnabled()) await step('dish:zoom-in', () => zoomIn.click());
          else result.warnings.push(`r${repetition}: zoom-in was fit-limited; zoom-out exercised only.`);
        }, 7000);
        await phase(`r${repetition}:asset-selections`, async () => {
          await at('grip');
          const dish = ['sushi', 'burger', 'souffle'][repetition - 1];
          await page.locator(`.dish-switch [data-dish-id="${dish}"]`).click();
          await page.waitForFunction(dish => {
            const d = document.querySelector('.scene-canvas')?.dataset;
            return d?.model === dish && !d.loadingModel && !d.modelError;
          }, dish);
          await at('product');
          const support = ['sculpte', 'carre', 'signature'][repetition - 1];
          await page.locator(`#tab-${support}`).click();
          await page.waitForFunction(support => {
            const d = document.querySelector('.scene-canvas')?.dataset;
            return d?.support === support && d.supportReady === 'true';
          }, support);
        });
        for (let menu = 0; menu < 3; menu++) {
          await phase(`r${repetition}:social-setup-${menu}`, async () => {
            await at('social-content');
            const pager = page.locator('.social-pager button').nth(menu);
            await pager.click();
            await page.waitForFunction(index => document.querySelectorAll('.social-pager button')[index]?.getAttribute('aria-current') === 'true', menu);
          });
          await phase(`r${repetition}:social-video-${menu}`, async () => {}, 4000);
        }
        await phase(`r${repetition}:support-gesture`, async () => {
          await at('product');
          const target = page.locator('.support-gesture');
          const before = await target.getAttribute('aria-valuenow');
          await target.focus();
          if (!await target.evaluate(el => document.activeElement === el)) throw new Error('Support target did not receive focus');
          for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
          await page.waitForFunction(before => document.querySelector('.support-gesture')?.getAttribute('aria-valuenow') !== before, before);
        }, 7000);
      }
      result.workloads.stress = { status: 'completed', comparable: unexpectedErrors().length === 0, repetitions: 3 };
      await sleep(Math.max(0, 180000 - (Date.now() - sessionStarted)));
      result.sessionDurationMs = Date.now() - sessionStarted;
      result.workloads.soak = { status: 'completed', comparable: unexpectedErrors().length === 0, durationMs: result.sessionDurationMs };
      await phase('local-pricing-faq', async () => {
        await at('open-weight');
        const question = page.locator('.pricing-faq [data-seo-faq-question]').first();
        await question.scrollIntoViewIfNeeded();
        const initial = await question.getAttribute('aria-expanded');
        if (initial !== 'true' && initial !== 'false') throw new Error('Local FAQ is not hydrated');
        await question.click();
        await page.waitForFunction(expected => document.querySelector('.pricing-faq [data-seo-faq-question]')?.getAttribute('aria-expanded') === expected, initial === 'true' ? 'false' : 'true');
        await question.click();
        await page.waitForFunction(expected => document.querySelector('.pricing-faq [data-seo-faq-question]')?.getAttribute('aria-expanded') === expected, initial);
      });
      result.warnings.push('Only local FAQ accordion tested; no Mistral/RAG service request is made or measured.');
      result.preNavigationSession = await page.evaluate(() => window.__vistaireBenchmark.report());
      recordProbeOverflow(result.preNavigationSession);
      if (result.probeOverflowObserved) throw new Error('Pre-navigation probe overflow; comparison invalid.');
      await phase('navigate-away-and-return', async () => {
        await page.locator('.menu-toggle').click();
        const about = page.locator('.menu-page-links a').nth(1);
        const destination = await about.getAttribute('href');
        await about.click();
        await page.waitForURL(url => url.pathname === new URL(destination, baseURL).pathname);
        await page.waitForFunction(() => !document.querySelector('[data-immersive-vistaire]'));
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.ready === 'true');
        await page.waitForFunction(() => !document.querySelector('.preloader'));
      });
      await phase('visibility-and-wake', async () => {
        const cover = await context.newPage();
        await cover.goto('about:blank');
        await cover.bringToFront();
        const hidden = await page.evaluate(() => document.hidden);
        result.actualVisibilityHideObserved = hidden;
        if (!hidden) result.warnings.push('Headless tab focus did not hide landing; native visibility resume is unverified.');
        await sleep(2000);
        await page.bringToFront();
        await cover.close();
        await page.mouse.wheel(0, 100);
      }, 3000);
      await page.screenshot({ path: path.join(output, `${profile.name}-end.png`) });
      result.ignoredErrors = 'Navigation/selection aborts remain recorded but are excluded; every other HTTP, request, console and page error invalidates comparison.';
      result.comparable = unexpectedErrors().length === 0 && !result.probeOverflowObserved;
      result.status = result.comparable ? 'completed' : 'runtime-errors';
      if (!result.comparable) failed = true;
    } catch (error) {
      failed = true;
      result.status = 'failed';
      result.comparable = false;
      result.failure = error.stack || String(error);
      result.failureAction = activeAction;
      for (const workload of Object.values(result.workloads)) if (workload.status !== 'completed') { workload.status = 'incomplete'; workload.comparable = false; }
      if (page && !page.isClosed()) {
        const bounded = async action => {
          let timer;
          try { return await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Failure observation exceeded2s')), 2000); })]); }
          finally { clearTimeout(timer); }
        };
        try {
          const observation = await bounded(() => page.evaluate(() => {
            window.__vistaireBenchmark?.stopDriver();
            const snapshot = window.__vistaireBenchmark?.endPhase('failure');
            return { snapshot, session: window.__vistaireBenchmark?.report() };
          }));
          result.failureSnapshot = observation.snapshot;
          result.partialSession = observation.session;
          recordProbeOverflow(observation.session);
          result.failureBoundaryAcknowledged = true;
        } catch { result.failureBoundaryAcknowledged = false; }
        try { await page.screenshot({ path: path.join(output, `${profile.name}-failure.png`), timeout: 2000 }); } catch { /* retain prior evidence if rendering is blocked */ }
      }
    } finally {
      if (context) await context.close();
      await save();
    }
  }
} finally {
  clearTimeout(deadline);
  await browser.close();
  report.completedAt = new Date().toISOString();
  await save();
}
function documentIsFallback(data) { return data.snapshots.at(-1)?.data?.ready !== 'true'; }
if (failed) process.exitCode = 1;
