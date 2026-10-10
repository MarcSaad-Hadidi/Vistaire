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
