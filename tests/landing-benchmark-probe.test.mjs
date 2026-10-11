import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the exact browser probe without launching a browser or GPU process.
function probeFixture(canvas = null) {
  const source = readFileSync(process.env.VISTAIRE_BENCHMARK_SOURCE || 'scripts/benchmark-landing.mjs', 'utf8');
  const start = source.indexOf('function installProbe()');
  const end = source.indexOf('\n\nconst sleep', start);
  assert.ok(start >= 0 && end > start);
  let now = 0;
  const rafs = [], observers = [];
  class Observer {
    static supportedEntryTypes = ['longtask'];
    constructor(callback) { observers.push(callback); }
    observe() {}
  }
  const window = { requestAnimationFrame(callback) { rafs.push(callback); } };
  const scope = {
    window,
    document: { querySelector: selector => selector === '.scene-canvas' ? canvas : null, querySelectorAll: () => [], createElement: name => ({ tagName: name.toUpperCase() }), documentElement: { dataset: {} }, hidden: false, visibilityState: 'visible' },
    performance: { now: () => now, setResourceTimingBufferSize() {}, getEntriesByType: () => [] },
    PerformanceObserver: Observer, navigator: {}, matchMedia: () => ({ matches: false }),
    innerWidth: 1440, innerHeight: 900, scrollY: 0, devicePixelRatio: 1,
  };
  vm.runInNewContext(`(${source.slice(start, end)})();`, scope);
  return {
    probe: window.__vistaireBenchmark,
    time(value) { now = value; },
    frame(value, wallTime = value) { now = wallTime; for (const callback of rafs.splice(0)) callback(value); },
    tasks(entries) { for (const callback of observers) callback({ getEntries: () => entries }); },
  };
}

test('benchmark RAF intervals never cross workload or reporting phase boundaries', () => {
  const fixture = probeFixture();
  fixture.frame(0);
  fixture.frame(10);
  fixture.time(15);
  fixture.probe.phase('idle');
  fixture.frame(14, 20); // A late RAF callback can carry a pre-boundary timestamp.
  fixture.frame(20);
  fixture.frame(30);
  fixture.time(35);
  if (fixture.probe.endPhase) fixture.probe.endPhase('idle:end');
  else fixture.probe.phase('between-phases');
  fixture.frame(1000); // report/driver delay must not become an idle interval
  fixture.frame(1010);
  fixture.time(1015);
  fixture.probe.phase('phone');
  fixture.frame(1020);
  fixture.frame(1030);
  const report = fixture.probe.report();
  for (const name of ['idle', 'phone']) {
    const phase = report.phases.find(phase => phase.name === name);
    assert.equal(phase.browserRAFIntervalMs.count, 1, `${name}: exclude straddling interval`);
    assert.equal(phase.browserRAFIntervalMs.total, 10);
  }
});

test('buffered long tasks retain their actual workload or explicit boundary attribution', () => {
  const fixture = probeFixture();
  fixture.time(15);
  fixture.probe.phase('idle');
  fixture.time(35);
  if (fixture.probe.endPhase) fixture.probe.endPhase('idle:end');
  else fixture.probe.phase('between-phases');
  fixture.time(50);
  fixture.tasks([{ startTime: 23, duration: 4 }, { startTime: 34, duration: 3 }]);
  const report = fixture.probe.report();
  assert.equal(report.phases.find(phase => phase.name === 'idle')?.longTasks.total, 4);
  assert.equal(report.phases.find(phase => phase.name === 'phase-boundary')?.longTasks.total, 3);
});

test('immutable WebGL renderer metadata is queried once per document', () => {
  let reads = 0;
  const gl = { VERSION: 'version', RENDERER: 'renderer', VENDOR: 'vendor', getExtension: () => null, getParameter(value) { reads++; return value; } };
  const fixture = probeFixture({ isConnected: true, dataset: {}, getContext: () => gl });
  const first = fixture.probe.report();
  assert.equal(reads, 3);
  fixture.probe.phase('idle');
  const second = fixture.probe.report();
  assert.equal(reads, 3, 'reporting an active workload must not issue another metadata query');
  assert.deepEqual(first.webgl, second.webgl);
});

