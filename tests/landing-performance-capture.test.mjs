import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { createPerformanceCapture } = await import(pathToFileURL(resolve(process.env.VISTAIRE_CAPTURE_SOURCE || 'components/immersive/PerformanceCapture.js')));

function fixture(options = {}) {
  let now = 0, id = 0, layoutReads = 0;
  const rafs = new Map(), timers = new Map(), reports = [];
  const events = () => {
    const listeners = new Map();
    return { listeners,
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
      removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
      emit(name) { for (const fn of listeners.get(name) || []) fn(); },
    };
  };
  const canvas = { width: 1170, height: 2532, clientWidth: 390, clientHeight: 844,
    dataset: { frames: '2', renderCPUms: '1.2', section: 'grip', progress: '0.5', settled: 'true', suspended: 'false', model: 'homard', drawCalls: '43', triangles: '700000' },
    getBoundingClientRect() { layoutReads++; return { x: 0, y: 0, width: 390, height: 844 }; },
  };
  const document = { ...events(), hidden: false, visibilityState: 'visible', querySelector: () => canvas };
  const view = { ...events(), document, performance: { now: () => now }, devicePixelRatio: 3, innerWidth: 390, innerHeight: 844,
    location: { origin: 'https://PRIVATE_ORIGIN.example', pathname: '/PRIVATE_PATH', search: '?secret=DO_NOT_EXPORT', hash: '#PRIVATE_HASH', href: 'https://preview.example/en?secret=DO_NOT_EXPORT#PRIVATE_HASH' },
    navigator: { userAgent: 'test Safari', platform: 'test', language: 'fr' },
    requestAnimationFrame(fn) { const key = ++id; rafs.set(key, fn); return key; },
    cancelAnimationFrame(key) { rafs.delete(key); },
    setTimeout(fn, delay) { const key = ++id; timers.set(key, { fn, at: now + delay }); return key; },
    clearTimeout(key) { timers.delete(key); },
    fetch() { throw new Error('Capture must not upload or fetch'); },
  };
  const capture = createPerformanceCapture({ view, onFinish: report => reports.push(report), readState: () => ({ scrollDistance: 4, unrelatedPrivateState: 'DO_NOT_SERIALIZE_STATE' }), ...options });
  return { capture, view, document, canvas, reports, rafs, timers,
    get layoutReads() { return layoutReads; },
    frame(at, frameTimestamp = at) { now = at; for (const [key, fn] of [...rafs]) { rafs.delete(key); fn(frameTimestamp); } },
    time(at) { now = at; for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.fn(); } },
    assertClean() {
      assert.equal(rafs.size, 0); assert.equal(timers.size, 0);
      for (const target of [view, document]) for (const listeners of target.listeners.values()) assert.equal(listeners.size, 0);
    },
  };
}

test('capture is opt-in, bounded to twenty seconds and excludes private URL fields', () => {
  const f = fixture();
  f.assertClean();
  f.capture.start();
  assert.equal(f.rafs.size, 1); assert.equal(f.timers.size, 1);
  f.capture.start();
  assert.equal(f.rafs.size, 1, 'second start does not create another sampling loop');
  const reads = f.layoutReads;
  f.frame(16); f.frame(32);
  assert.equal(f.layoutReads, reads, 'per-frame capture must not force layout');
  f.time(20_000);
  assert.equal(f.reports.length, 1); assert.equal(f.reports[0].reason, 'duration');
  assert.equal(f.reports[0].complete, true); assert.equal(f.reports[0].overflow, false);
  assert.ok(f.reports[0].samples.length > 0);
  const serialized = JSON.stringify(f.reports[0]);
  assert.ok(!serialized.includes('DO_NOT_EXPORT') && !serialized.includes('PRIVATE_HASH') && !serialized.includes('DO_NOT_SERIALIZE_STATE') && !serialized.includes('PRIVATE_ORIGIN') && !serialized.includes('PRIVATE_PATH'));
  assert.equal(f.reports[0].start.canvas.pixelRatioX, 3);
  assert.equal(f.reports[0].start.canvas.pixelRatioY, 3);
  assert.equal(f.reports[0].end.nativeDPR, 3);
  f.capture.stop(); f.capture.dispose();
  assert.equal(f.reports.length, 1); f.assertClean();
});

