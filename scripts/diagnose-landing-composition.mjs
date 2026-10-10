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
for (const label of ['baseline', 'candidate']) {
  const runtime = runtimes[label];
  assert.ok(runtime?.root && /^[a-f0-9]{40}$/.test(runtime.headSHA) && /^[a-f0-9]{40}$/.test(runtime.buildSHA), `${label}: exact runtime provenance required`);
  assert.ok(runtime.runURL && (runtime.artifactID || runtime.artifactName), `${label}: verified artifact source required`);
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
assert.deepEqual(runtimes.baseline.contract, runtimes.candidate.contract, 'Assets, dependencies and server configuration must match.');
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
const save = () => writeFile(path.join(output, 'composition-pair.json'), JSON.stringify(report, null, 2));
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

function installVisualProbe() {
  const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
  const pending = new Map(), known = new WeakSet(), samples = [];
  let dropped = 0;
  const keys = ['frames', 'section', 'transition', 'transitionProgress', 'settled', 'settlingReasons', 'processedScrollDistance', 'fittedCameraPosition', 'fittedLook', 'cameraViewOffset', 'dishPosition', 'dishScale', 'dishQuaternion', 'supportPosition', 'supportScale', 'supportQuaternion', 'phoneScale', 'laptopPosition', 'laptopScale', 'laptopAngle', 'roomPosition', 'roomYaw'];
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

async function openPage(label, result, visual = false) {
  runtimeAlive();
  const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'no-preference', locale: 'en-CA' });
  if (visual) await context.addInitScript(installVisualProbe);
  else await context.addInitScript({ content: probeScript });
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

async function snapshot(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.scene-canvas'), world = document.querySelector('.world');
    const identities = document.querySelector('.identities'), stage = identities.querySelector('.stage');
    const rect = el => el.getBoundingClientRect().toJSON();
    return { at: performance.now(), scroll: scrollY, viewport: [innerWidth, innerHeight], canvas: rect(canvas), world: rect(world), data: { ...canvas.dataset },
      identities: { rect: rect(identities), stage: rect(stage), copyOpacity: identities.style.getPropertyValue('--copy-opacity'), stageBackground: getComputedStyle(stage).backgroundColor,
        scrim: { content: getComputedStyle(world, '::before').content, opacity: getComputedStyle(world, '::before').opacity, background: getComputedStyle(world, '::before').backgroundColor } },
      copy: Object.fromEntries([...document.querySelectorAll('.chapter')].map(el => [el.id, { rect: rect(el), alpha: el.style.getPropertyValue('--copy-opacity'), inert: el.inert }])),
      raf: window.__compositionVisual?.read() ?? null };
  });
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

try {
  assert.ok((await fetch('http://127.0.0.1:55434/fixture/health', { signal: AbortSignal.timeout(2000) })).ok, 'Caller-owned hermetic fixture required');
  await save();
  for (const [label, repetition] of [['baseline',1], ['candidate',1], ['candidate',2], ['baseline',2], ['baseline',3], ['candidate',3]]) {
    if (deadlineExceeded) break;
    await activePass(label, repetition);
  }
  for (const label of ['baseline', 'candidate']) { if (!deadlineExceeded) await visualPass(label); }
  report.complete = report.passes.length === 6 && report.passes.every(p => p.status === 'completed') && report.visual.length === 2 && report.visual.every(p => p.status === 'completed');
  report.comparable = report.complete && report.passes.every(p => p.comparable);
  report.candidateVisualAccepted = report.visual.find(p => p.label === 'candidate')?.findings.length === 0;
} catch (error) { report.errors.push(describeCleanupError(error)); }
finally {
  clearTimeout(deadline);
  try { await stopRuntime(); }
  catch (error) { report.errors.push(describeCleanupError(error)); report.complete = false; report.comparable = false; }
  report.deadlineExceeded = deadlineExceeded; report.finishedAt = new Date().toISOString(); await save();
}
if (!report.complete || !report.comparable || !report.candidateVisualAccepted || deadlineExceeded || report.errors.length) process.exitCode = 1;
