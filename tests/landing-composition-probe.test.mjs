import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Test the actual passive QA probe without a browser, GPU or extra RAF loop.
function fixture() {
  const source = readFileSync('scripts/diagnose-landing-composition.mjs', 'utf8');
  const start = source.indexOf('function installVisualProbe(');
  const end = source.indexOf('\nfunction installJourneyObservation(', start);
  assert.ok(start >= 0 && end > start);
  let now = 0, sequence = 0;
  const callbacks = new Map();
  const canvas = { dataset: { frames: '0' } };
  const window = {
    requestAnimationFrame(callback) { const id = ++sequence; callbacks.set(id, callback); return id; },
    cancelAnimationFrame(id) { callbacks.delete(id); },
  };
  vm.runInNewContext(`(${source.slice(start, end)})(true)`, {
    window, document: { hidden: false, querySelector: () => canvas, querySelectorAll: () => [] },
    performance: { now: () => now }, scrollY: 0,
  });
  return { window, canvas, callbacks, time(value) { now = value; },
    deliver(id, at) { now = at; const callback = callbacks.get(id); callbacks.delete(id); callback(at); },
    read: () => window.__compositionVisual.read(),
  };
}

test('passive composition evidence separates RAF delivery delay from callback duration', () => {
  const f = fixture();
  function render() { f.canvas.dataset.frames = String(Number(f.canvas.dataset.frames) + 1); f.time(9687.2); }
  const id = f.window.requestAnimationFrame(render);
  assert.equal(f.callbacks.size, 1, 'probe must not schedule an independent animation loop');
  f.deliver(id, 9685);
  const sample = f.read().samples[0];
  assert.equal(sample.startedAt - sample.requestedAt, 9685);
  assert.ok(Math.abs(sample.endedAt - sample.startedAt - 2.2) < 1e-9);
  assert.equal(sample.rendered, true);
  assert.equal(sample.pose.frames, '1');
});

test('pending age tracks only known scene callbacks and cancellation removes ownership', () => {
  const f = fixture();
  function render() { f.canvas.dataset.frames = '1'; }
  f.deliver(f.window.requestAnimationFrame(render), 10);
  f.time(20);
  const owned = f.window.requestAnimationFrame(render);
  f.window.requestAnimationFrame(() => {});
  f.time(5690.8);
  const pending = f.read().pending;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, owned);
  assert.equal(pending[0].ageMs, 5670.8);
  f.window.cancelAnimationFrame(owned);
  assert.equal(f.read().pending.length, 0);
  assert.equal(f.callbacks.size, 1, 'unrelated callback is untouched');
});

test('known callbacks that stop drawing remain observable without claiming a new render', () => {
  const f = fixture();
  let draw = true;
  function render() { if (draw) f.canvas.dataset.frames = '1'; }
  f.deliver(f.window.requestAnimationFrame(render), 10);
  draw = false;
  f.deliver(f.window.requestAnimationFrame(render), 20);
  assert.equal(f.read().samples.length, 2);
  assert.equal(f.read().samples[1].rendered, false);
  assert.equal(f.read().samples[1].pose.frames, '1');
});
