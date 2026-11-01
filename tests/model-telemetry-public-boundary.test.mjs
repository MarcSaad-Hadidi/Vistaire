import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as telemetry from '../components/dish/modelTelemetry.ts';

test('model and legacy AR events require an explicitly enabled public context', () => {
  assert.equal(typeof telemetry.trackPublicModelEvent, 'function');
  const previousWindow = globalThis.window, previousFetch = globalThis.fetch;
  const sent = [], storage = new Map();
  globalThis.window = { innerWidth: 390, location: { search: '' }, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } };
  globalThis.fetch = async (_url, request) => { sent.push(JSON.parse(request.body)); return { ok: true }; };
  const context = { restaurantId: '11111111-1111-4111-8111-111111111112', menuId: '22222222-2222-4222-8222-222222222223', source: 'production' };
  try {
    for (const eventName of ['model_load_started', 'dish_ar_clicked']) {
      telemetry.trackPublicModelEvent(false, context, { eventName, dishSlug: 'preview' });
      telemetry.trackPublicModelEvent(true, undefined, { eventName, dishSlug: 'missing' });
      telemetry.trackPublicModelEvent(true, {}, { eventName, dishSlug: 'invalid' });
    }
    assert.equal(sent.length, 0);
    let enabled = true, now = 0;
    const model = telemetry.createModelTelemetry({ now: () => now, emit: event => telemetry.trackPublicModelEvent(enabled, context, { ...event, dishSlug: 'public' }) });
    model.start(); model.loaded(); model.visibility(true); model.arIntent();
    telemetry.trackPublicModelEvent(true, context, { eventName: 'dish_ar_clicked', dishSlug: 'public' });
    assert.deepEqual(sent.map(event => event.eventName), ['model_load_started', 'model_load_succeeded', 'ar_outcome', 'dish_ar_clicked']);
    assert.ok(sent.every(event => event.source === 'production' && event.menuId === context.menuId));
    enabled = false; now = 2000;
    model.interact('rotate'); model.arOutcome('unknown'); model.flush(); model.dispose();
    telemetry.trackPublicModelEvent(enabled, context, { eventName: 'dish_ar_clicked', dishSlug: 'public' });
    assert.equal(sent.length, 4, 'disabling suppresses late outcomes, interactions and cleanup dwell');
    telemetry.trackPublicModelEvent(true, { ...context, source: 'demo' }, { eventName: 'model_load_started', dishSlug: 'public-demo' });
    assert.equal(sent.at(-1).source, 'demo');
  } finally { globalThis.window = previousWindow; globalThis.fetch = previousFetch; }
});

test('viewer defaults disabled and preview-capable wrappers explicitly pass their mode', () => {
  const read = path => readFileSync(path, 'utf8');
  assert.match(read('components/dish/DishModelViewer.tsx'), /analyticsEnabled = false/);
  assert.doesNotMatch(read('components/dish/DishModelViewer.tsx'), /trackMenuEvent\(/);
  for (const file of ['MaisonElyseDishDetail', 'TrouvablePremiumMenuExperience']) {
    assert.match(read(`components/menu/${file}.tsx`), /analyticsEnabled=\{displayMode === "public"\}/);
  }
  assert.match(read('components/menu/PublicDishDetailExperience.tsx'), /analyticsEnabled=\{mode === "public"\}/);
  assert.match(read('components/menu/TrouvableDishDetailSurface.tsx'), /analyticsEnabled=\{analyticsEnabled\}/);
  const hook = read('components/dish/useModelTelemetry.ts');
  assert.match(hook, /useLayoutEffect\(/);
  assert.match(hook, /if \(!enabled \|\| !context\) return/);
  assert.match(hook, /\[loaded, failure, attempt, enabled, modelSource, hasModel, dishSlug, categorySlug, context\?\.restaurantId, context\?\.menuId, context\?\.source\]/);
});

test('hook layout revocation precedes passive disposal, while public unmount flushes its original tenant', async () => {
  const vm = await import('node:vm');
  const { default: ts } = await import('typescript');
  const source = readFileSync('components/dish/useModelTelemetry.ts', 'utf8');
  for (const disableBeforeUnmount of [false, true]) {
    let now = 0, cursor = 0, layout = [], effects = [];
    const refs = [], sent = [], observers = [], timers = new Set();
    class Element extends EventTarget {
      parentElement = null;
      closest() { return null; }
    }
    class IntersectionObserver {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {} disconnect() {}
    }
    class MutationObserver { observe() {} disconnect() {} }
    const hookModule = { exports: {} };
    const runtime = {
      module: hookModule, exports: hookModule.exports,
      require(name) {
        if (name === 'react') return {
          useRef(value) { const index = cursor++; return refs[index] ??= { current: value }; },
          useCallback(callback) { return callback; },
          useLayoutEffect(effect) { layout.push(effect); },
          useEffect(effect) { effects.push(effect); }
        };
        if (name === './modelTelemetry') return {
          createModelTelemetry: telemetry.createModelTelemetry,
          trackPublicModelEvent(enabled, context, event) { if (enabled && context) sent.push({ ...event, ...context }); }
        };
        throw new Error(`Unexpected import ${name}`);
      },
      crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' },
      performance: { now: () => now },
      window: new EventTarget(),
      document: Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => true }),
      IntersectionObserver, MutationObserver,
      setTimeout: callback => (timers.add(callback), callback),
      clearTimeout: callback => timers.delete(callback),
      setInterval: callback => (timers.add(callback), callback),
      clearInterval: callback => timers.delete(callback)
    };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, runtime);
    const context = { restaurantId: 'public-tenant', menuId: 'public-menu', source: 'production' };
    const render = (enabled, nextContext = context) => {
      cursor = 0; layout = []; effects = [];
      return hookModule.exports.useModelTelemetry({ enabled, context: nextContext, dishSlug: 'soup', categorySlug: 'main', attempt: 0, modelSource: '/model.glb', hasModel: true, loaded: true, failure: null });
    };
    const preview = render(false);
    preview.bindNode(new Element());
    layout.forEach(effect => effect());
    effects.forEach(effect => effect());
    preview.arIntent(); preview.arOutcome('unknown');
    assert.equal(sent.length, 0, 'initial preview emits no lifecycle or legacy AR');
    assert.equal(timers.size, 0);
    const api = render(true);
    api.bindNode(new Element());
    layout.forEach(effect => effect());
    const cleanup = effects.map(effect => effect()).filter(Boolean);
    observers.at(-1).callback([{ isIntersecting: true, intersectionRatio: 1 }]);
    api.arIntent();
    now = 5000;
    const before = sent.length;
    if (disableBeforeUnmount) {
      render(false, { ...context, restaurantId: 'private-preview' });
      layout.forEach(effect => effect());
      api.arOutcome('unknown');
      for (const timer of [...timers]) timer();
    }
    cleanup.forEach(dispose => dispose());
    if (disableBeforeUnmount) assert.equal(sent.length, before, 'no delayed or disposal event after preview commit');
    else {
      const duration = sent.find(event => event.eventName === 'model_active_duration');
      assert.equal(duration.metadata.durationMs, 5000);
      assert.equal(duration.restaurantId, 'public-tenant');
    }
    assert.equal(timers.size, 0);
  }
});

