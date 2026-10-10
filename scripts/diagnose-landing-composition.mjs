import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

// One caller-owned hermetic fixture; verified builds already exist. No build,
// dependency installation, remote server, or concurrent benchmark is started.
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
const journeyQA = process.argv.includes('--journey-qa');
assert.ok(process.argv.slice(2).every(arg => arg === '--journey-qa'), 'Only --journey-qa is supported');
const runtimes = JSON.parse(process.env.VISTAIRE_COMPOSITION_RUNTIMES_JSON || '{}');
const output = path.resolve(process.env.VISTAIRE_COMPOSITION_OUTPUT || 'composition-results');
const baseURL = 'http://127.0.0.1:3000';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = readFileSync(new URL('./benchmark-landing.mjs', import.meta.url), 'utf8');
const frozenProbeSHA = '9a32220c78852be511772a33eb2523d21add67f1a6f2032baee8d68c5d460759';
assert.equal(hash(source), frozenProbeSHA, 'Frozen schema2 probe changed; comparisons require explicit protocol review.');
const probeStart = source.indexOf('function installProbe()');
const probeEnd = source.indexOf('\n\nconst sleep', probeStart);
assert.ok(probeStart >= 0 && probeEnd > probeStart);
// Reuse the exact already-tested probe, without importing its executable runner
// or modifying its frozen source. This is also how its existing Node tests bind it.
const probeScript = `(${source.slice(probeStart, probeEnd)})();`;
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
function verifyRuntime(label) {
  const runtime = runtimes[label];
  assert.ok(runtime?.root && /^[a-f0-9]{40}$/.test(runtime.headSHA) && /^[a-f0-9]{40}$/.test(runtime.buildSHA), `${label}: exact runtime provenance required`);
  assert.ok(runtime.runURL && (runtime.artifactID || runtime.artifactName), `${label}: verified artifact source required`);
  if (journeyQA) assert.ok(runtime.artifactName, 'Current candidate artifact name required');
  if (label === 'baseline') assert.ok(runtime.artifactID && /^[a-f0-9]{64}$/.test(runtime.artifactSHA256), 'Pinned baseline artifact metadata required');
  runtime.root = path.resolve(runtime.root);
  assert.equal(git(runtime.root, 'rev-parse', 'HEAD'), runtime.buildSHA, `${label}: checkout must match actual merge build`);
  git(runtime.root, 'diff', '--exit-code', 'HEAD', '--', 'components', 'app', 'public', 'next.config.ts', 'package.json', 'package-lock.json');
  runtime.buildID = readFileSync(path.join(runtime.root, '.next/BUILD_ID'), 'utf8').trim();
  assert.ok(runtime.buildID);
  runtime.buildManifestSHA256 = Object.fromEntries(['build-manifest.json', 'required-server-files.json', 'prerender-manifest.json'].map(name => [name, hash(readFileSync(path.join(runtime.root, '.next', name)))]));
  runtime.archiveIdentity = runtime.artifactSHA256 ? 'Supplied archive digest; pipeline must verify exact archive bytes before extraction' : 'Archive digest unknown; current-run artifact name, checkout, BUILD_ID and local manifests recorded';
  runtime.contract = Object.fromEntries(['public', 'package.json', 'package-lock.json', 'next.config.ts'].map(name => [name, git(runtime.root, 'rev-parse', `HEAD:${name}`)]));
}
if (!journeyQA) {
  for (const label of ['baseline', 'candidate']) verifyRuntime(label);
  assert.deepEqual(runtimes.baseline.contract, runtimes.candidate.contract, 'Assets, dependencies and server configuration must match.');
}
await mkdir(output, { recursive: true });
const report = {
  schema: 1, protocol: 'composition-pair-three-seams', startedAt: new Date().toISOString(),
  helperSHA256: hash(readFileSync(fileURLToPath(import.meta.url))), frozenProbeSHA256: frozenProbeSHA,
  runtimes, host: { cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, platform: os.platform(), release: os.release(), totalRAMBytes: os.totalmem() },
  viewport: { width: 390, height: 844 }, requestedDPR: 1,
  methodology: {
    order: ['baseline:1', 'candidate:1', 'candidate:2', 'baseline:2', 'baseline:3', 'candidate:3'],
    renderer: 'Pinned Playwright Chromium with SwiftShader; not physical GPU FPS',
    cache: 'Each pass uses a fresh browser/context and cleared HTTP cache, then primes the same seam journey before active measurement. OS/driver caches remain warm and order-dependent; no cold-hardware claim.',
    active: 'Query-free normal motion, three matched repetitions, each seam forward/reverse over3000ms requested wall time. Actual delivered input timing is retained; delayed callbacks can skip requested intermediate coordinates.',
    visual: 'Separate QA-mode continuous3000ms forward/reverse replays plus jump/checkpoint observations at0/25/50/75/100 on three suspect seams. Actual draw transforms and inline DOM publication are sampled passively. Layout/checkpoint images have their own timestamps and are not assumed to show an earlier sampled pose. This heavier mode is never compared to visitor active costs.',
    timings: 'Frozen probe callback wall includes update/submission/driver backpressure. CDP is whole-page seconds and includes driver/probe overhead. RAF cadence is not displayed FPS. No synchronous GPU readback or timer query.',
    limits: 'Three seams only; not complete twelve-chapter acceptance. Physical iOS input, GPU elapsed, VRAM, power, thermal behavior and component-specific React cost remain unmeasured. Phone-rate changes are recorded, not silently treated as equal media work.',
  }, passes: [], visual: [], cleanup: [], errors: [], complete: false, comparable: false,
};
if (journeyQA) {
  report.protocol = 'candidate-full-journey-qa';
  report.journeyChecksPassed = false;
  report.visualAcceptance = 'not-established';
  report.openVisualReview = ['QR/support coexistence', 'Mac composition and chapter-to-chapter visual quality'];
  report.methodology = {
    order: ['candidate:journey-qa'],
    renderer: 'Pinned Playwright Chromium; actual SwiftShader metadata verified, normal motion, 390x844 CSS pixels and DPR1. No physical-device claim.',
    visual: 'One sceneDiagnostics=1 page; all nine real external joins, two opening camera legs, AI/phone holds, seven internal presentations and native pricing/footer. Each range uses the existing 3000ms requested driver forward/reverse, then 0/25/50/75/100 checkpoints. Reading-hold centers add selected-card and decoded-video checks.',
    overhead: 'QA-only passive callback wrapping, actual pose/inline DOM/media samples, checkpoints, screenshots and serialization add substantial overhead. No active benchmark, FPS threshold, visitor CPU comparison or performance gain claim.',
    timing: 'Requested scroll coordinates and delivered event timestamps are retained separately. Draw samples retain actual rendered pose and contemporaneous inline DOM state; phase divergence is quantified, not reinterpreted as physical display lag. Screenshots carry their own later timestamps.',
    limits: 'Real browser software-renderer QA only. No physical iOS input/display FPS, GPU elapsed, VRAM, power, thermal or isolated React/CPU measurement. Native opaque pricing legitimately suspends the hidden scene; it must not be mistaken for a fresh draw.',
  };
}
const save = () => writeFile(path.join(output, journeyQA ? 'landing-journey-qa.json' : 'composition-pair.json'), JSON.stringify(report, null, 2));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, browser, browserClosePromise, deadlineExceeded = false;
async function bounded(action, name, milliseconds = 40_000) {
  let timer;
  try { return await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name}: ${milliseconds}ms deadline`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
const deadline = setTimeout(() => {
  deadlineExceeded = true;
  if (browser) void closeOwnedBrowser().catch(() => {});
  server?.kill('SIGTERM');
}, 25 * 60_000);
function describeCleanupError(error) {
  return {
    name: error.name, message: error.message, stack: error.stack,
    ...(error.errors ? { errors: [...error.errors].map(describeCleanupError) } : {}),
  };
}
function closeOwnedBrowser() {
  // Later close() calls can resolve at disconnection before the original
  // process/temp-directory shutdown finishes. Keep the original ownership.
  return browserClosePromise ??= browser.close();
}
async function stopRuntime(owner = 'final') {
  if (!browser && !server) return;
  const started = Date.now();
  const record = { owner, startedAt: new Date().toISOString(), complete: false, errors: [] };
  report.cleanup.push(record);
  const failures = [];
  if (browser) {
    record.browser = { startedAt: new Date().toISOString(), connectedBefore: browser.isConnected(), closed: false };
    try {
      // Playwright owns a30s graceful-close/kill-and-wait sequence. Reuse the
      // existing40s action bound so we do not abandon that ownership after2s.
      await bounded(() => closeOwnedBrowser(), 'browser cleanup');
      record.browser.closed = true; browser = null; browserClosePromise = null;
    } catch (error) { failures.push(error); }
    record.browser.connectedAfter = browser?.isConnected() ?? false;
    record.browser.finishedAt = new Date().toISOString();
  }
  if (server) {
    const child = server;
    const exited = () => child.exitCode !== null || child.signalCode !== null;
    record.server = { pid: child.pid, startedAt: new Date().toISOString(), exitCodeBefore: child.exitCode, signalBefore: child.signalCode, signals: [] };
    if (!exited()) {
      const exit = new Promise(resolve => child.once('exit', resolve));
      record.server.signals.push({ signal: 'SIGTERM', at: new Date().toISOString(), sent: child.kill('SIGTERM') });
      await Promise.race([exit, sleep(2000)]);
      if (!exited()) {
        record.server.signals.push({ signal: 'SIGKILL', at: new Date().toISOString(), sent: child.kill('SIGKILL') });
        await Promise.race([exit, sleep(2000)]);
      }
    }
    Object.assign(record.server, { exited: exited(), exitCodeAfter: child.exitCode, signalAfter: child.signalCode, finishedAt: new Date().toISOString() });
    if (exited()) server = null;
    else failures.push(new Error('Server cleanup did not establish process exit'));
  }
  record.complete = failures.length === 0;
  record.errors = failures.map(describeCleanupError);
  record.elapsedMs = Date.now() - started;
  record.finishedAt = new Date().toISOString();
  if (failures.length) throw new AggregateError(failures, 'Unknown cleanup completion forbids another measured pass');
}
async function startRuntime(label, pass) {
  if (deadlineExceeded) throw new Error('Overall25min deadline reached');
  await stopRuntime();
  const occupied = await fetch(baseURL, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false);
  assert.equal(occupied, false, 'Port3000 already serves a process outside this pass');
  const runtime = runtimes[label];
  const next = require.resolve('next/dist/bin/next');
  server = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', '3000'], { cwd: runtime.root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', bytes => { if (logs.length < 100_000) logs += bytes.toString(); });
  server.on('error', error => { logs += error.message; });
  try {
    await bounded(async () => {
      while (true) {
        if (server.exitCode !== null) throw new Error(`Next exited${server.exitCode}: ${logs}`);
        try { if ((await fetch(baseURL, { signal: AbortSignal.timeout(2000) })).ok) break; } catch { /* server starting */ }
        await sleep(200);
      }
    }, 'Next readiness');
    runtimeAlive();
  } finally { await writeFile(path.join(output, `${label}-${pass}-server.log`), logs); }
  browserClosePromise = null;
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  if (report.browserVersion) assert.equal(browser.version(), report.browserVersion);
  report.browserVersion = browser.version();
}

function runtimeAlive() {
  assert.ok(server && server.exitCode === null && server.signalCode === null, 'Owned Next process exited; runtime identity cannot be trusted');
}

function installInputs() {
  const requested = [], delivered = [];
  let overflow = false;
  const put = (list, value) => { if (list.length < 10_000) list.push(value); else overflow = true; };
  addEventListener('scroll', event => put(delivered, { at: performance.now(), eventTimestamp: event.timeStamp, scroll: scrollY }), { passive: true });
  window.__compositionInputs = { requested, delivered, get overflow() { return overflow; },
    move({ from, to, duration }) {
      return new Promise(resolve => {
        const start = performance.now();
        function step() {
          const at = performance.now(), fraction = Math.min(1, (at - start) / duration);
          const target = from + (to - from) * fraction;
          put(requested, { at, target, fraction });
          scrollTo({ top: target, behavior: 'instant' });
          if (fraction < 1) requestAnimationFrame(step); else resolve();
        }
        requestAnimationFrame(step);
      });
    },
  };
}

function installVisualProbe(journey = false) {
  const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
  const pending = new Map(), known = new WeakSet(), samples = [];
  let dropped = 0;
  const keys = ['frames', 'section', 'transition', 'transitionProgress', 'settled', 'settlingReasons', 'processedScrollDistance', 'fittedCameraPosition', 'fittedLook', 'cameraViewOffset', 'dishPosition', 'dishScale', 'dishQuaternion', 'supportPosition', 'supportScale', 'supportQuaternion', 'phoneScale', 'laptopPosition', 'laptopScale', 'laptopAngle', 'roomPosition', 'roomYaw'];
  if (journey) keys.push('openingProgress', 'suspended', 'phonePosition', 'phoneQuaternion', 'laptopQuaternion', 'roomCameraPosition', 'tableCameraPosition');
  window.requestAnimationFrame = function (callback) {
    const requestedAt = performance.now();
    let id;
    id = Reflect.apply(request, this, [timestamp => {
      pending.delete(id);
      const canvas = document.querySelector('.scene-canvas');
      const before = canvas?.dataset.frames, start = performance.now();
      try { return Reflect.apply(callback, window, [timestamp]); }
      finally {
        if (canvas?.dataset.frames !== before) known.add(callback);
        if (known.has(callback)) {
          if (samples.length < 10_000) samples.push({ requestedAt, startedAt: start, endedAt: performance.now(), rafTimestamp: timestamp, scroll: scrollY,
            ...(journey ? { rendered: canvas?.dataset.frames !== before, presentation: window.__compositionJourney?.read() } : {}),
            pose: Object.fromEntries(keys.map(key => [key, canvas?.dataset[key] ?? null])),
            copy: Object.fromEntries([...document.querySelectorAll('.chapter')].map(el => [el.id, { alpha: el.style.getPropertyValue('--copy-opacity'), openingAlpha: el.style.getPropertyValue('--opening-opacity'), inert: el.inert }])),
          }); else dropped++;
        }
      }
    }]);
    pending.set(id, { callback, requestedAt }); return id;
  };
  window.cancelAnimationFrame = function (id) { pending.delete(id); return Reflect.apply(cancel, this, [id]); };
  window.__compositionVisual = { read() { const at = performance.now(); return { at, samples, dropped, hidden: document.hidden,
    pending: [...pending].filter(([, value]) => known.has(value.callback)).map(([id, value]) => ({ id, ageMs: at - value.requestedAt })) }; } };
}

function installJourneyObservation() {
  // Include the renderer's detached phone video without the active benchmark.
  const media = [], create = document.createElement;
  document.createElement = function (...args) {
    const element = Reflect.apply(create, this, args);
    if (element.tagName === 'VIDEO') media.push(new WeakRef(element));
    return element;
  };
  window.__compositionJourney = { read() {
    const selected = selector => [...document.querySelectorAll(selector)].flatMap((el, i) => el.classList.contains('selected') || el.getAttribute('aria-current') === 'true' ? [i] : []);
    const current = [...document.querySelectorAll('.social-rail article')].flatMap((el, i) => el.classList.contains('is-current') ? [i] : []);
    return {
      featureIndex: Number(document.querySelector('.feature-number')?.textContent) - 1,
      featureDots: selected('.feature-dots > span'), featureHeading: document.querySelector('.feature-card h3')?.textContent,
      featureOpacity: Number(document.querySelector('#features')?.style.getPropertyValue('--detail-opacity')),
      socialIndex: current.length === 1 ? current[0] : null, socialPager: selected('.social-pager button'),
      railProgress: Number(document.querySelector('#social-content')?.style.getPropertyValue('--rail-progress')),
      videos: [...new Set([...document.querySelectorAll('video'), ...media.map(ref => ref.deref()).filter(Boolean)])].map(video => {
        const quality = video.getVideoPlaybackQuality?.();
        const social = video.dataset.playWhen?.match(/^social-content-(\d)$/);
        return { source: new URL(video.currentSrc || video.src || location.href).pathname, connected: video.isConnected,
          socialIndex: social ? Number(social[1]) : null, paused: video.paused, readyState: video.readyState,
          time: video.currentTime, rate: video.playbackRate, decodedClass: video.classList.contains('has-decoded-frame'),
          totalVideoFrames: quality?.totalVideoFrames ?? null, droppedFrames: quality?.droppedVideoFrames ?? null,
          decodedFrames: quality ? quality.totalVideoFrames - quality.droppedVideoFrames : null };
      }),
    };
  } };
}

async function openPage(label, result, visual = false, journey = false) {
  runtimeAlive();
  const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'no-preference', locale: 'en-CA' });
  if (visual) await context.addInitScript(installVisualProbe, journey);
  else await context.addInitScript({ content: probeScript });
  if (journey) await context.addInitScript(installJourneyObservation);
  await context.addInitScript(installInputs);
  const page = await context.newPage();
  page.setDefaultTimeout(40_000);
  result.errors = []; result.requests = [];
  page.on('pageerror', error => result.errors.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => { if (message.type() === 'error') result.errors.push({ type: 'console', message: message.text() }); });
  page.on('requestfailed', request => result.errors.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => {
    if (response.status() >= 400) result.errors.push({ type: 'http', status: response.status(), url: response.url() });
    if (/\.(?:glb|webp|mp4|json)(?:\?|$)/.test(response.url())) result.requests.push({ url: response.url(), status: response.status() });
  });
  const client = await context.newCDPSession(page);
  await client.send('Network.enable'); await client.send('Network.clearBrowserCache'); await client.send('Performance.enable');
  await bounded(() => page.goto(`${baseURL}/en${visual ? '?sceneDiagnostics=1' : ''}`, { waitUntil: 'domcontentloaded' }), `${label}: navigation`);
  await bounded(() => page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.ready === 'true' && !document.querySelector('.preloader')), `${label}: essential ready`);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.world-fallback').count(), 0, 'Fallback is not a WebGL workload');
  if (visual) await bounded(() => page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.framingReady === 'true'), 'QA hull ready');
  else {
    result.loading = await page.evaluate(() => window.__vistaireBenchmark.report());
    assert.ok(result.loading.webgl && result.loading.sceneCallbackIds.length, 'Real WebGL callback identification required');
    assert.equal(result.loading.motion, 'normal');
    assert.equal(result.loading.overflow, 0);
    if (report.renderer) assert.deepEqual(result.loading.webgl, report.renderer, 'Actual renderer capabilities must match');
    else report.renderer = result.loading.webgl;
    assert.equal(result.requests.filter(r => new URL(r.url).pathname === '/immersive-assets/dishes/framing-hulls.json').length, 0, 'Default hull request regression');
  }
  const windows = await page.locator('.chapter[data-exit-start]').evaluateAll(elements => elements.map(el => ({ from: el.id, to: el.dataset.exitTo, start: Number(el.dataset.exitStart), end: Number(el.dataset.exitEnd) })));
  if (journey) { result.windows = windows; return { page, context, client, seams: windows }; }
  const wanted = ['encryption:grip', 'sustainability:testimonies', 'testimonies:social-content'];
  const seams = wanted.map(name => windows.find(w => `${w.from}:${w.to}` === name));
  assert.ok(seams.every(Boolean), 'All three requested seam windows must exist');
  result.windows = seams;
  return { page, context, client, seams };
}

async function at(page, y, visual = false) {
  const before = await page.evaluate(y => {
    const previous = { scroll: scrollY, frames: Number(document.querySelector('.scene-canvas')?.dataset.frames) };
    scrollTo({ top: y, behavior: 'instant' }); return previous;
  }, y);
  await page.waitForFunction(({ y, visual, before }) => {
    const canvas = document.querySelector('.scene-canvas'), opening = document.querySelector('.opening-stage');
    if (!canvas || !opening || Math.abs(scrollY - y) > 1 || canvas.dataset.ready !== 'true') return false;
    if (visual) return Math.abs(Number(canvas.dataset.processedScrollDistance) - scrollY / Number.parseFloat(getComputedStyle(opening).height)) < 1e-6;
    // Ordinary visitors do not publish QA pose/transition attributes. Use the
    // retained section/progress and real draw counter, with actual DOM geometry.
    const chapters = [...document.querySelectorAll('.chapter')];
    const current = chapters.filter(el => scrollY >= el.getBoundingClientRect().top + scrollY - 1).at(-1);
    if (!current) return false;
    const rect = current.getBoundingClientRect(), stage = current.firstElementChild.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - stage.height)));
    return (Math.abs(before.scroll - scrollY) <= 1 || Number(canvas.dataset.frames) > before.frames)
      && canvas.dataset.section === current.id && Math.abs(Number(canvas.dataset.progress) - progress) < .00011;
  }, { y, visual, before });
}

async function snapshot(page, journey = false) {
  return page.evaluate(journey => {
    const canvas = document.querySelector('.scene-canvas'), world = document.querySelector('.world');
    const identities = document.querySelector('.identities'), stage = identities.querySelector('.stage');
    const rect = el => el.getBoundingClientRect().toJSON();
    return { at: performance.now(), scroll: scrollY, viewport: [innerWidth, innerHeight], canvas: rect(canvas), world: rect(world), data: { ...canvas.dataset },
      identities: { rect: rect(identities), stage: rect(stage), copyOpacity: identities.style.getPropertyValue('--copy-opacity'), stageBackground: getComputedStyle(stage).backgroundColor,
        scrim: { content: getComputedStyle(world, '::before').content, opacity: getComputedStyle(world, '::before').opacity, background: getComputedStyle(world, '::before').backgroundColor } },
      copy: Object.fromEntries([...document.querySelectorAll('.chapter')].map(el => [el.id, { rect: rect(el), alpha: el.style.getPropertyValue('--copy-opacity'), inert: el.inert, ...(journey ? { openingAlpha: el.style.getPropertyValue('--opening-opacity') } : {}) }])),
      ...(journey ? { dpr: devicePixelRatio, drawingBuffer: [canvas.width, canvas.height], presentation: window.__compositionJourney.read() } : {}),
      raf: (() => { const raf = window.__compositionVisual?.read(); return journey && raf
        ? { at: raf.at, pending: raf.pending, dropped: raf.dropped, hidden: raf.hidden, last: raf.samples.at(-1) } : raf ?? null; })() };
  }, journey);
}

const unexpected = result => result.errors.filter(error => !(error.type === 'requestfailed' && /ERR_ABORTED/.test(error.error || '')) && !(error.type === 'console' && /ERR_ABORTED/.test(error.message || '')));
async function activePass(label, repetition) {
  const result = { label, repetition, status: 'running', comparable: false, phases: [] }; report.passes.push(result); await save();
  let page;
  try {
    await startRuntime(label, repetition);
    const opened = await openPage(label, result); page = opened.page;
    // Prime both revisions through the same visible models before timed active work.
    for (const seam of opened.seams) {
      await bounded(() => at(page, seam.end - 1), 'prime seam');
      if (seam.from === 'sustainability') await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.laptopReady === 'true');
      await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.settled === 'true');
    }
    for (const seam of opened.seams) for (const direction of ['forward', 'reverse']) {
      const from = direction === 'forward' ? seam.start + 1 : seam.end - 1;
      const to = direction === 'forward' ? seam.end - 1 : seam.start + 1;
      const name = `${seam.from}:${seam.to}:${direction}`;
      result.phase = `${name}:setup`; await bounded(() => at(page, from), result.phase);
      await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.settled === 'true');
      const before = await opened.client.send('Performance.getMetrics');
      const startSnapshot = await page.evaluate(name => window.__vistaireBenchmark.snapshot(`${name}:start`), name);
      await page.evaluate(name => window.__vistaireBenchmark.phase(name), name);
      result.phase = name;
      const wallStart = Date.now();
      await bounded(async () => {
        await page.evaluate(args => window.__compositionInputs.move(args), { from, to, duration: 3000 });
        await at(page, to);
        await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.settled === 'true');
      }, name);
      const end = await page.evaluate(name => window.__vistaireBenchmark.endPhase(name), name);
      const after = await opened.client.send('Performance.getMetrics');
      const data = await page.evaluate(() => window.__vistaireBenchmark.report());
      const phase = data.phases.find(p => p.name === name);
      result.phases.push({ name, wallMs: Date.now() - wallStart, start: startSnapshot, end, metrics: phase, cdpBefore: before.metrics, cdpAfter: after.metrics });
      runtimeAlive();
      assert.equal(data.overflow, 0, 'Probe overflow invalidates comparison');
      assert.ok(phase?.sceneCallbackCount > 0 && phase.webglDrawSubmissions > 0, 'Expected active renderer workload missing');
      assert.equal(end.data.ready, 'true'); assert.notEqual(end.data.suspended, 'true');
      assert.equal(end.cssViewport.join(','), '390,844'); assert.equal(end.canvasCSS.join(','), '390,844');
      assert.equal(end.requestedDPR, 1, 'Actual window DPR must match');
      if (report.drawingBuffer) assert.deepEqual(end.drawingBuffer, report.drawingBuffer, 'Actual rendering resolution must match');
      else report.drawingBuffer = end.drawingBuffer;
      if (seam.to === 'social-content') {
        const playing = end.videos.find(video => video.connected && video.socialId && !video.paused);
        if (direction === 'forward') assert.ok(playing && playing.readyState >= 2 && playing.decodedFrames > 0, 'Incoming social video must really decode and play');
        const advanced = end.videos.some(video => video.connected && video.socialId && video.decodedFrames > (startSnapshot.videos.find(before => before.source === video.source)?.decodedFrames ?? 0));
        assert.ok(advanced, 'Social seam requires actual decoded-frame advancement');
      }
      await save();
    }
    result.probe = await page.evaluate(() => window.__vistaireBenchmark.report());
    runtimeAlive();
    result.inputs = await page.evaluate(() => ({ requested: window.__compositionInputs.requested, delivered: window.__compositionInputs.delivered, overflow: window.__compositionInputs.overflow }));
    assert.equal(result.inputs.overflow, false); assert.equal(unexpected(result).length, 0, 'Unexpected runtime/network errors');
    assert.equal(result.requests.filter(r => new URL(r.url).pathname === '/immersive-assets/dishes/framing-hulls.json').length, 0, 'Default hulls must remain absent through the measured journey');
    result.status = 'completed';
  } catch (error) {
    result.status = 'failed'; result.error = error.stack;
    if (page) {
      result.failureProbe = await bounded(() => page.evaluate(() => window.__vistaireBenchmark?.report()), 'failure probe', 1000).catch(() => null);
      await bounded(() => page.screenshot({ path: path.join(output, `${label}-${repetition}-failed.png`) }), 'failure screenshot', 1000).catch(() => {});
    }
  } finally {
    await save();
    try { await stopRuntime(`${label}:${repetition}`); result.cleanupComplete = true; result.comparable = result.status === 'completed'; }
    catch (error) {
      result.cleanupComplete = false; result.comparable = false;
      result.cleanupError = describeCleanupError(error); await save(); throw error;
    }
    await save();
  }
  console.log(`${label}:${repetition} ${result.status} ${result.phase || 'startup'}`);
}

async function visualPass(label) {
  const result = { label, status: 'running', replays: [], checkpoints: [], findings: [] }; report.visual.push(result); await save();
  let page;
  try {
    await startRuntime(label, 'visual');
    const opened = await openPage(label, result, true); page = opened.page;
    for (const seam of opened.seams) for (const direction of ['forward', 'reverse']) {
      const from = direction === 'forward' ? seam.start + 1 : seam.end - 1;
      const to = direction === 'forward' ? seam.end - 1 : seam.start + 1;
      result.phase = `${seam.from}:${seam.to}:${direction}:continuous`;
      await bounded(() => at(page, from, true), `${result.phase}:setup`);
      if (seam.from === 'sustainability') await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.laptopReady === 'true');
      await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.settled === 'true');
      const start = await page.evaluate(() => ({ at: performance.now(), drawIndex: window.__compositionVisual.read().samples.length, inputIndex: window.__compositionInputs.requested.length }));
      await bounded(async () => {
        await page.evaluate(args => window.__compositionInputs.move(args), { from, to, duration: 3000 });
        await at(page, to, true);
      }, result.phase);
      const end = await page.evaluate(() => ({ at: performance.now(), drawIndex: window.__compositionVisual.read().samples.length, inputIndex: window.__compositionInputs.requested.length }));
      result.replays.push({ phase: result.phase, from, to, durationRequestedMs: 3000, start, end });
      await save();
      const fractions = direction === 'forward' ? [0, .25, .5, .75, 1] : [1, .75, .5, .25, 0];
      for (const fraction of fractions) {
        result.phase = `${seam.from}:${seam.to}:${direction}:${fraction}`;
        const y = seam.start + (seam.end - seam.start) * fraction;
        await bounded(() => at(page, y, true), result.phase);
        if (seam.from === 'sustainability') await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.laptopReady === 'true');
        const sample = await bounded(() => snapshot(page), `${result.phase}:snapshot`);
        // Keep all passive draws once at the end, not duplicated at every checkpoint.
        const raf = sample.raf; sample.raf = { at: raf.at, pending: raf.pending, dropped: raf.dropped, last: raf.samples.at(-1) };
        result.checkpoints.push({ phase: result.phase, target: y, fraction, direction, sample });
        runtimeAlive();
        assert.ok(sample.world.bottom >=844 && sample.canvas.bottom >=844, 'Actual scene coverage');
        assert.equal(sample.data.roomPosition, '0.000,0.000,0.000'); assert.equal(sample.data.roomYaw, '0.0000');
        const alpha = Number(sample.identities.copyOpacity || 0), scrim = sample.identities.scrim;
        if (sample.identities.stageBackground !== 'rgba(0, 0, 0, 0)' || scrim.content === 'none' || scrim.background !== 'rgba(17, 17, 16, 0.4)' || Math.abs(Number(scrim.opacity) - alpha) > .001)
          result.findings.push({ phase: result.phase, kind: 'identities-background-ownership', alpha, stageBackground: sample.identities.stageBackground, scrim });
        if (fraction === .5 || fraction === .75) {
          const image = { file: `${label}-${seam.from}-${direction}-${fraction}.png`, startedAt: await page.evaluate(() => performance.now()) };
          await bounded(() => page.screenshot({ path: path.join(output, image.file) }), 'checkpoint screenshot');
          image.endedAt = await page.evaluate(() => performance.now());
          result.checkpoints.at(-1).image = image;
        }
        await save();
      }
    }
    result.draws = await page.evaluate(() => window.__compositionVisual.read());
    runtimeAlive();
    result.inputs = await page.evaluate(() => ({ requested: window.__compositionInputs.requested, delivered: window.__compositionInputs.delivered, overflow: window.__compositionInputs.overflow }));
    assert.equal(result.draws.dropped, 0, 'Visual sample cap exceeded');
    assert.equal(result.inputs.overflow, false, 'Input sample cap exceeded');
    assert.equal(unexpected(result).length, 0, 'Unexpected QA runtime/network errors');
    result.status = 'completed';
  } catch (error) {
    result.status = 'failed'; result.error = error.stack;
    if (page) result.failure = await bounded(() => snapshot(page), 'failure visual snapshot', 1000).catch(() => null);
  } finally {
    await save();
    try { await stopRuntime(`${label}:visual`); result.cleanupComplete = true; }
    catch (error) { result.cleanupComplete = false; result.cleanupError = describeCleanupError(error); await save(); throw error; }
    await save();
  }
  console.log(`${label}:visual ${result.status}, findings=${result.findings.length}`);
}

function journeyPlan(geometry) {
  const ids = ['hero', 'ai', 'wearable', 'features', 'encryption', 'grip', 'sustainability', 'testimonies', 'social-content', 'product', 'open-weight', 'footer'];
  assert.equal(geometry.regions.map(region => region.id).join(','), ids.join(','), 'All twelve regions must exist exactly once in document order');
  const { opening, windows, maxScroll } = geometry, h = opening.stageHeight;
  assert.ok(Number.isFinite(h) && h > 0 && Number.isFinite(maxScroll));
  for (const region of geometry.regions) assert.ok([region.top, region.height, region.stageHeight].every(Number.isFinite) && region.height > 0 && region.stageHeight > 0, `${region.id}: invalid measured geometry`);
  const near = (actual, expected, name) => assert.ok(Math.abs(actual - expected) <= 2, `${name}: measured ${actual}, expected ${expected}`);
  near(opening.motionVH, 840, 'Opening two 3.2H legs plus 2H AI hold');
  near(opening.phoneHoldVH, 150, 'Unchanged 1.5H phone hold');
  near(opening.height, 12 * h, 'Opening document distance');
  assert.equal(windows.length, 9, 'All nine real external joins required');
  windows.forEach((window, i) => {
    assert.equal(`${window.from}:${window.to}`, `${ids[i + 2]}:${ids[i + 3]}`, 'External join order');
    assert.ok(Number.isFinite(window.start) && Number.isFinite(window.end) && window.start >= 0 && window.end > window.start + 2 && window.end <= maxScroll + 1, 'Invalid or unreachable external join');
    if (i) assert.ok(window.start >= windows[i - 1].end - 1, 'External joins overlap');
    if (i < 7) near(window.end - window.start, 3.2 * h, 'External join distance');
  });
  const plan = [
    { name: 'hero:ai', kind: 'opening', start: opening.top, end: opening.top + 3.2 * h },
    { name: 'ai:hold', kind: 'opening', region: 'ai', start: opening.top + 3.2 * h, end: opening.top + 5.2 * h },
    { name: 'ai:wearable', kind: 'opening', start: opening.top + 5.2 * h, end: opening.top + 8.4 * h },
    { name: 'wearable:hold', kind: 'opening', region: 'wearable', start: opening.top + 8.4 * h, end: opening.top + 9.9 * h },
    ...windows.map(window => ({ ...window, name: `${window.from}:${window.to}`, kind: 'join' })),
  ];
  near(windows[0].start, opening.top + 9.9 * h, 'Phone hold ends at first external join');
  for (const id of ids.slice(3, 10)) {
    const incoming = windows.find(window => window.to === id), outgoing = windows.find(window => window.from === id);
    const region = geometry.regions.find(region => region.id === id);
    const reading = ['features', 'social-content'].includes(id);
    near(incoming.end, region.top + 1.1 * h, `${id}: entry edge`);
    near(outgoing.start - incoming.end, (reading ? 8 : 4) * h, `${id}: active presentation`);
    plan.push({ name: `${id}:presentation`, kind: 'presentation', region: id, start: incoming.end, end: outgoing.start, reading });
  }
  for (const span of [
    { name: 'open-weight:native', region: 'open-weight', start: windows[7].end, end: windows[8].start },
    { name: 'footer:native', region: 'footer', start: windows[8].end, end: maxScroll },
  ]) if (span.end > span.start + 2) plan.push({ ...span, kind: 'native' });
  return plan.sort((a, b) => a.start - b.start);
}

function assertJourneySample(sample, stageHeight, region, cardIndex) {
  assert.equal(sample.viewport.join(','), '390,844'); assert.equal(sample.dpr, 1);
  assert.ok(sample.drawingBuffer.every(value => Number.isFinite(value) && value > 0), 'Real drawing buffer required');
  for (const rect of [sample.world, sample.canvas]) assert.ok(rect.top <= 0 && rect.left <= 0 && rect.right >= 390 && rect.bottom >= 844, 'Actual full-viewport scene coverage');
  assert.equal(sample.data.ready, 'true');
  assert.ok(Number(sample.data.frames) > 0 && Number(sample.data.drawCalls) > 0, 'Actual renderer draw evidence required');
  assert.equal(sample.data.roomPosition, '0.000,0.000,0.000'); assert.equal(sample.data.roomYaw, '0.0000');
  for (const key of ['fittedCameraPosition', 'fittedLook', ...['dish', 'support', 'phone', 'laptop'].flatMap(name => [`${name}Position`, `${name}Scale`, `${name}Quaternion`])]) {
    const values = sample.data[key]?.split(',').map(Number);
    assert.ok(values?.length === (key.endsWith('Quaternion') ? 4 : 3) && values.every(Number.isFinite), `${key}: real rendered pose missing`);
  }
  assert.equal(sample.raf.dropped, 0); assert.equal(sample.raf.hidden, false);
  assert.equal(sample.raf.last?.pose.frames, sample.data.frames, 'Passive draw evidence must match the observed rendered frame');
  if (sample.data.suspended === 'true') {
    const pricing = sample.copy['open-weight'].rect;
    assert.ok(pricing.top <= 1 && pricing.bottom >= 844 - 1, 'Scene suspension only valid behind opaque native pricing');
  }
  const alpha = Number(sample.identities.copyOpacity || 0), scrim = sample.identities.scrim;
  assert.equal(sample.identities.stageBackground, 'rgba(0, 0, 0, 0)', 'Identities stage must not own the tint');
  assert.notEqual(scrim.content, 'none'); assert.equal(scrim.background, 'rgba(17, 17, 16, 0.4)');
  assert.ok(Number.isFinite(alpha) && Math.abs(Number(scrim.opacity) - alpha) <= .001, 'World scrim follows actual identities copy opacity');
  assert.ok(Number.isFinite(Number(sample.data.processedScrollDistance)) && stageHeight > 0);
  if (cardIndex != null) {
    const state = sample.presentation;
    if (region === 'features') {
      assert.equal(state.featureIndex, cardIndex); assert.equal(state.featureDots.join(','), String(cardIndex));
      assert.ok(state.featureHeading?.trim() && state.featureOpacity > .99, 'Selected feature card must be readable');
    } else {
      assert.equal(state.socialIndex, cardIndex); assert.equal(state.socialPager.join(','), String(cardIndex));
      assert.ok(Math.abs(state.railProgress - cardIndex) < .001, 'Selected social rail must be on its hold');
      const video = state.videos.find(video => video.socialIndex === cardIndex);
      assert.ok(video?.connected && !video.paused && video.readyState >= 2 && video.decodedFrames > 0 && video.decodedClass && video.rate === 1, 'Selected social video must actually decode and play at normal speed');
    }
  }
}

async function journeyPass() {
  const result = { label: 'candidate', status: 'running', replays: [], checkpoints: [], findings: [], regionCoverage: {} };
  report.visual.push(result); await save();
  let page;
  const captureEvidence = async () => {
    result.draws = await bounded(() => page.evaluate(() => window.__compositionVisual.read()), 'journey passive evidence');
    result.inputs = await bounded(() => page.evaluate(() => ({ requested: window.__compositionInputs.requested, delivered: window.__compositionInputs.delivered, overflow: window.__compositionInputs.overflow })), 'journey input evidence');
  };
  try {
    await startRuntime('candidate', 'journey-qa');
    ({ page } = await openPage('candidate', result, true, true));
    report.renderer = await page.evaluate(() => {
      const canvas = document.querySelector('.scene-canvas'), gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return null;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), vendor: gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR), motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'normal', dpr: devicePixelRatio, drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
    });
    assert.match(report.renderer?.renderer || '', /SwiftShader/i, 'Actual software renderer must be SwiftShader');
    assert.equal(report.renderer.motion, 'normal'); assert.equal(report.renderer.dpr, 1);
    result.geometry = await page.evaluate(() => {
      const opening = document.querySelector('.opening-journey'), style = getComputedStyle(opening), bounds = opening.getBoundingClientRect();
      return { opening: { top: bounds.top + scrollY, height: bounds.height, stageHeight: Number.parseFloat(getComputedStyle(opening.firstElementChild).height), motionVH: Number(style.getPropertyValue('--opening-motion-vh')), phoneHoldVH: Number(style.getPropertyValue('--opening-phone-hold-vh')) },
        regions: [...document.querySelectorAll('.chapter')].map(el => ({ id: el.id, top: el.getBoundingClientRect().top + scrollY, height: el.getBoundingClientRect().height, stageHeight: el.firstElementChild.getBoundingClientRect().height })),
        windows: [...document.querySelectorAll('.chapter[data-exit-start]')].map(el => ({ from: el.id, to: el.dataset.exitTo, start: Number(el.dataset.exitStart), end: Number(el.dataset.exitEnd) })), maxScroll: document.documentElement.scrollHeight - innerHeight };
    });
    result.plan = journeyPlan(result.geometry); await save();
    const h = result.geometry.opening.stageHeight;
    const checkpointFractions = span => span.reading ? [0, .125, .25, .5, .75, .875, 1] : [0, .25, .5, .75, 1];
    const checkpointPhase = (span, direction, fraction) => {
      const cardIndex = span.reading ? [.125, .5, .875].indexOf(fraction) : -1;
      return `${span.name}:${direction}:${cardIndex < 0 ? fraction : `hold-${cardIndex}`}`;
    };
    const checkpoint = async (span, direction, fraction, cardIndex) => {
      result.phase = checkpointPhase(span, direction, fraction);
      const target = span.start + (span.end - span.start) * fraction;
      await bounded(() => at(page, target, true), result.phase);
      if (span.region === 'sustainability' || span.from === 'sustainability' || span.to === 'sustainability') await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.laptopReady === 'true');
      let decodedFramesBefore = null;
      if (cardIndex != null) await page.waitForFunction(({ region, index }) => {
        const state = window.__compositionJourney.read();
        if (region === 'features') return state.featureIndex === index && state.featureOpacity > .99;
        const video = state.videos.find(video => video.socialIndex === index);
        return state.socialIndex === index && video && !video.paused && video.readyState >= 2 && video.decodedFrames > 0 && video.decodedClass;
      }, { region: span.region, index: cardIndex });
      if (span.region === 'social-content' && cardIndex != null) {
        decodedFramesBefore = await page.evaluate(index => window.__compositionJourney.read().videos.find(video => video.socialIndex === index).decodedFrames, cardIndex);
        await page.waitForFunction(({ index, before }) => {
          const state = window.__compositionJourney.read(), video = state.videos.find(video => video.socialIndex === index);
          return state.socialIndex === index && !video.paused && video.decodedClass && video.decodedFrames > before;
        }, { index: cardIndex, before: decodedFramesBefore });
      }
      const sample = await bounded(() => snapshot(page, true), `${result.phase}:snapshot`);
      const record = { phase: result.phase, kind: span.kind, region: span.region, direction, fraction, cardIndex, decodedFramesBefore, target, sample };
      if (decodedFramesBefore != null) record.decodedFramesAfter = sample.presentation.videos.find(video => video.socialIndex === cardIndex).decodedFrames;
      result.checkpoints.push(record);
      if (span.name === 'wearable:hold' && fraction === .5) {
        record.phoneMedia = { modelReady: sample.data.phoneReady, advancement: 'unverified',
          state: sample.presentation.videos.find(video => !video.connected && video.source === `/videos/demo/${sample.data.phoneDemo}.mp4`) ?? null };
        assert.equal(record.phoneMedia.modelReady, 'true');
        assert.ok(record.phoneMedia.state, 'Detached phone-video state must be retained separately from social playback');
      }
      runtimeAlive(); assertJourneySample(sample, h, span.region, cardIndex);
      assert.deepEqual(sample.drawingBuffer, report.renderer.drawingBuffer, 'Drawing buffer must remain fixed through the journey');
      for (const [id, copy] of Object.entries(sample.copy)) {
        const alpha = Number(copy.openingAlpha || copy.alpha || (id === 'open-weight' ? 1 : 0));
        if (alpha > .99 && !copy.inert && copy.rect.bottom > 0 && copy.rect.top < 844) result.regionCoverage[id] ??= { phase: result.phase, at: sample.at, scroll: sample.scroll };
      }
      const screenshot = direction === 'forward' && ((span.kind === 'join' && fraction === .5) || (span.name === 'ai:hold' && fraction === .5) || cardIndex != null);
      if (screenshot) {
        record.image = { file: `candidate-${span.name.replaceAll(':', '-')}-${cardIndex == null ? 'midpoint' : `hold-${cardIndex}`}.png`, startedAt: await page.evaluate(() => performance.now()) };
        await bounded(() => page.screenshot({ path: path.join(output, record.image.file) }), 'journey checkpoint screenshot');
        record.image.endedAt = await page.evaluate(() => performance.now());
      }
      await save();
    };
    for (const direction of ['forward', 'reverse']) for (const span of direction === 'forward' ? result.plan : [...result.plan].reverse()) {
      const from = direction === 'forward' ? span.start + 1 : span.end - 1;
      const to = direction === 'forward' ? span.end - 1 : span.start + 1;
      result.phase = `${span.name}:${direction}:continuous`;
      await bounded(() => at(page, from, true), `${result.phase}:setup`);
      await page.waitForFunction(() => document.querySelector('.scene-canvas')?.dataset.settled === 'true');
      const mark = () => page.evaluate(() => ({ at: performance.now(), drawIndex: window.__compositionVisual.read().samples.length, inputIndex: window.__compositionInputs.requested.length, deliveredIndex: window.__compositionInputs.delivered.length }));
      const replay = { phase: result.phase, span: span.name, kind: span.kind, direction, from, to, durationRequestedMs: 3000, start: await mark() };
      result.replays.push(replay); await save();
      await bounded(async () => { await page.evaluate(args => window.__compositionInputs.move(args), { from, to, duration: 3000 }); await at(page, to, true); }, result.phase);
      replay.end = await mark();
      await captureEvidence();
      const draws = result.draws.samples.slice(replay.start.drawIndex, replay.end.drawIndex), inputs = result.inputs.requested.slice(replay.start.inputIndex, replay.end.inputIndex);
      const delivered = result.inputs.delivered.slice(replay.start.deliveredIndex, replay.end.deliveredIndex);
      assert.ok(draws.length && inputs.length && delivered.length, 'Actual callback and requested/delivered motion evidence required');
      assert.equal(inputs.at(-1).fraction, 1); assert.ok(Math.abs(inputs.at(-1).target - to) <= 1);
      assert.ok(draws.some(draw => draw.rendered) || (span.region === 'open-weight' && draws.every(draw => draw.pose.suspended === 'true')), 'Missing actual rendered progression outside opaque pricing');
      replay.observed = { callbackCount: draws.length, renderedCallbacks: draws.filter(draw => draw.rendered).length, requestedCount: inputs.length, deliveredCount: delivered.length,
        deliveredWallMs: delivered.at(-1).at - delivered[0].at, requestedWallMs: inputs.at(-1).at - inputs[0].at,
        maxProcessedScrollDifferencePx: Math.max(...draws.map(draw => Math.abs(draw.scroll - result.geometry.opening.top - Number(draw.pose.processedScrollDistance) * h))),
        transitionDifferences: draws.map(draw => {
          const window = result.windows.find(window => draw.scroll >= window.start && draw.scroll <= window.end);
          return window ? { at: draw.startedAt, rendered: draw.rendered, expected: `${window.from}:${window.to}`, observed: draw.pose.transition, expectedProgress: (draw.scroll - window.start) / (window.end - window.start), observedProgress: draw.pose.transitionProgress, suspended: draw.pose.suspended } : null;
        }).filter(Boolean) };
      assert.equal(result.draws.dropped, 0); assert.equal(result.inputs.overflow, false); assert.equal(unexpected(result).length, 0);
      await save();
      const fractions = checkpointFractions(span);
      for (const fraction of direction === 'forward' ? fractions : [...fractions].reverse()) {
        const cardIndex = span.reading ? [ .125, .5, .875 ].indexOf(fraction) : -1;
        await checkpoint(span, direction, fraction, cardIndex >= 0 ? cardIndex : undefined);
      }
    }
    await captureEvidence(); runtimeAlive();
    assert.equal(result.draws.dropped, 0); assert.equal(result.inputs.overflow, false); assert.equal(unexpected(result).length, 0, 'Unexpected QA runtime/network errors');
    assert.deepEqual(Object.keys(result.regionCoverage).sort(), result.geometry.regions.map(region => region.id).sort(), 'Every exact region must be visibly observed with readable, non-inert copy');
    const directions = ['forward', 'reverse'];
    assert.deepEqual(result.replays.map(replay => replay.phase).sort(), directions.flatMap(direction => result.plan.map(span => `${span.name}:${direction}:continuous`)).sort(), 'Every planned range and direction must complete');
    assert.ok(result.replays.every(replay => replay.end));
    assert.deepEqual(result.checkpoints.map(checkpoint => checkpoint.phase).sort(), directions.flatMap(direction => result.plan.flatMap(span => checkpointFractions(span).map(fraction => checkpointPhase(span, direction, fraction)))).sort(), 'Every exact planned checkpoint and reading hold must complete');
    assert.equal(result.checkpoints.filter(checkpoint => checkpoint.image).length, 16, 'Nine join midpoints, AI hold and six reading holds required');
    result.status = 'completed';
  } catch (error) {
    result.status = 'failed'; result.error = error.stack;
    if (page) {
      result.failure = await bounded(() => snapshot(page, true), 'failure journey snapshot', 1000).catch(() => null);
      await bounded(captureEvidence, 'failure journey evidence', 1000).catch(() => {});
    }
  } finally {
    await save();
    try { await stopRuntime('candidate:journey-qa'); result.cleanupComplete = true; }
    catch (error) { result.cleanupComplete = false; result.cleanupError = describeCleanupError(error); await save(); throw error; }
    await save();
  }
  console.log(`candidate:journey-qa ${result.status}, regions=${Object.keys(result.regionCoverage).length}/12`);
}

try {
  assert.ok((await fetch('http://127.0.0.1:55434/fixture/health', { signal: AbortSignal.timeout(2000) })).ok, 'Caller-owned hermetic fixture required');
  await save();
  if (journeyQA) {
    assert.deepEqual(Object.keys(runtimes), ['candidate'], 'Journey QA accepts one current candidate only');
    verifyRuntime('candidate');
    await journeyPass();
    report.complete = report.visual.length === 1 && report.visual[0].status === 'completed' && report.visual[0].cleanupComplete;
    report.journeyChecksPassed = report.complete;
  } else {
  for (const [label, repetition] of [['baseline',1], ['candidate',1], ['candidate',2], ['baseline',2], ['baseline',3], ['candidate',3]]) {
    if (deadlineExceeded) break;
    await activePass(label, repetition);
  }
  for (const label of ['baseline', 'candidate']) { if (!deadlineExceeded) await visualPass(label); }
  report.complete = report.passes.length === 6 && report.passes.every(p => p.status === 'completed') && report.visual.length === 2 && report.visual.every(p => p.status === 'completed');
  report.comparable = report.complete && report.passes.every(p => p.comparable);
  report.candidateVisualAccepted = report.visual.find(p => p.label === 'candidate')?.findings.length === 0;
  }
} catch (error) { report.errors.push(describeCleanupError(error)); }
finally {
  clearTimeout(deadline);
  try { await stopRuntime(); }
  catch (error) { report.errors.push(describeCleanupError(error)); report.complete = false; report.comparable = false; }
  report.deadlineExceeded = deadlineExceeded; report.finishedAt = new Date().toISOString(); await save();
}
if (!report.complete || (!journeyQA && !report.comparable) || !(journeyQA ? report.journeyChecksPassed : report.candidateVisualAccepted) || deadlineExceeded || report.errors.length) process.exitCode = 1;
