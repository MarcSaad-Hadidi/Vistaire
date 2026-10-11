import assert from 'node:assert/strict';
import test from 'node:test';
import { bindJourneyViewport } from '../components/immersive/JourneyViewport.js';

function viewport({ width = 390, height = 844, touch = false } = {}) {
  const state = { width, height, touch, small: height, large: height };
  const properties = new Map();
  const classes = new Set();
  const listeners = new Map();
  const probes = [];
  const root = {
    get clientWidth() { return state.width; },
    style: { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) },
    classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name), remove: name => classes.delete(name) },
  };
  const view = {
    get innerHeight() { return state.height; },
    document: { documentElement: root, body: { append: probe => probes.push(probe) },
      createElement: () => ({ style: {}, getBoundingClientRect() { return { height: this.style.cssText.includes('100svh') ? state.small : state.large }; }, remove() { this.removed = true; } }),
    },
    matchMedia: query => ({ matches: query === '(orientation: portrait)' ? state.height >= state.width : state.touch }),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); },
  };
  return { view, properties, classes, listeners, probes,
    resize(next) { Object.assign(state, { ...next, small: next.small ?? next.height, large: next.large ?? next.height }); listeners.get('resize')?.(); },
    dimensions() { return [properties.get('--vistaire-journey-vh'), properties.get('--vistaire-scene-vh')]; },
  };
}

test('narrow desktop resizing follows live height across split events and stale viewport-unit probes', () => {
  const page = viewport();
  const release = bindJourneyViewport(page.view);
  assert.deepEqual(page.dimensions(), ['8.44px', '8.44px']);
  page.resize({ width: 430, height: 844 });
  assert.deepEqual(page.dimensions(), ['8.44px', '8.44px']);
  page.resize({ width: 430, height: 932 });
  assert.deepEqual(page.dimensions(), ['9.32px', '9.32px']);
  page.resize({ width: 430, height: 700 });
  assert.deepEqual(page.dimensions(), ['7px', '7px']);
  // Exact rendered CI failure: one native resize already reports 932px while
  // both CSS viewport-unit probes retain 844px until after the final event.
  page.resize({ width: 390, height: 844 });
  page.resize({ width: 430, height: 932, small: 844, large: 844 });
  assert.deepEqual(page.dimensions(), ['9.32px', '9.32px']);
  release();
});

test('touch toolbar-only changes freeze geometry; true width/orientation changes refresh and teardown releases it', () => {
  const page = viewport({ touch: true });
  const release = bindJourneyViewport(page.view);
  for (const height of [730, 820, 730, 844]) {
    page.resize({ width: 390, height });
    assert.deepEqual(page.dimensions(), ['8.44px', '8.44px']);
    assert.equal(page.classes.has('journey-compact'), false);
  }
  page.resize({ width: 430, height: 932 });
  assert.deepEqual(page.dimensions(), ['9.32px', '9.32px']);
  page.resize({ width: 844, height: 390 });
  assert.deepEqual(page.dimensions(), ['3.9px', '3.9px']);
  page.resize({ width: 390, height: 730, small: 700, large: 730 });
  assert.deepEqual(page.dimensions(), ['7px', '7.3px']);
  assert.equal(page.classes.has('journey-compact'), true);
  release();
  assert.equal(page.listeners.size, 0);
  assert.equal(page.properties.size, 0);
  assert.equal(page.classes.size, 0);
  assert.ok(page.probes.every(probe => probe.removed));
  page.resize({ width: 430, height: 932 });
  assert.equal(page.properties.size, 0, 'cleanup leaves no live resize writer');
});