test('manual stop finishes once while cancel and dispose never publish partial reports', () => {
  const f = fixture(); f.capture.start(); f.frame(16); f.capture.stop(); f.capture.stop();
  assert.equal(f.reports.length, 1); assert.equal(f.reports[0].reason, 'manual'); f.assertClean();
  for (const method of ['cancel', 'dispose']) {
    const g = fixture(); g.capture.start(); g.frame(16); g.capture[method](); g.time(30_000);
    assert.equal(g.reports.length, 0); g.assertClean();
    if (method === 'dispose') { g.capture.start(); g.assertClean(); }
  }
});

test('hidden document and pagehide end sampling and hidden documents cannot start', () => {
  const hidden = fixture(); hidden.document.hidden = true; hidden.capture.start(); hidden.assertClean();
  for (const reason of ['hidden', 'pagehide']) {
    const f = fixture(); f.capture.start(); f.frame(16);
    if (reason === 'hidden') { f.document.hidden = true; f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); }
    else f.view.emit('pagehide');
    assert.equal(f.reports.length, 1); assert.equal(f.reports[0].reason, reason); f.assertClean();
  }
});

test('sample budget ends capture rather than silently dropping evidence or running forever', () => {
  const f = fixture({ maxSamples: 2 }); f.capture.start();
  f.frame(16); f.frame(32); f.frame(48);
  assert.equal(f.reports.length, 1); assert.equal(f.reports[0].reason, 'sample-limit');
  assert.equal(f.reports[0].complete, false); assert.equal(f.reports[0].overflow, true);
  assert.ok(f.reports[0].samples.length <= 2); f.assertClean();
});

test('fallback without a canvas is reported honestly and still cleans up', () => {
  const f = fixture(); f.document.querySelector = () => null;
  f.capture.start(); f.frame(16); f.capture.stop();
  assert.equal(f.reports[0].start.canvas, null);
  assert.equal(f.reports[0].end.canvas, null);
  assert.equal(f.reports[0].complete, false);
  f.assertClean();
});

test('panel mounts without capture or download and requires explicit user actions', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const { runInNewContext } = await import('node:vm');
  const ts = await import('typescript');
  const directory = dirname(resolve(process.env.VISTAIRE_CAPTURE_SOURCE || 'components/immersive/PerformanceCapture.js'));
  const source = await readFile(join(directory, 'PerformanceCapturePanel.jsx'), 'utf8');
  const code = ts.default.transpileModule(source, { compilerOptions: { jsx: ts.default.JsxEmit.ReactJSX, module: ts.default.ModuleKind.CommonJS } }).outputText;
  const effects = [], slots = [];
  let cursor = 0, starts = 0, stops = 0, disposals = 0, downloads = 0, finish;
  const session = { start() { starts++; return true; }, stop() { stops++; }, cancel() {}, dispose() { disposals++; } };
  const react = {
    useRef(value) { const index = cursor++; return slots[index] ||= { current: value }; },
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = next; }]; },
    useEffect(effect) { effects.push(effect); },
  };
  const exports = {};
  const context = { exports, window: {}, URL: { createObjectURL() { downloads++; return 'blob:local'; }, revokeObjectURL() {} },
    Blob, setTimeout: () => 1, clearTimeout() {}, document: { createElement: () => ({ click() {}, remove() {} }), body: { append() {} } },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };
      if (name === './PerformanceCapture.js') return { createPerformanceCapture(options) { finish = options.onFinish; return session; } };
      throw new Error(`Unexpected import ${name}`);
    },
  };
  runInNewContext(code, context);
  const render = () => { cursor = 0; return exports.default({ stateRef: { current: {} }, locale: 'en', onClose() {} }); };
  const buttons = tree => {
    const found = [];
    function walk(node) { if (!node || typeof node !== 'object') return; if (node.type === 'button') found.push(node); for (const child of [node.props?.children].flat(Infinity)) walk(child); }
    walk(tree); return found;
  };
  let tree = render();
  const cleanup = effects[0]();
  assert.equal(starts, 0); assert.equal(downloads, 0);
  buttons(tree).find(button => button.props.children === 'Record 20 seconds').props.onClick();
  assert.equal(starts, 1); assert.equal(downloads, 0);
  tree = render();
  buttons(tree).find(button => button.props.children === 'Stop').props.onClick();
  assert.equal(stops, 1);
  finish({ complete: true, startedAt: '2026-10-11T00:00:00.000Z', samples: [] });
  tree = render(); assert.equal(downloads, 0);
  buttons(tree).find(button => button.props.children === 'Download JSON').props.onClick();
  assert.equal(downloads, 1);
  cleanup(); assert.equal(disposals, 1);
});