test('dependency-aware hook replays cached readiness when preview becomes public or source changes', async () => {
  const vm = await import('node:vm');
  const { default: ts } = await import('typescript');
  const source = readFileSync('components/dish/useModelTelemetry.ts', 'utf8');
  const exercise = sourceText => {
    const refs = [], slots = [], calls = [];
    let refIndex = 0, effectIndex = 0, pending = [];
    const effect = (callback, dependencies, phase) => {
      const index = effectIndex++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        pending.push({ index, callback, dependencies, phase });
      }
    };
    const hookModule = { exports: {} };
    vm.runInNewContext(ts.transpileModule(sourceText, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      module: hookModule, exports: hookModule.exports,
      require(name) {
        if (name === 'react') return {
          useRef(value) { return refs[refIndex++] ??= { current: value }; },
          useCallback(callback) { return callback; },
          useLayoutEffect(callback, dependencies) { effect(callback, dependencies, 'layout'); },
          useEffect(callback, dependencies) { effect(callback, dependencies, 'passive'); }
        };
        if (name === './modelTelemetry') return {
          trackPublicModelEvent() {},
          createModelTelemetry: () => ({ start: () => calls.push('start'), loaded: () => calls.push('loaded'), failed: () => calls.push('failed'), dispose: () => calls.push('dispose') })
        };
        throw new Error(name);
      },
      crypto: { randomUUID: () => 'attempt' }, performance: { now: () => 0 }, clearTimeout() {}
    });
    const context = { restaurantId: 'tenant', menuId: 'menu', source: 'production' };
    const render = (enabled, modelSource, dishSlug = "dish", categorySlug = "main") => {
      refIndex = 0; effectIndex = 0; pending = [];
      hookModule.exports.useModelTelemetry({ enabled, context, dishSlug, categorySlug, attempt: 0, modelSource, hasModel: true, loaded: true, failure: null });
      for (const phase of ['layout', 'passive']) {
        const updates = pending.filter(update => update.phase === phase);
        for (const update of updates) slots[update.index]?.cleanup?.();
        for (const update of updates) slots[update.index] = { dependencies: update.dependencies, cleanup: update.callback() };
      }
    };
    render(false, 'first.glb');
    assert.deepEqual(calls, []);
    render(true, 'first.glb');
    const enabledCalls = [...calls];
    render(true, 'second.glb');
    render(true, 'second.glb', 'next-dish', 'dessert');
    return { enabledCalls, calls };
  };
  const baseline = source.replace('[loaded, failure, attempt, enabled, modelSource, hasModel, dishSlug, categorySlug, context?.restaurantId, context?.menuId, context?.source]', '[loaded, failure, attempt]');
  assert.deepEqual(exercise(baseline).enabledCalls, ['start'], 'harness detects the original missing readiness transition');
  const result = exercise(source);
  assert.deepEqual(result.enabledCalls, ['start', 'loaded']);
  assert.deepEqual(result.calls, ['start', 'loaded', 'dispose', 'start', 'loaded', 'dispose', 'start', 'loaded']);
});