function cleanupFixture({ browser, server = null, bounded, sleep = async () => {} }) {
  const source = readFileSync(process.env.VISTAIRE_COMPOSITION_SOURCE || 'scripts/diagnose-landing-composition.mjs', 'utf8');
  const describe = source.indexOf('function describeCleanupError(');
  const start = source.indexOf('async function stopRuntime(');
  const end = source.indexOf('\nasync function startRuntime', start);
  assert.ok(start >= 0 && end > start);
  const scope = { browser, browserClosePromise: null, server, report: { cleanup: [] }, bounded, sleep, Date, AggregateError };
  vm.runInNewContext(source.slice(describe >= 0 ? describe : start, end), scope);
  return scope;
}

test('composition cleanup retains nested failure evidence and unknown owned resources', async () => {
  const browser = { isConnected: () => true, close: async () => { throw new Error('browser shutdown failed'); } };
  const signals = [];
  const server = { pid: 42, exitCode: null, signalCode: null, once() {}, kill(signal) { signals.push(signal); return true; } };
  const scope = cleanupFixture({ browser, server, bounded: action => action() });
  await assert.rejects(scope.stopRuntime('baseline:1'), /Unknown cleanup completion/);
  assert.equal(scope.browser, browser);
  assert.equal(scope.server, server);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  const record = scope.report.cleanup[0];
  assert.ok(record, 'The exact failed resource must survive report serialization');
  assert.equal(record.complete, false);
  assert.equal(record.browser.closed, false);
  assert.equal(record.server.exited, false);
  assert.match(record.errors[0].message, /browser shutdown failed/);
  assert.match(record.errors[1].message, /Server cleanup/);
  assert.ok(record.startedAt && record.finishedAt && record.elapsedMs >= 0);
  const serialized = scope.describeCleanupError(new AggregateError([new Error('nested cause')], 'outer failure'));
  assert.match(JSON.stringify(serialized), /nested cause/);
});

test('composition cleanup awaits one original owned shutdown within the existing action bound', async () => {
  let calls = 0, resolveClose;
  const original = new Promise(resolve => { resolveClose = resolve; });
  const browser = { isConnected: () => true, close() { calls++; return original; } };
  const scope = cleanupFixture({
    browser,
    bounded: async (action, name, milliseconds = 40_000) => {
      assert.equal(name, 'browser cleanup');
      // Mock a legitimate3s shutdown. The old2s race abandons this lifecycle.
      assert.ok(milliseconds >= 30_000, 'Allow Playwright’s own30s graceful shutdown/kill sequence');
      const pending = action();
      assert.equal(pending, original);
      resolveClose();
      return pending;
    },
  });
  if (scope.closeOwnedBrowser) {
    assert.equal(scope.closeOwnedBrowser(), original, 'A deadline can initiate the same shutdown');
    assert.equal(scope.closeOwnedBrowser(), original, 'Repeated cleanup must retain the original promise');
  }
  await scope.stopRuntime('baseline:1');
  assert.equal(calls, 1);
  assert.equal(scope.browser, null);
  assert.equal(scope.browserClosePromise, null);
  assert.equal(scope.report.cleanup[0].complete, true);
  assert.equal(scope.report.cleanup[0].browser.closed, true);
});

function journeyFixture() {
  const source = readFileSync(process.env.VISTAIRE_COMPOSITION_SOURCE || 'scripts/diagnose-landing-composition.mjs', 'utf8');
  const start = source.indexOf('function journeyPlan(');
  const end = source.indexOf('\nasync function journeyPass(', start);
  assert.ok(start >= 0 && end > start, 'Candidate-only journey validation must exist');
  const scope = { assert };
  vm.runInNewContext(source.slice(start, end), scope);
  return scope;
}

function journeyGeometry() {
  const ids = ['hero', 'ai', 'wearable', 'features', 'encryption', 'grip', 'sustainability', 'testimonies', 'social-content', 'product', 'open-weight', 'footer'];
  let top = 1200;
  const regions = ids.map((id, i) => {
    const height = i < 3 ? 100 : ['features', 'social-content'].includes(id) ? 1120 : i < 10 ? 720 : i === 10 ? 1000 : 300;
    const region = { id, top: i < 3 ? 0 : top, height, stageHeight: 100 };
    if (i >= 3) top += height;
    return region;
  });
  const windows = regions.slice(2, -1).map((region, i) => {
    const next = regions[i + 3];
    const end = next.top + (next.id === 'footer' ? 0 : 110);
    return { from: region.id, to: next.id, start: end - 320, end };
  });
  return { regions, windows, opening: { top: 0, height: 1200, stageHeight: 100, motionVH: 840, phoneHoldVH: 150 }, maxScroll: top - 100 };
}