test('landing gates the lazy panel on the explicit query flag and keeps it off initially', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const source = await readFile(join(dirname(resolve(process.env.VISTAIRE_CAPTURE_SOURCE || 'components/immersive/PerformanceCapture.js')), 'App.jsx'), 'utf8');
  assert.match(source, /const PerformanceCapturePanel = lazy\(\(\) => import\("\.\/PerformanceCapturePanel\.jsx"\)\)/);
  assert.match(source, /\[performanceCapture, setPerformanceCapture\] = useState\(false\)/);
  assert.match(source, /if \(parameters\.get\("performanceCapture"\) === "1"\)\s*\{\s*queueMicrotask\(\(\) => \{ if \(!stopped\) setPerformanceCapture\(true\); \}\);\s*\}/);
  assert.match(source, /\{performanceCapture && \(\s*<Suspense fallback=\{null\}>\s*<PerformanceCapturePanel/);
});

test('a delayed timer without any delivered RAF exposes the unobserved wait', () => {
  const f = fixture(); f.capture.start(); f.time(26_000);
  const report = f.reports[0];
  assert.equal(report.firstRAFDelayMs, null);
  assert.equal(report.timeSinceLastRAFMs, null);
  assert.equal(report.pendingFirstRAFWaitMs, 26_000);
  assert.equal(report.deadlineOverrunMs, 6_000);
  assert.equal(report.samples.length, 0);
  f.assertClean();
});

test('initial and trailing RAF delays survive deadline completion without another callback', () => {
  const f = fixture(); f.capture.start(); f.frame(4_000); f.frame(23_000);
  const report = f.reports[0];
  assert.equal(report.firstRAFDelayMs, 4_000);
  assert.equal(report.deadlineOverrunMs, 3_000);
  assert.equal(report.timeSinceLastRAFMs, 0);
  assert.equal(report.samples.at(-1).at, 23_000);
  assert.equal(report.samples.at(-1).afterDeadline, true);
  assert.equal(report.samples[0].afterDeadline, false);
  assert.equal(report.samples.at(-1).intervalMs, 19_000);
  f.assertClean();
  const g = fixture(); g.capture.start(); g.frame(4_000); g.time(25_000);
  assert.equal(g.reports[0].timeSinceLastRAFMs, 21_000);
  assert.equal(g.reports[0].deadlineOverrunMs, 5_000);
  g.assertClean();
});


test('fallback state is explicit even when an old canvas remains connected', () => {
  const f = fixture();
  f.canvas.dataset.ready = 'false';
  f.document.querySelector = selector => selector === '.scene-canvas' ? f.canvas : selector === '.world' ? { classList: { contains: name => name === 'world-fallback' } } : null;
  f.capture.start(); f.frame(16); f.capture.stop();
  assert.equal(f.reports[0].start.fallback, true);
  assert.equal(f.reports[0].end.fallback, true);
  assert.equal(f.reports[0].start.ready, false);
  assert.ok(f.reports[0].start.canvas, 'existing canvas is retained as geometry evidence, not mistaken for successful WebGL');
  f.assertClean();
});


test('actual delivery delay is distinct from the native RAF timestamp', () => {
  const f = fixture(); f.capture.start();
  f.frame(4_000, 16); f.frame(6_000, 32); f.capture.stop();
  const report = f.reports[0];
  assert.equal(report.firstRAFDelayMs, 4_000);
  assert.equal(report.samples[0].at, 4_000);
  assert.equal(report.samples[0].frameTimestampMs, 16);
  assert.equal(report.samples[1].intervalMs, 16);
  assert.equal(report.samples[1].deliveryIntervalMs, 2_000);
  f.assertClean();
});