test('candidate journey covers all real joins, opening holds and seven interiors without accepting missing geometry', () => {
  const { journeyPlan } = journeyFixture();
  const geometry = journeyGeometry();
  const plan = journeyPlan(geometry);
  assert.equal(plan.filter(span => span.kind === 'join').length, 9);
  assert.equal(plan.filter(span => span.kind === 'opening').length, 4);
  assert.equal(plan.filter(span => span.kind === 'presentation').length, 7);
  assert.equal(plan.filter(span => span.kind === 'native').length, 2);
  assert.deepEqual(Array.from(plan.filter(span => span.kind === 'opening'), span => (span.end - span.start) / 100), [3.2, 2, 3.2, 1.5]);
  assert.deepEqual(Array.from(plan.filter(span => span.kind === 'presentation'), span => (span.end - span.start) / 100), [8, 4, 4, 4, 4, 8, 4]);
  for (const mutate of [
    value => value.regions.pop(),
    value => value.windows.pop(),
    value => { value.windows[4].end = NaN; },
    value => { value.opening.motionVH = 640; },
    value => { value.windows[1].start -= 400; },
  ]) {
    const invalid = structuredClone(geometry); mutate(invalid);
    assert.throws(() => journeyPlan(invalid));
  }
});

test('journey checkpoints fail closed on missing rendered pose, coverage, scrim, card or decoded-video evidence', () => {
  const { assertJourneySample } = journeyFixture();
  const sample = {
    viewport: [390, 844], dpr: 1, drawingBuffer: [390, 844], scroll: 844,
    canvas: { top: 0, left: 0, right: 390, bottom: 844 }, world: { top: 0, left: 0, right: 390, bottom: 844 },
    data: { ready: 'true', frames: '12', drawCalls: '2', suspended: 'false', processedScrollDistance: '1', roomPosition: '0.000,0.000,0.000', roomYaw: '0.0000', fittedCameraPosition: '1,2,3', fittedLook: '0,0,0', dishPosition: '1,2,3', dishScale: '1,1,1', dishQuaternion: '0,0,0,1', supportPosition: '1,2,3', supportScale: '1,1,1', supportQuaternion: '0,0,0,1', phonePosition: '1,2,3', phoneScale: '1,1,1', phoneQuaternion: '0,0,0,1', laptopPosition: '1,2,3', laptopScale: '1,1,1', laptopQuaternion: '0,0,0,1' },
    identities: { copyOpacity: '0.5', stageBackground: 'rgba(0, 0, 0, 0)', scrim: { content: '\"\"', opacity: '0.5', background: 'rgba(17, 17, 16, 0.4)' } },
    raf: { dropped: 0, hidden: false, last: { pose: { frames: '12' } } },
    copy: { 'open-weight': { rect: { top: 2000, bottom: 3000 } } },
    presentation: { featureIndex: 1, featureDots: [1], featureHeading: 'Readable card', featureOpacity: 1, socialIndex: 1, socialPager: [1], railProgress: 1, videos: [{ socialIndex: 1, connected: true, paused: false, readyState: 4, decodedFrames: 10, decodedClass: true, rate: 1 }] },
  };
  assertJourneySample(sample, 100, 'features', 1);
  assertJourneySample(sample, 100, 'social-content', 1);
  for (const mutate of [
    value => { value.data.dishPosition = ''; },
    value => { value.canvas.bottom = 843; },
    value => { value.identities.scrim.opacity = '0'; },
    value => { value.raf.last.pose.frames = '11'; },
    value => { value.presentation.featureDots = [0]; },
    value => { value.presentation.videos[0].decodedFrames = 0; },
    value => { value.data.suspended = 'true'; },
  ]) {
    const invalid = structuredClone(sample); mutate(invalid);
    assert.throws(() => { assertJourneySample(invalid, 100, 'features', 1); assertJourneySample(invalid, 100, 'social-content', 1); });
  }
});
