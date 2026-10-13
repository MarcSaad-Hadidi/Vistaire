import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { scaledCinematicTiming, measureChapterTransitions, chapterNavigationTarget, readingTiming } from '../components/immersive/SceneDirector.js';

import { createEntryScrollAssist } from '../components/immersive/EntryScrollAssist.js';

function geometry(stageHeight = 844, pace = 1) {
  const timing = scaledCinematicTiming(1 / pace);
  const opening = { top: 0, stageHeight, motionTravel: timing.openingMotionScreens * stageHeight, aiHoldTravel: timing.aiHoldScreens * stageHeight };
  let top = (1 + timing.openingMotionScreens + timing.phoneHoldScreens + timing.openingReleaseScreens) * stageHeight;
  const ids = ['hero', 'ai', 'wearable', 'features', 'encryption', 'grip', 'sustainability', 'testimonies', 'social-content', 'product', 'open-weight', 'footer'];
  const measurements = ids.map((id, index) => {
    if (index < 3) return { id, top: opening.motionTravel * index / 2, travel: 1 };
    const travel = stageHeight * (['features', 'social-content'].includes(id) ? timing.readingSceneScreens : timing.sceneScreens);
    const result = { id, top, travel };
    top += travel + stageHeight;
    return result;
  });
  return { opening, transitions: measureChapterTransitions(measurements, opening, timing) };
}

function fixture({ fine = false, scrollend = true, stageHeight = 844, pace = 1, diagnostics = true, consumer = diagnostics, reporterThrows = false, nativeMotion = true } = {}) {
  assert.equal(typeof createEntryScrollAssist, 'function', 'the entry assist helper must exist');
  const listeners = new Map(), timers = new Map(), calls = [], reports = [];
  let clock = 0, timerId = 0, nativeTimer = null, blocked = false;
  const target = { closest: () => null };
  const emitter = () => ({
    addEventListener(type, handler) { const handlers = listeners.get(this) || new Map(); const set = handlers.get(type) || new Set(); set.add(handler); handlers.set(type, set); listeners.set(this, handlers); },
    removeEventListener(type, handler) { listeners.get(this)?.get(type)?.delete(handler); },
  });
  const media = { ...emitter(), matches: false };
  const document = { ...emitter(), hidden: false, activeElement: target };
  if (scrollend) document.onscrollend = null;
  const view = {
    ...emitter(), document, innerHeight: stageHeight, scrollY: 0,
    location: { search: diagnostics ? "?sceneDiagnostics=1" : "" },
    __vistaireScrollAssistTrace: consumer ? row => { if (reporterThrows) throw new Error("diagnostic consumer failed"); reports.push(row); } : undefined,
    performance: { now: () => clock }, matchMedia: query => query.includes('pointer: fine') ? { ...emitter(), matches: fine } : media,
    setTimeout(callback, delay) { timers.set(++timerId, { callback, at: clock + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { timers.set(++timerId, { callback, at: clock + 16, frame: true }); return timerId; },
    cancelAnimationFrame(id) { timers.delete(id); },
    scrollTo(options) {
      calls.push(options);
      view.clearTimeout(nativeTimer);
      if (nativeMotion) {
        view.scrollY = options.top;
        nativeTimer = view.setTimeout(() => emit(view, 'scroll', { target: document }), 1);
      }
    },
  };
  const bounds = geometry(stageHeight, pace);
  const assist = createEntryScrollAssist({ getGeometry: () => bounds, isBlocked: () => blocked }, view);
  const emit = (object, type, extra = {}) => {
    const event = { type, target, timeStamp: clock, isTrusted: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    for (const handler of listeners.get(object)?.get(type) || []) handler(event);
    return event;
  };
  const input = (type, extra) => emit(document, type, extra);
  const move = y => { view.scrollY = y; emit(view, 'scroll', { target: document }); };
  const wheel = (y, direction = 1, extra = {}) => {
    move(y - direction * 20);
    input('wheel', { deltaY: direction * 20, deltaX: 0, ...extra });
    move(y);
  };
  const end = () => emit(document, 'scrollend', { target: document });
  const advance = ms => {
    const until = clock + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next; timers.delete(id); clock = timer.at; if (timer.frame) timer.callback(clock); else timer.callback();
    }
    clock = until;
  };
  return { assist, bounds, view, document, media, target, calls, reports, now: () => clock, stall: ms => { clock += ms; for (const timer of timers.values()) if (timer.at < clock) timer.at = clock; }, frames: () => [...timers.values()].filter(timer => timer.frame).length, input, move, wheel, end, advance, timers, listeners, emit, block: value => { blocked = value; } };
}

// Gesture trips; a page left at rest may also return to its nearest stop.
const gestureTrips = f => f.reports.filter(row => row.type === 'handoff' && row.source !== 'idle-nearest');
const assistedTargets = f => gestureTrips(f).map(row => row.target);

function authoredReadingStops(bounds, pace = 1) {
  const { opening, transitions } = bounds, timing = scaledCinematicTiming(1 / pace);
  return [
    ...[['hero', 0], ['ai', .5], ['wearable', 1]].map(([id, anchor]) => ({ id, y: opening.top + opening.motionTravel * anchor })),
    ...transitions.filter(join => !['open-weight', 'footer'].includes(join.to.id)).map(join => {
      const y = chapterNavigationTarget(join.to, opening.stageHeight, timing);
      assert.ok(Math.abs(y - join.end) < 1e-7, 'incoming end must match the existing navigation pose');
      return { id: join.to.id, y };
    }).flatMap(stop => {
      // Internal stable poses: the open laptop and options 2 and 3 of each reading chapter.
      const join = transitions.find(candidate => candidate.to.id === stop.id), from = join.from;
      const internal = from.id === 'sustainability' ? [['sustainability-open', (timing.sceneScreens - timing.edgeScreens) / timing.sceneScreens]]
        : ['features', 'social-content'].includes(from.id) ? readingTiming().transitions.map(([, end], index) => [`${from.id}-option-${index + 2}`, end]) : [];
      return [...internal.map(([id, progress]) => ({ id, y: from.top + from.travel * progress })), stop];
    }),
  ];
}


test('fresh wheel, touch, key or pointer immediately stops the controlled frames without a reset write', () => {
  for (const [type, extra] of [['wheel', { deltaY: -20 }], ['touchstart', { touches: [{ clientY: 100 }] }], ['keydown', { key: 'Escape' }], ['pointerdown', {}]]) {
    const f = fixture(), join = f.bounds.transitions[0];
    f.wheel(join.end - 40); f.end(); f.advance(40); f.move(join.end - 20);
    const writes = f.calls.length;
    f.input(type, extra);
    assert.equal(f.calls.length, writes, type);
    assert.equal(f.frames(), 0, type);
    f.end(); f.advance(40); f.advance(1000);
    assert.equal(assistedTargets(f).length, 1, `${type} needs fresh matching scroll before another assist`);
    f.assist.dispose();
  }
});

test('direct anchors, synthetic input, controls, editing and stale intent cannot arm entry assistance', () => {
  for (const kind of ['programmatic', 'hash', 'cancel', 'untrusted', 'control', 'focused-control', 'home']) {
    const f = fixture(), y = f.bounds.transitions[0].end - 40;
    const control = { closest: () => ({}) };
    if (kind === 'focused-control') f.document.activeElement = control;
    if (kind === 'programmatic') f.move(y);
    else if (kind === 'home') { f.input('keydown', { key: 'Home' }); f.move(y); }
    else {
      f.view.scrollY = y - 20;
      f.input('wheel', { deltaY: 20, target: kind === 'control' ? control : f.target, isTrusted: kind !== 'untrusted' });
      if (kind === 'hash') f.emit(f.view, 'hashchange');
      if (kind === 'cancel') f.assist.cancel();
      f.move(y);
    }
    f.end(); f.advance(40); f.advance(1000);
    assert.equal(gestureTrips(f).length, 0, kind);
    f.assist.dispose();
  }
  const touch = fixture(), y = touch.bounds.transitions[0].end - 40;
  touch.view.scrollY = y - 20;
  touch.input('touchstart', { touches: [{ clientY: 200 }] });
  touch.input('touchmove', { touches: [{ clientY: 180 }] }); touch.move(y);
  touch.assist.cancel();
  touch.input('touchmove', { touches: [{ clientY: 170 }] }); touch.move(y + 10);
  touch.input('touchend', { touches: [] }); touch.end();
  assert.equal(touch.calls.length, 0, 'navigation cancellation discards the rest of the old touch gesture');
  touch.assist.dispose();
});

test('a no-pixel same-direction tail retains native motion without rearming a completed stop', () => {
  for (const scrollend of [true, false]) {
    const f = fixture({ scrollend }), target = f.bounds.transitions[0].end;
    f.wheel(target - 40); f.advance(20); f.input('wheel', { deltaY: 0.1, deltaX: 0 });
    f.end(); f.advance(scrollend ? 39 : 279); assert.equal(f.calls.length, 0);
    f.advance(1); assert.deepEqual(assistedTargets(f), [target]);
    f.advance(3000); f.input('wheel', { deltaY: 0.1, deltaX: 0 }); f.end(); f.advance(1000);
    assert.equal(assistedTargets(f).length, 1, 'a consumed gesture needs fresh native motion');
    f.assist.dispose();
  }
  const reverse = fixture(); reverse.wheel(100); reverse.input('wheel', { deltaY: -0.1 });
  reverse.end(); reverse.advance(1000); assert.equal(reverse.calls.length, 0); reverse.assist.dispose();
  const keyboard = fixture(); keyboard.wheel(100); keyboard.input('keydown', { key: 'PageDown' });
  keyboard.input('keyup', { key: 'PageDown' }); keyboard.end(); keyboard.advance(1000);
  assert.equal(keyboard.calls.length, 0, 'input families cannot borrow motion'); keyboard.assist.dispose();
});

test('stale button or link focus permits background wheel and touch while control targets and editing focus stay excluded', () => {
  const element = tag => ({ closest: selector => selector.split(',').map(part => part.trim()).includes(tag) ? {} : null });
  for (const tag of ['button', 'a', '[role="button"]', '[role="tab"]']) for (const input of ['wheel', 'touch']) {
    const f = fixture(), join = f.bounds.transitions[0], y = join.end - 40;
    const control = element(tag);
    f.document.activeElement = control;
    if (input === 'wheel') f.wheel(y);
    else {
      f.view.scrollY = y - 20;
      f.input('touchstart', { touches: [{ clientY: 200 }] });
      f.input('touchmove', { touches: [{ clientY: 180 }] }); f.move(y);
      f.input('touchend', { touches: [] });
    }
    f.end(); f.advance(40);
    assert.deepEqual(assistedTargets(f), [join.end], `${tag} stale focus, ${input} on background`);
    f.move(join.end); f.end(); f.advance(40);
    f.wheel(y, 1, { target: control }); f.end(); f.advance(40);
    f.input('keydown', { key: 'PageDown', target: control }); f.move(y + 10);
    f.input('keyup', { key: 'PageDown', target: control }); f.end(); f.advance(40);
    assert.equal(assistedTargets(f).length, 1, 'events targeting the focused control still cannot arm assistance');
    f.assist.dispose();
  }
  for (const tag of ['input', 'textarea', '[contenteditable]:not([contenteditable="false"])', '[role="dialog"]', '[role="menu"]']) {
    const f = fixture();
    f.document.activeElement = element(tag);
    f.wheel(f.bounds.transitions[0].end - 40); f.end(); f.advance(40);
    assert.equal(f.calls.length, 0, `${tag} focus keeps its existing protection`);
    f.assist.dispose();
  }
});

test('touch and keyboard retain ownership while held with or without scrollend support', () => {
  for (const scrollend of [true, false]) for (const type of ['touch', 'key']) {
    const f = fixture({ scrollend }), target = f.bounds.transitions[0].end;
    f.move(target - 100);
    if (type === 'touch') { f.input('touchstart', { touches: [{ clientY: 200 }] }); f.input('touchmove', { touches: [{ clientY: 180 }] }); }
    else f.input('keydown', { key: 'PageDown' });
    f.move(target - 80); f.end(); f.advance(1000); assert.equal(f.calls.length, 0);
    if (type === 'touch') f.input('touchend', { touches: [] });
    else f.input('keyup', { key: 'PageDown' });
    // WebKit can emit the only scrollend before keyup; release must reuse it.
    // A released touch never waits for quiet or inertia.
    f.advance(scrollend || type === 'touch' ? 39 : 279); assert.equal(f.calls.length, 0);
    f.advance(1); assert.deepEqual(assistedTargets(f), [target]);
    f.assist.dispose();
  }
});

test('blocked, hidden, reduced-motion, pricing reading and footer spans remain native; disposal removes all work', () => {
  for (const kind of ['blocked', 'hidden', 'reduced', 'pricing', 'footer']) {
    const f = fixture(), pricing = f.bounds.transitions.find(join => join.to.id === 'open-weight');
    if (kind === 'blocked') f.block(true);
    if (kind === 'hidden') f.document.hidden = true;
    if (kind === 'reduced') f.media.matches = true;
    const y = kind === 'pricing' ? pricing.end + 40 : kind === 'footer' ? f.bounds.transitions.at(-1).end - 40
      : f.bounds.transitions[0].end - 40;
    f.wheel(y); f.end(); f.advance(1000);
    assert.equal(f.calls.length, 0, kind); f.assist.dispose();
  }
  const f = fixture({ scrollend: false });
  f.wheel(f.bounds.transitions[0].end - 40);
  f.assist.dispose(); f.advance(1000); f.end();
  assert.equal(f.calls.length, 0); assert.equal(f.timers.size, 0);
  assert.equal([...f.listeners.values()].reduce((sum, types) => sum + [...types.values()].reduce((n, handlers) => n + handlers.size, 0), 0), 0);
});

test('App cancels entry assistance before measured navigation and disposes its single listener owner', () => {
  const source = readFileSync('components/immersive/App.jsx', 'utf8');
  const start = source.indexOf('  const goto = useCallback(');
  const end = source.indexOf('  const currentDish =', start);
  const sequence = [];
  const scope = { useCallback: fn => fn, reduce: false, setMenu: () => sequence.push('menu'),
    stateRef: { current: { cancelEntryAssist: () => sequence.push('cancel'), pricingNavigationTarget: () => 12000 } },
    scrollTo: value => sequence.push(['scroll', value.top]), history: { replaceState: () => sequence.push('history') } };
  vm.runInNewContext(`${source.slice(start, end)}; this.navigate = goto;`, scope);
  scope.navigate('open-weight');
  assert.equal(sequence[0], 'cancel');
  assert.deepEqual(sequence.find(value => Array.isArray(value)), ['scroll',12000]);
  assert.match(source, /entryAssist\.dispose\(\)/);
  assert.match(source, /getGeometry: \(\) => \(\{ opening, transitions, pricing: stateRef\.current\.pricingReadingStops\?\.\(\) \}\)/);
  assert.match(source, /arActive: arStatus !== "idle"/);
});

test('diagnostics are opt-in and cannot change scroll outputs, timer lifecycle, cancellation or disposal', () => {
  const run = options => {
    const f = fixture(options), states = [], target = f.bounds.transitions[0].end;
    const snapshot = () => states.push({ y: f.view.scrollY, calls: structuredClone(f.calls), timers: [...f.timers.values()].map(timer => timer.at), listeners: [...f.listeners.values()].flatMap(types => [...types.values()].map(handlers => handlers.size)) });
    f.wheel(target - 50); snapshot(); f.end(); f.advance(40); snapshot();
    f.input('pointerdown', {}); snapshot();
    f.wheel(target - 20, -1); f.move(target - 40); f.end(); f.advance(40); snapshot();
    f.assist.cancel('layout-changed'); snapshot();
    f.input('wheel', { deltaY: 20 }); f.advance(750); f.move(target - 10); f.end(); f.advance(40); snapshot();
    f.input('keydown', { key: 'PageDown' }); f.move(target - 5); f.end(); f.advance(40); snapshot();
    f.input('keyup', { key: 'PageDown' }); f.end(); f.advance(40); snapshot();
    f.move(target); f.end(); f.advance(40); f.advance(1000); snapshot();
    f.assist.dispose(); snapshot();
    return { states, reports: f.reports };
  };
  for (const scrollend of [true, false]) {
    const ordinary = run({ scrollend, diagnostics: false }), traced = run({ scrollend, diagnostics: true }), consumerOnly = run({ scrollend, diagnostics: false, consumer: true }), throwing = run({ scrollend, diagnostics: true, reporterThrows: true });
    assert.deepEqual(traced.states, ordinary.states);
    assert.deepEqual(consumerOnly.states, ordinary.states);
    assert.ok(consumerOnly.reports.length > 0, 'an explicit trace consumer works without enabling Scene diagnostics');
    assert.deepEqual(throwing.states, ordinary.states, 'a diagnostic callback must not break the native lifecycle');
    assert.equal(ordinary.reports.length, 0);
    assert.ok(traced.reports.length > 0, 'enabled diagnostics must actually report');
    assert.ok(traced.reports.some(row => row.type === 'cancel' && row.reason === 'layout-changed'));
    if (scrollend) assert.ok(traced.reports.some(row => row.type === 'settle-return' && row.reason === 'key-held'));
  }
});

test('diagnostics distinguish unconfirmed motion, blocked input and the authored destination', () => {
  const f = fixture({ diagnostics: true }), target = f.bounds.transitions[0].end;
  f.view.scrollY = target - 40; f.input('wheel', { deltaY: 40, timeStamp: 3 }); f.move(target - 40); f.end();
  assert.ok(f.reports.some(row => row.type === 'scroll-return' && row.reason === 'zero-delta'));
  f.assist.cancel(); f.advance(100); f.input('wheel', { deltaY: 20 }); f.view.scrollY += 20;
  f.emit(f.view, 'scroll', { target: f.document, timeStamp: 99 });
  assert.ok(f.reports.some(row => row.type === 'scroll-cancel' && row.reason === 'unconfirmed-scroll'));
  f.block(true); f.input('wheel', { deltaY: 20 });
  assert.ok(f.reports.some(row => row.type === 'intent-rejected' && row.reason === 'caller-blocked'));
  f.block(false); f.input('wheel', { deltaY: 20, target: { closest: () => ({}) } });
  assert.ok(f.reports.some(row => row.type === 'intent-rejected' && row.reason === 'control-target'));
  f.wheel(target - 50); f.end(); f.advance(40);
  const eligible = f.reports.find(row => row.type === 'assist-start');
  assert.equal(eligible.target, target); assert.equal(eligible.distance, 50);
  assert.equal(eligible.phase.kind, 'reading-stop'); assert.equal(eligible.geometry.stageHeight, 844);
  f.assist.dispose();
});

test('the two retained c9 Chromium compositor-before-wheel orderings still complete after their matching scroll event', () => {
  for (const trace of [
    { baselineAt: 5190.5, inputAt: 5248.8, handledAt: 5271.6, scrollAt: 5271 },
    { baselineAt: 5708.9, inputAt: 5820.9, handledAt: 9752.1, scrollAt: 9751.3 },
  ]) for (const direction of [1, -1]) for (const noPixelTail of [false, true]) {
    const f = fixture({ diagnostics: true });
    const target = direction > 0 ? f.bounds.opening.motionTravel / 2 : 0;
    const baseline = direction > 0 ? 2621 : 80, advanced = baseline + direction * 40;
    f.advance(trace.baselineAt); f.move(baseline); f.advance(40);
    f.advance(trace.handledAt - trace.baselineAt);
    f.view.scrollY = advanced; // Compositor already moved; its scroll event is queued.
    f.input('wheel', { deltaY: direction * 40, timeStamp: trace.inputAt });
    if (noPixelTail) f.input('wheel', { deltaY: direction * 0.01, timeStamp: trace.inputAt + 0.1 });
    assert.equal(assistedTargets(f).length, 0, 'a pre-input position difference alone cannot start assistance');
    f.emit(f.view, 'scroll', { target: f.document, timeStamp: trace.scrollAt });
    f.end(); f.advance(40);
    assert.equal(assistedTargets(f).length, 1, `matching ${direction} movement survives delivery at ${trace.handledAt}`);
    assert.equal(assistedTargets(f)[0], target);
    f.advance(3000);
    assert.equal(f.view.scrollY, target);
    const calls = f.calls.length;
    f.input('wheel', { deltaY: direction * 0.01 }); f.move(target); f.end(); f.advance(40);
    assert.equal(f.calls.length, calls, 'a consumed completion and no-pixel tail cannot start another phase');
    f.assist.dispose();
  }
});

test('pending compositor evidence excludes stale programmatic scroll, reverse motion, rejected controls and active assistance', () => {
  for (const scenario of ['missing-scroll', 'old-scroll', 'untrusted-scroll', 'input-before-baseline', 'reverse', 'control', 'untrusted-input', 'cancelled', 'assisting']) {
    const f = fixture();
    f.advance(100); f.move(2621); f.end(); f.advance(40); f.advance(20);
    if (scenario === 'assisting') { f.wheel(2621); f.end(); f.advance(40); }
    const prior = assistedTargets(f).length;
    f.view.scrollY = scenario === 'reverse' ? 2581 : 2661;
    f.input('wheel', {
      deltaY: 40, timeStamp: scenario === 'input-before-baseline' ? 99 : 110,
      ...(scenario === 'control' ? { target: { closest: () => ({}) } } : {}),
      ...(scenario === 'untrusted-input' ? { isTrusted: false } : {}),
    });
    if (scenario === 'cancelled') f.assist.cancel('navigation');
    if (scenario !== 'missing-scroll') f.emit(f.view, 'scroll', {
      target: f.document, timeStamp: scenario === 'old-scroll' ? 109 : 119,
      isTrusted: scenario !== 'untrusted-scroll',
    });
    f.end(); f.advance(40);
    assert.equal(assistedTargets(f).length, prior, scenario);
    f.assist.dispose();
  }
});

test('keyboard overshoot chooses the next authored stop without pulling backward', () => {
  const f = fixture({ stageHeight: 843.984375 }), ai = f.bounds.opening.motionTravel / 2;
  f.move(ai - 80); f.input('keydown', { key: 'ArrowDown' }); f.move(ai + 9);
  f.input('keyup', { key: 'ArrowDown' }); f.end(); f.advance(40);
  assert.deepEqual(assistedTargets(f), [f.bounds.opening.motionTravel]);
  f.assist.dispose();
});

test('intermediate scrollend in a 16ms native packet train cannot start repeated assistance', () => {
  const f = fixture({ diagnostics: true }), target = f.bounds.transitions[0].end;
  f.move(target - 1000);
  for (const delta of [80, 40, 20, 10, 5, 2]) {
    f.input('wheel', { deltaY: delta }); f.move(f.view.scrollY + delta); f.end(); f.advance(16);
    assert.equal(f.calls.length, 0, 'native packets retain ownership throughout the burst');
  }
  f.advance(3000); assert.equal(f.view.scrollY, target);
  assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1);
  f.assist.dispose();
});

test('pointer ownership also waits for physical release and pricing reading schedules no frames', () => {
  const f = fixture(); f.input('pointerdown'); f.wheel(100); f.advance(1000);
  assert.equal(f.calls.length, 0); f.input('pointerup'); f.end(); f.advance(39); assert.equal(f.calls.length, 0);
  f.advance(1); assert.equal(assistedTargets(f).length, 1); f.assist.dispose();
  const reading = fixture(), pricing = reading.bounds.transitions.find(join => join.to.id === 'open-weight');
  reading.wheel(pricing.to.top + 100); reading.advance(1000);
  assert.equal(reading.frames(), 0); assert.equal(reading.calls.length, 0); reading.assist.dispose();
});

test('native touch pan pointercancel releases pointer ownership without discarding the independent touch gesture', () => {
  for (const pointerFirst of [false, true]) {
    const f = fixture({ diagnostics: true }), target = f.bounds.transitions[0].end;
    f.move(target - 1000);
    const pointer = () => f.input('pointerdown', { pointerType: 'touch', pointerId: 1 });
    if (pointerFirst) pointer();
    f.input('touchstart', { touches: [{ clientY: 200 }] });
    if (!pointerFirst) pointer();
    f.input('touchmove', { touches: [{ clientY: 180 }] }); f.move(target - 980);
    f.input('pointercancel', { pointerType: 'touch', pointerId: 1 });
    f.input('touchmove', { touches: [{ clientY: 160 }] }); f.move(target - 960);
    f.input('touchend', { touches: [] }); f.end(); f.advance(3000);
    assert.equal(f.view.scrollY, target, 'Touch Events may continue after UA panning cancels Pointer Events');
    assert.ok(!f.reports.some(row => row.type === 'intent-rejected' && row.reason === 'no-eligible-touch-start'));
    f.assist.dispose();
  }
  const cancelled = fixture({  }), target = cancelled.bounds.transitions[0].end;
  cancelled.input('touchstart', { touches: [{ clientY: 200 }] });
  cancelled.input('touchmove', { touches: [{ clientY: 180 }] }); cancelled.move(target - 980); cancelled.input('touchcancel', { touches: [] });
  cancelled.end(); cancelled.advance(1000); assert.equal(gestureTrips(cancelled).length, 0); cancelled.assist.dispose();
});

test('retained diagnostics snapshot scalar controlled ownership and long stalls cannot skip the trip', () => {
  const f = fixture({ diagnostics: true, nativeMotion: false }); f.wheel(100); f.end(); f.advance(40);
  const row = f.reports.find(entry => entry.assisting);
  const snapshot = structuredClone(row.assisting); f.advance(16); f.move(200);
  assert.deepEqual(row.assisting, snapshot);
  assert.ok(Object.values(row.assisting).every(value => ['number', 'boolean'].includes(typeof value)));
  assert.equal(row.mode, 'controlled');
  f.stall(1000); f.advance(0);
  assert.ok(f.calls.at(-1).top < 500, 'a delayed callback only advances a bounded piece of the trip');
  f.assist.dispose();
});

test('every authored gap and handoff completes to its adjacent navigation reading stop with no proximity eligibility', () => {
  for (const pace of [.25, 1, 4]) {
    const bounds = geometry(844, pace), stops = authoredReadingStops(bounds, pace);
    assert.deepEqual(stops.map(stop => stop.id), ['hero', 'ai', 'wearable', 'features', 'features-option-2', 'features-option-3', 'encryption', 'grip', 'sustainability', 'sustainability-open', 'testimonies', 'social-content', 'social-content-option-2', 'social-content-option-3', 'product']);
    for (let i = 1; i < stops.length; i++) {
      const before = stops[i - 1], after = stops[i];
      const points = new Set([before.y + 2, (before.y + after.y) / 2, after.y - 2]);
      for (const join of bounds.transitions) for (const y of [join.start + 2, (join.start + join.end) / 2, join.end - 2])
        if (y > before.y && y < after.y) points.add(y);
      for (const y of points) for (const direction of [-1, 1]) {
        const f = fixture({ pace, diagnostics: true });
        const target = direction > 0 ? after.y : before.y;
        f.wheel(y, direction); f.end(); f.advance(30000);
        assert.equal(f.view.scrollY, target, `${pace}: ${before.id}/${after.id} at ${y}, direction ${direction}`);
        assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1);
        assert.ok(f.calls.every(call => (call.top - y) * direction >= -1e-7 && (target - call.top) * direction >= -1e-7));
        const calls = f.calls.length; f.end(); f.advance(1000); assert.equal(f.calls.length, calls);
        f.assist.dispose();
      }
    }
  }
});

test('exact reading stops and small native overshoots select the next stop in direction without a backward pull', () => {
  const stops = authoredReadingStops(geometry());
  for (let i = 1; i < stops.length - 1; i++) for (const offset of [-.25, 0, .25]) for (const direction of [-1, 1]) {
    const f = fixture({  }), y = stops[i].y + offset;
    const next = direction > 0 ? stops.find(stop => stop.y > y + 1) : [...stops].reverse().find(stop => stop.y < y - 1);
    f.wheel(y, direction); f.end(); f.advance(30000); assert.equal(f.view.scrollY, next.y); f.assist.dispose();
  }
  const pricing = geometry().transitions.find(join => join.to.id === 'open-weight').end;
  for (const y of [stops.at(-1).y, stops.at(-1).y + 100]) {
    const f = fixture({  }); f.wheel(y); f.end(); f.advance(30000);
    assert.equal(f.view.scrollY, pricing, 'the collection continues to the pricing arrival'); f.assist.dispose();
  }
});

test('a still-current trusted first scroll survives 1624ms delivery without borrowing cancelled or older motion', () => {
  for (const invalidation of [null, 'new-input', 'hidden', 'layout', 'older-event', 'untrusted-event']) {
    const f = fixture({ diagnostics: true });
    const start = 100, target = f.bounds.opening.motionTravel / 2;
    f.move(start);
    f.input('wheel', { deltaY: 20 });
    f.advance(1624);
    if (invalidation === 'new-input') f.input('wheel', { deltaY: -20 });
    if (invalidation === 'hidden') { f.document.hidden = true; f.input('visibilitychange'); f.document.hidden = false; }
    if (invalidation === 'layout') f.assist.cancel('layout');
    f.view.scrollY = start + 20;
    f.emit(f.view, 'scroll', { target: f.document, timeStamp: invalidation === 'older-event' ? -1 : 1624, isTrusted: invalidation !== 'untrusted-event' });
    f.end(); f.advance(5000);
    assert.equal(invalidation ? gestureTrips(f).length : f.view.scrollY, invalidation ? 0 : target, invalidation || 'late current input completes');
    assert.equal(gestureTrips(f).length, invalidation ? 0 : 1);
    f.assist.dispose();
  }
});

test('real touch orderings keep one native gesture: scroll before first touchmove, zero-delta packets and coalesced earlier scroll stamps', () => {
  const sequences = {
    'scroll-before-first-touchmove': (f, target) => {
      f.input('touchstart', { touches: [{ clientY: 200 }] });
      f.advance(8); f.move(target - 980);
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 170 }] });
    },
    'zero-delta-touch-packet': (f, target) => {
      f.input('touchstart', { touches: [{ clientY: 200 }] });
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 180 }] }); f.move(target - 980);
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 180 }] });
      f.advance(8); f.move(target - 960);
    },
    'coalesced-scroll-before-last-touchmove': (f, target) => {
      f.input('touchstart', { touches: [{ clientY: 200 }] });
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 180 }] });
      f.advance(16); f.input('touchmove', { touches: [{ clientY: 160 }] });
      f.view.scrollY = target - 960; f.emit(f.view, 'scroll', { target: f.document, timeStamp: f.now() - 10 });
    },
  };
  for (const [name, sequence] of Object.entries(sequences)) {
    const f = fixture({ diagnostics: true }), target = f.bounds.transitions[0].end;
    f.move(target - 1000);
    sequence(f, target);
    f.advance(8); f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
    assert.equal(f.view.scrollY, target, `${name}: the released touch completes its adjacent stop`);
    assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1, name);
    f.assist.dispose();
  }
  // A scroll left over from earlier opposite inertia is not evidence for the new touch direction.
  const f = fixture({  }), target = f.bounds.transitions[0].end;
  f.move(target - 1000);
  f.input('touchstart', { touches: [{ clientY: 200 }] });
  f.move(target - 1010);
  f.input('touchmove', { touches: [{ clientY: 170 }] });
  f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
  assert.equal(f.calls.length, 0);
  f.assist.dispose();
});

test('a native touch scroll that starts on a link, button, pan-y model surface or video is assisted; fields and dialogs stay excluded', () => {
  // The 3D dish and stand surfaces are role="slider" with touch-action: pan-y:
  // horizontal drags rotate, vertical drags scroll the page natively.
  const element = tag => ({ closest: selector => selector.split(',').map(part => part.trim()).includes(tag) ? {} : null });
  for (const [tag, assisted] of [['a', true], ['button', true], ['[role="button"]', true], ['[role="slider"]', true], ['video', true], ['input', false], ['textarea', false], ['[role="dialog"]', false]]) {
    const f = fixture({  }), target = f.bounds.transitions[0].end;
    f.move(target - 1000);
    f.input('touchstart', { touches: [{ clientY: 200 }], target: element(tag) });
    f.advance(8); f.input('touchmove', { touches: [{ clientY: 170 }], target: element(tag) }); f.move(target - 980);
    f.advance(8); f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
    assert.equal(assisted ? f.view.scrollY : gestureTrips(f).length, assisted ? target : 0, `${tag}: ${assisted ? 'completes its stop' : 'stays native'}`);
    f.assist.dispose();
  }
});

test('focus left on a turned 3D model surface does not disable later touch or wheel assistance; editing focus still does', () => {
  // Real Chrome at 390px: tapping .dish-gesture (role="slider") focuses it, and
  // every later swipe was rejected as protected-focus.
  const element = tag => ({ closest: selector => selector.split(',').map(part => part.trim()).includes(tag) ? {} : null });
  for (const [tag, assisted] of [['[role="slider"]', true], ['input', false]]) {
    const f = fixture({  }), target = f.bounds.transitions[0].end;
    f.document.activeElement = element(tag);
    f.move(target - 1000);
    f.input('touchstart', { touches: [{ clientY: 200 }] });
    f.advance(8); f.input('touchmove', { touches: [{ clientY: 170 }] }); f.move(target - 980);
    f.advance(8); f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
    assert.equal(f.view.scrollY, assisted ? target : target - 980, `${tag} focus`);
    f.move(target - 1000); f.wheel(target - 980); f.end(); f.advance(30000);
    assert.equal(f.view.scrollY, assisted ? target : target - 980, `${tag} focus and a wheel`);
    f.assist.dispose();
    // Desktop: rotating the support with the mouse focuses it; the next swipe still travels.
    const g = fixture({ fine: true }); g.document.activeElement = element(tag); g.move(target - 1000); g.advance(500);
    g.input('wheel', { deltaY: 100, deltaX: 0 }); g.advance(3000);
    assert.equal(g.view.scrollY, assisted ? target : target - 1000, `${tag} focus and an owned desktop swipe`);
    g.assist.dispose();
  }
});

test('touch motion credit needs a trusted document scroll stamped inside the current touch intent', () => {
  const sequences = {
    'scroll stamped before touchstart, delivered before the first touchmove': (f, target) => {
      f.advance(8); f.input('touchstart', { touches: [{ clientY: 200 }] });
      f.view.scrollY = target - 980; f.emit(f.view, 'scroll', { target: f.document, timeStamp: f.now() - 5 });
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 170 }] });
    },
    'untrusted scroll before the first touchmove': (f, target) => {
      f.input('touchstart', { touches: [{ clientY: 200 }] });
      f.advance(8); f.view.scrollY = target - 980; f.emit(f.view, 'scroll', { target: f.document, isTrusted: false });
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 170 }] });
    },
    'forward, reverse, forward again without new document movement': (f, target) => {
      f.input('touchstart', { touches: [{ clientY: 200 }] });
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 170 }] }); f.move(target - 970);
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 190 }] });
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 160 }] });
    },
  };
  for (const [name, sequence] of Object.entries(sequences)) {
    const f = fixture({  }), target = f.bounds.transitions[0].end;
    f.move(target - 1000);
    sequence(f, target);
    f.advance(8); f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
    assert.equal(f.calls.length, 0, `${name}: no assisted write without fresh native motion`);
    f.assist.dispose();
  }
  // A browser pointercancel while the page pans neither blocks the gesture nor
  // keeps its intent once a new touch starts.
  const f = fixture({  }), target = f.bounds.transitions[0].end;
  f.move(target - 1000);
  f.input('pointerdown', { pointerType: 'touch' });
  f.input('touchstart', { touches: [{ clientY: 200 }] });
  f.advance(8); f.input('touchmove', { touches: [{ clientY: 170 }] }); f.move(target - 980);
  f.input('pointercancel', { pointerType: 'touch' });
  f.advance(8); f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
  assert.equal(f.view.scrollY, target, 'pointercancel during native panning keeps the released gesture');
  const writes = f.calls.length;
  f.view.scrollY = f.bounds.transitions[1].end - 1000;
  f.input('pointerdown', { pointerType: 'touch' }); f.input('touchstart', { touches: [{ clientY: 200 }] });
  f.input('pointercancel', { pointerType: 'touch' });
  f.advance(8); f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
  assert.equal(f.calls.length, writes, 'a cancelled pointer never replays the previous intent');
  f.assist.dispose();
});

test('sustainability holds a reading stop on the fully opened laptop before Trois expériences, in both directions', async () => {
  const { chapterPhase, cinematicEase } = await import('../components/immersive/SceneDirector.js');
  for (const pace of [.25, 1, 4]) {
    const bounds = geometry(844, pace);
    const arrival = bounds.transitions.find(join => join.to.id === 'sustainability');
    const exit = bounds.transitions.find(join => join.from.id === 'sustainability');
    const chapter = exit.from, at = y => cinematicEase(chapterPhase('sustainability', (y - chapter.top) / chapter.travel));
    const gesture = (y, direction) => {
      const f = fixture({ pace }); f.wheel(y, direction); f.end(); f.advance(30000);
      const result = f.view.scrollY; f.assist.dispose(); return result;
    };
    const open = gesture(arrival.end + 1, 1);
    assert.equal(at(open), 1, `${pace}: the stop shows the lid at its widest opening keyframe`);
    assert.ok(at(open - 1) < 1, `${pace}: the stop is the first fully open pose, not a later hold`);
    assert.ok(open <= exit.start + 1e-7, `${pace}: the Three experiences handoff has not started`);
    assert.equal(gesture(open + 1, 1), exit.end, `${pace}: the next gesture continues to testimonies`);
    assert.ok(Math.abs(gesture(exit.end - 1, -1) - open) < 1e-6, `${pace}: reverse stops on the open laptop`);
    assert.equal(gesture(open - 1, -1), arrival.end, `${pace}: reverse again returns to the sustainability arrival`);
  }
  // A real direction change comes from touchmove, even within one held contact.
  const reversed = fixture(), arrival = reversed.bounds.transitions.find(join => join.to.id === 'sustainability');
  reversed.move(arrival.end + 100);
  reversed.input('touchstart', { touches: [{ clientY: 200 }] });
  reversed.advance(8); reversed.input('touchmove', { touches: [{ clientY: 170 }] }); reversed.move(arrival.end + 140);
  reversed.advance(8); reversed.input('touchmove', { touches: [{ clientY: 190 }] });
  const newIntent = reversed.reports.findLast(row => row.type === 'intent-accepted').gesture;
  assert.equal(newIntent.direction, -1); assert.equal(newIntent.scrolled, false, 'the reversed intent needs its own native movement');
  reversed.move(arrival.end + 120); reversed.end(); reversed.advance(1000);
  assert.equal(reversed.calls.length, 0, 'the finger still owns the page');
  reversed.input('touchend', { touches: [] }); reversed.advance(3000);
  assert.deepEqual(assistedTargets(reversed), [arrival.end], 'release continues in the latest actual input direction');
  reversed.assist.dispose();

  // Safari yqktpcj5z6q: a document reversal during a toolbar change, under a
  // finger still tracking forward, keeps the touch intent for the Mac exit.
  const mac = fixture({ stageHeight: 796 }), open = mac.bounds.transitions.find(join => join.to.id === 'sustainability');
  const laptop = open.end + 2000;
  mac.move(laptop - 300);
  mac.input('touchstart', { touches: [{ clientY: 200 }] });
  mac.advance(30); mac.input('touchmove', { touches: [{ clientY: 170 }] }); mac.move(laptop - 200);
  mac.advance(16); mac.move(laptop - 274); mac.advance(16); mac.move(laptop - 250);
  mac.input('touchend', { touches: [] }); mac.advance(3000);
  assert.ok(assistedTargets(mac)[0] > laptop - 250, 'the forward touch completes forward once');
  mac.assist.dispose();

});

test('features and video menus stop on each of their three stable options before the next chapter, in both directions', async () => {
  const { readingPresentation } = await import('../components/immersive/SceneDirector.js');
  for (const pace of [.25, 1, 4]) for (const id of ['features', 'social-content']) {
    const bounds = geometry(844, pace);
    const arrival = bounds.transitions.find(join => join.to.id === id);
    const exit = bounds.transitions.find(join => join.from.id === id);
    const chapter = exit.from, at = y => readingPresentation((y - chapter.top) / chapter.travel);
    const gesture = (y, direction) => {
      const f = fixture({ pace }); f.wheel(y, direction); f.end(); f.advance(60000);
      const result = f.view.scrollY; f.assist.dispose(); return result;
    };
    const second = gesture(arrival.end + 1, 1), third = gesture(second + 1, 1);
    for (const [y, index] of [[second, 1], [third, 2]]) {
      const shown = at(y);
      assert.equal(shown.position, index, `${pace} ${id}: option ${index + 1} is fully in place`);
      assert.equal(shown.opacity, 1, `${pace} ${id}: option ${index + 1} copy is fully visible`);
      assert.ok(at(y - 1).position < index, `${pace} ${id}: the stop is the first stable pose of option ${index + 1}`);
    }
    assert.equal(gesture(third + 1, 1), exit.end, `${pace} ${id}: the next gesture continues to the next chapter`);
    assert.ok(Math.abs(gesture(exit.end - 1, -1) - third) < 1e-6, `${pace} ${id}: reverse stops on option 3`);
    assert.ok(Math.abs(gesture(third - 1, -1) - second) < 1e-6, `${pace} ${id}: reverse stops on option 2`);
    assert.equal(gesture(second - 1, -1), arrival.end, `${pace} ${id}: reverse returns to option 1`);
  }
});

test('trusted compositor movement delivered before touchmove is credited only by its queued document scroll', () => {
  for (const direction of [1, -1]) for (const endFirst of [false, true]) {
    const f = fixture({ diagnostics: true });
    const ai = f.bounds.opening.motionTravel / 2;
    const from = direction > 0 ? 0 : ai, target = direction > 0 ? ai : 0;
    f.move(from); f.advance(100);
    f.input('touchstart', { touches: [{ clientY: 200 }] });
    f.advance(8);
    f.view.scrollY = from + direction * 30; // Compositor moved; its trusted scroll event is queued.
    const scrollAt = f.now();
    f.advance(8); f.input('touchmove', { touches: [{ clientY: 200 - direction * 15 }] });
    f.advance(8); f.input('touchmove', { touches: [{ clientY: 200 - direction * 30 }] });
    assert.equal(f.calls.length, 0, 'position alone never starts assistance');
    f.input('touchend', { touches: [] }); f.advance(40);
    if (endFirst) f.end(); // The end can precede even the first corroborating document event.
    f.emit(f.view, 'scroll', { target: f.document, timeStamp: scrollAt });
    if (!endFirst) f.end();
    f.advance(30000);
    assert.equal(f.view.scrollY, target, 'the released native pan reaches its adjacent reading stop');
    assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1);
    f.assist.dispose();
  }
});

test('queued touch displacement cannot borrow absent, stale, untrusted or opposite-intent document scroll', () => {
  for (const scenario of ['missing-scroll', 'old-scroll', 'untrusted-scroll', 'reverse']) {
    const f = fixture({  });
    f.advance(100); f.input('touchstart', { touches: [{ clientY: 200 }] });
    f.advance(8); f.view.scrollY = 30;
    f.input('touchmove', { touches: [{ clientY: 170 }] });
    if (scenario === 'reverse') {
      f.advance(8); f.input('touchmove', { touches: [{ clientY: 190 }] });
    }
    if (scenario !== 'missing-scroll') f.emit(f.view, 'scroll', {
      target: f.document, timeStamp: scenario === 'old-scroll' ? 99 : f.now(),
      isTrusted: scenario !== 'untrusted-scroll',
    });
    f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
    assert.equal(gestureTrips(f).length, 0, scenario);
    f.assist.dispose();
  }
});

test('Safari scrollend before the final document scroll preserves one native touch handoff', () => {
  for (const direction of [1, -1]) {
    const f = fixture({ diagnostics: true });
    const ai = f.bounds.opening.motionTravel / 2;
    const from = direction > 0 ? 0 : ai, target = direction > 0 ? ai : 0;
    f.move(from); f.advance(100);
    f.input('touchstart', { touches: [{ clientY: 200 }] });
    f.advance(16); f.input('touchmove', { touches: [{ clientY: 200 - direction * 30 }] });
    f.move(from + direction * 1594); f.input('touchend', { touches: [] });
    f.advance(39); f.view.scrollY += direction;
    f.advance(2777); // The missing final document event outlasts the former observation limit.
    f.end(); // Safari reports the final compositor position before its queued scroll.
    assert.equal(f.calls.length, 0, 'scrollend alone cannot corroborate a changed position');
    f.advance(16); f.emit(f.view, 'scroll', { target: f.document });
    f.advance(30000);
    assert.equal(f.view.scrollY, target);
    assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1);
    f.end(); f.advance(1000);
    assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1, 'completion cannot chain');
    f.assist.dispose();
  }
});

test('an unprocessed final position requires a trusted current document scroll and survives no cancellation', () => {
  for (const scenario of ['missing-scroll', 'untrusted-scroll', 'stale-scroll', 'reverse', 'cancelled']) {
    const f = fixture({ diagnostics: true });
    f.advance(100); f.input('touchstart', { touches: [{ clientY: 200 }] });
    f.advance(16); f.input('touchmove', { touches: [{ clientY: 170 }] });
    f.move(30); f.input('touchend', { touches: [] }); f.advance(39);
    f.view.scrollY = 31; f.advance(2777);
    f.end();
    if (scenario === 'cancelled') f.assist.cancel('navigation');
    if (scenario === 'reverse') f.view.scrollY = 29;
    f.advance(16);
    if (scenario !== 'missing-scroll') f.emit(f.view, 'scroll', { target: f.document,
      isTrusted: scenario !== 'untrusted-scroll', timeStamp: scenario === 'stale-scroll' ? 99 : f.now() });
    f.advance(3000);
    assert.equal(f.calls.length, 0, scenario);
    assert.equal(f.reports.filter(row => row.type === 'handoff').length, 0, scenario);
    f.assist.dispose();
  }
});

test('released touch leaves at its native speed without waiting for inertia, then one gradual controlled trip', () => {
  for (const direction of [1, -1]) for (const scrollend of [true, false]) {
    const f = fixture({ nativeMotion: false, diagnostics: true, scrollend });
    const ai = f.bounds.opening.motionTravel / 2, from = direction > 0 ? 0 : ai;
    const target = direction > 0 ? ai : 0;
    f.move(from); f.advance(100);
    f.input('touchstart', { touches: [{ clientY: 200 }] });
    f.input('touchmove', { touches: [{ clientY: 200 - direction * 30 }] });
    f.move(from + direction * 30); f.advance(1000);
    assert.equal(f.calls.length, 0, 'held contact remains native');
    f.advance(16); f.move(from + direction * 60);
    f.advance(16); f.move(from + direction * 90); // Finger leaves at 30px per 16ms.
    f.input('touchend', { touches: [] });
    f.advance(39); assert.equal(f.calls.length, 0);
    f.advance(1);
    const handoff = f.reports.find(row => row.type === 'handoff');
    assert.equal(handoff.target, target);
    assert.equal(handoff.source, 'release', 'neither scrollend nor quiet inertia delays departure');
    const started = f.now();
    let observed = f.view.scrollY;
    for (let step = 0; step < 200 && !f.reports.some(row => row.type === 'completed'); step++) {
      f.stall(step % 4 === 3 ? 80 : 16); f.advance(0);
      const write = f.calls.at(-1);
      if (step === 0) {
        const first = (write.top - observed) * direction;
        // Release pace 30px/16ms, written one frame plus Safari's apply delay ahead.
        assert.ok(first >= 75 && first <= 160, `the first write continues the release speed (${first}px)`);
      }
      assert.equal(write.behavior, 'instant');
      assert.ok((write.top - observed) * direction >= 0, 'requested positions progress monotonically');
      assert.ok((target - write.top) * direction >= 0, 'the owned stop is never overshot');
      // WebKit exposes a write immediately, then can repeat the preceding native
      // event position. Such an observed duplicate is not backward movement.
      f.view.scrollY = write.top; f.move(observed); f.move(write.top);
      observed = write.top;
      if (f.now() - started < 1000) assert.notEqual(observed, target, 'travel is progressive for at least one second');
    }
    const completed = f.reports.find(row => row.type === 'completed');
    assert.ok(completed, 'duplicates and ordinary 80ms frame gaps never pause or cancel the trip');
    assert.ok(completed.duration >= 1000 && completed.duration <= 2580);
    assert.equal(f.view.scrollY, target);
    assert.equal(f.frames(), 0);
    const calls = f.calls.length; f.end(); f.advance(5000);
    assert.equal(f.calls.length, calls, 'completion cannot chain');
    f.assist.dispose();
  }
});

test('native momentum that survives the first writes keeps the page until its end; an unexplained reversal stays native', () => {
  for (const reversal of [false, true]) {
    const f = fixture({ nativeMotion: false, diagnostics: true });
    const target = f.bounds.opening.motionTravel / 2;
    f.move(0); f.advance(100);
    f.input('touchstart', { touches: [{ clientY: 200 }] });
    f.input('touchmove', { touches: [{ clientY: 170 }] }); f.move(30);
    f.advance(16); f.move(60); f.input('touchend', { touches: [] }); f.advance(40);
    let native = 60;
    for (let step = 0; step < 8; step++) { // Momentum runs ahead of every write.
      f.advance(16); native += 40; f.view.scrollY = native; f.move(native);
      assert.ok(f.calls.every((write, i) => !i || write.top >= f.calls[i - 1].top), 'writes never move backward');
    }
    assert.ok(f.reports.some(row => row.type === 'momentum-yield'));
    assert.equal(f.frames(), 0, 'inertia owns the page without a competing frame');
    f.advance(16); f.move(reversal ? native - 74 : native + 20); f.end(); f.advance(5000);
    if (reversal) assert.equal(gestureTrips(f).length, 1, 'an input-less reversal after release is not assisted');
    else {
      assert.deepEqual(assistedTargets(f), [target, target], 'the end resumes the same adjacent stop');
      assert.equal(f.reports.at(-1 - f.reports.slice().reverse().findIndex(row => row.type === 'handoff')).source, 'scrollend');
    }
    f.assist.dispose();
  }
});

test('controlled continuation waits for final scroll and fresh input cancels without resetting an in-flight pose', () => {
  for (const direction of [1, -1]) for (const action of ['touchstart', 'reverse', 'layout', 'reduced', 'dispose']) {
    const f = fixture({ nativeMotion: false, diagnostics: true });
    const from = direction > 0 ? 100 : f.bounds.opening.motionTravel / 2 - 100;
    f.wheel(from, direction);
    f.view.scrollY = from + direction; // The compositor moved; its document event is still queued.
    f.input('wheel', { deltaY: direction * 10 }); // A continuing packet cannot manufacture that evidence.
    f.advance(40); f.end();
    assert.equal(f.calls.length, 0, 'neither timeout nor scrollend authorizes an unprocessed position');
    f.emit(f.view, 'scroll', { target: f.document }); f.advance(16);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].behavior, 'instant');
    f.view.scrollY = f.calls[0].top; // Immediate JS readback is not a native scroll observation.
    const calls = f.calls.length;
    if (action === 'touchstart') f.input('touchstart', { touches: [{ clientY: 200 }] });
    if (action === 'reverse') f.move(from - direction * 10);
    if (action === 'layout') f.assist.cancel('layout');
    if (action === 'reduced') { f.media.matches = true; f.emit(f.media, 'change'); }
    if (action === 'dispose') f.assist.dispose();
    assert.equal(f.calls.length, calls, action + ': cancellation never writes a potentially stale position');
    f.end(); f.advance(5000);
    assert.equal(gestureTrips(f).length, 1, action + ': the cancelled gesture cannot replay');
    assert.equal(f.reports.filter(row => row.type === 'completed').length, 0, action);
    assert.equal(f.frames(), 0);
    f.assist.dispose();
  }
  const finishing = fixture({ nativeMotion: false, diagnostics: true });
  finishing.wheel(100); finishing.end(); finishing.advance(3000);
  const target = finishing.calls.at(-1).top;
  finishing.view.scrollY = target;
  finishing.emit(finishing.view, 'scroll', { target: finishing.document, isTrusted: false });
  finishing.end();
  assert.equal(finishing.reports.filter(row => row.type === 'completed').length, 0,
    'the final write and an untrusted position event cannot certify completion');
  finishing.emit(finishing.view, 'scroll', { target: finishing.document });
  assert.equal(finishing.reports.filter(row => row.type === 'completed').length, 1);
  finishing.assist.dispose();
});

test('Safari applies a write after momentum moved on: writes lead the release pace and its stale echo never stops the trip', () => {
  // Safari otktd984axs: write 458 landed after momentum reached 503 (47ms), so
  // the page jumped back and the trip was cancelled at the opening.
  const f = fixture({ nativeMotion: false, diagnostics: true });
  const target = f.bounds.opening.motionTravel / 2;
  f.move(0); f.advance(100);
  f.input('touchstart', { touches: [{ clientY: 200 }] });
  f.input('touchmove', { touches: [{ clientY: 170 }] }); f.move(30);
  f.advance(16); f.move(60); f.advance(16); f.move(90);
  f.input('touchend', { touches: [] }); f.advance(40);
  f.advance(16);
  const first = f.calls[0].top;
  assert.ok(first - 90 >= 2.5 * 30, `the first write leads momentum by its apply delay (${first - 90}px)`);
  f.move(first + 40); // Momentum still ahead before the write lands.
  f.advance(16); f.move(first); // The stale write lands behind that position.
  assert.equal(f.reports.filter(row => row.type === 'cancel' && row.reason === 'foreign-scroll').length, 0, 'an echo of an own write is not foreign');
  for (let i = 0; i < 300 && !f.reports.some(row => row.type === 'completed'); i++) { f.advance(16); f.view.scrollY = f.calls.at(-1).top; f.move(f.view.scrollY); }
  assert.equal(f.view.scrollY, target, 'the trip still reaches its stop');
  f.assist.dispose();
});

test('a horizontal drag that rotates a 3D model never arms assistance, even with vertical page drift', () => {
  const f = fixture(), target = f.bounds.transitions[0].end;
  f.move(target - 1000);
  f.input('touchstart', { touches: [{ clientX: 100, clientY: 200 }] });
  f.advance(16); f.input('touchmove', { touches: [{ clientX: 160, clientY: 192 }] }); f.move(target - 992);
  f.advance(16); f.input('touchmove', { touches: [{ clientX: 220, clientY: 185 }] }); f.move(target - 985);
  f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
  assert.equal(gestureTrips(f).length, 0);
  f.assist.dispose();
});

test('pricing stops on the phone, reads natively, then opens the FAQ after the last offer', () => {
  // Safari: from "Choisissez votre collection" four flings never reached pricing.
  const f = fixture({ stageHeight: 796 }), product = authoredReadingStops(f.bounds).at(-1).y;
  const pricing = f.bounds.transitions.find(join => join.to.id === 'open-weight').end;
  f.dispose = f.assist.dispose; f.dispose();
  const gesture = (y, direction, extra) => {
    const g = fixture({ stageHeight: 796 }); if (extra) g.bounds.pricing = extra;
    g.wheel(y, direction); g.end(); g.advance(30000); const result = g.view.scrollY; g.assist.dispose(); return result;
  };
  assert.equal(gesture(product + 1, 1), pricing, 'one gesture reaches pricing');
  const reading = { start: pricing + 300, end: pricing + 2300, faq: pricing + 3300 };
  assert.equal(gesture(product + 1, 1, reading), reading.start, 'the measured phone pose with the first offer wins');
  assert.equal(gesture(pricing - 1, -1), product, 'reverse from the arrival returns to the collection');
  assert.equal(gesture(pricing + 200, 1), pricing + 200, 'inside pricing the phone content scrolls natively');
  assert.equal(gesture(reading.start + 900, 1, reading), reading.start + 900, 'offers scroll natively in both directions');
  assert.equal(gesture(reading.start + 900, -1, reading), reading.start + 900);
  assert.equal(gesture(reading.faq - 1, -1, reading), reading.end, 'from the FAQ, reverse returns to the last offer');
  assert.equal(gesture(reading.faq + 400, 1, reading), reading.faq + 400, 'FAQ and footer stay native');
});

test('full-scene joins (signature to angles, angles to dashboard, experiences to video, collection to pricing) travel faster', () => {
  const bounds = geometry(796), at = id => bounds.transitions.find(join => join.to.id === id);
  const stops = authoredReadingStops(bounds), y = id => stops.find(stop => stop.id === id).y;
  for (const [from, to] of [[y('encryption'), at('grip').end], [at('grip').end, at('sustainability').end],
    [y('testimonies'), at('social-content').end], [stops.at(-1).y, at('open-weight').end], [at('grip').end, y('encryption')]]) {
    const f = fixture({ stageHeight: 796 }); f.wheel(from + Math.sign(to - from), Math.sign(to - from)); f.end(); f.advance(30000);
    assert.equal(f.view.scrollY, to);
    assert.ok(f.reports.find(row => row.type === 'assist-start').duration <= 1400, `${from}->${to}`);
    f.assist.dispose();
  }
  const opening = fixture({ stageHeight: 796 }); opening.wheel(1); opening.end(); opening.advance(30000);
  assert.ok(opening.reports.find(row => row.type === 'assist-start').duration > 1400, 'shorter trips keep their pace');
  opening.assist.dispose();
});

test('a page left at rest between two stops returns to the nearest one; stops, offers and the FAQ stay put', () => {
  // Also recovers flings whose touches Safari suppressed during deceleration (WebKit 191218/310540).
  const bounds = geometry(), join = bounds.transitions[0], previous = bounds.opening.motionTravel;
  const rest = (y, extra) => {
    const f = fixture(); if (extra) f.bounds.pricing = extra;
    f.move(y - 30); f.advance(16); f.move(y); f.advance(16); f.end(); f.advance(5000);
    const result = f.view.scrollY; f.assist.dispose(); return result;
  };
  assert.equal(rest(join.end - 600), join.end, 'closer to the next stop');
  assert.equal(rest(previous + 600), previous, 'closer to the previous stop, even after forward motion');
  assert.equal(rest(join.end), join.end, 'an exact stop stays');
  const pricing = bounds.transitions.find(item => item.to.id === 'open-weight').end;
  const reading = { start: pricing, end: pricing + 2000, faq: pricing + 3000 };
  assert.equal(rest(pricing + 900, reading), pricing + 900, 'offers stay where the reader left them');
  assert.equal(rest(reading.end + 300, reading), reading.end, 'between the last offer and the FAQ, nearest');
  assert.equal(rest(reading.faq + 500, reading), reading.faq + 500, 'FAQ and footer stay native');
});

test('an element blur captured on the window (inert pricing layer) never stops a trip; a window blur does', () => {
  for (const windowBlur of [false, true]) {
    const f = fixture({ nativeMotion: true }), target = f.bounds.transitions[0].end;
    f.wheel(target - 800); f.end(); f.advance(40); f.advance(200);
    f.emit(f.view, 'blur', { target: windowBlur ? f.view : { closest: () => null } });
    f.advance(5000);
    assert.equal(f.view.scrollY === target, !windowBlur, windowBlur ? 'window blur releases' : 'element blur is ignored');
    f.assist.dispose();
  }
});

test('offers stop at their first and last offer; only a gesture from rest at that edge starts the next transition', () => {
  const bounds = geometry(), pricing = bounds.transitions.find(item => item.to.id === 'open-weight').end;
  const reading = { start: pricing, end: pricing + 2000, faq: pricing + 3000 };
  const run = (from, to, direction, { release = false } = {}) => {
    const f = fixture(); f.bounds.pricing = reading; f.move(from); f.advance(500);
    f.input('touchstart', { touches: [{ clientY: 400 }] });
    f.advance(16); f.input('touchmove', { touches: [{ clientY: 400 - direction * 30 }] }); f.move(from + direction * 30);
    f.input('touchend', { touches: [] });
    if (release) { f.move(to); } // The finger itself carried the page past the edge.
    else for (let y = from + direction * 30; (to - y) * direction > 0; y += direction * 40) {
      f.advance(16); f.move(Math.abs(to - y) < 40 ? to : y + direction * 40); // Native momentum.
    }
    f.advance(16); f.end(); f.advance(6000);
    const result = f.view.scrollY; f.assist.dispose(); return result;
  };
  assert.equal(run(reading.end - 600, reading.end + 500, 1), reading.end, 'momentum past the last offer stops on it');
  assert.equal(run(reading.start + 600, reading.start - 500, -1), reading.start, 'momentum before the first offer stops on it');
  assert.equal(run(reading.end - 400, reading.end + 300, 1, { release: true }), reading.end, 'a drag past the last offer returns to it');
  assert.equal(run(reading.end, reading.end + 200, 1), reading.faq, 'from rest on the last offer, the next gesture opens the FAQ');
  assert.equal(run(reading.start + 900, reading.start + 1300, 1), reading.start + 1300, 'inside the offers, reading stays native');
});

test('desktop wheel and trackpad behave like a mobile release: one swipe, one immediate trip, its tail absorbed', () => {
  // Touch devices keep the native-gesture engine (covered above); only fine pointers own the wheel.
  const f = fixture({ fine: true }), stops = authoredReadingStops(f.bounds), from = stops[3].y;
  f.move(from); f.advance(500);
  f.input('wheel', { deltaY: 40, deltaX: 0 });
  f.advance(16);
  assert.ok(f.calls.length > 0, 'the trip starts on the first wheel packet, without waiting for scrollend');
  for (let i = 0; i < 40; i++) { f.advance(16); f.input('wheel', { deltaY: Math.max(1, 30 - i), deltaX: 0 }); }
  f.advance(3000);
  assert.equal(f.view.scrollY, stops[4].y, 'the trackpad inertia tail never chains a second stop');
  f.advance(300); f.input('wheel', { deltaY: -100, deltaX: 0 }); f.advance(3000);
  assert.equal(f.view.scrollY, stops[3].y, 'a new swipe after a pause goes one stop back');
  f.assist.dispose();
  // Offers stay free under the wheel, but the last offer is a hard edge.
  const pricing = f.bounds.transitions.find(item => item.to.id === 'open-weight').end;
  const reading = { start: pricing, end: pricing + 2000, faq: pricing + 3000 };
  const g = fixture({ fine: true }); g.bounds.pricing = reading; g.move(reading.start + 600); g.advance(500);
  const inside = g.input('wheel', { deltaY: 100, deltaX: 0 });
  assert.equal(inside.defaultPrevented, false, 'inside the offers the wheel scrolls natively');
  g.move(reading.end - 30); g.advance(20);
  g.input('wheel', { deltaY: 100, deltaX: 0 });
  assert.equal(g.view.scrollY, reading.end, 'the wheel stops on the last offer');
  g.advance(400); g.input('wheel', { deltaY: 100, deltaX: 0 }); g.advance(3000);
  assert.equal(g.view.scrollY, reading.faq, 'from rest on the last offer, the next swipe opens the FAQ');
  g.assist.dispose();
});

test('a fractional stop rounded down by a 1x display counts as reached, so the next swipe advances', () => {
  // Chrome 1887x861 at DPR 1: ai stop 3616.4 is shown at scrollY 3616; every wheel re-targeted it.
  for (const fine of [true, false]) {
    const f = fixture({ fine }), stops = authoredReadingStops(f.bounds), at = Math.floor(stops[1].y) - (stops[1].y % 1 ? 0 : 0.4);
    f.move(at); f.advance(500);
    if (fine) f.input('wheel', { deltaY: 100, deltaX: 0 });
    else { f.input('touchstart', { touches: [{ clientY: 400 }] }); f.input('touchmove', { touches: [{ clientY: 370 }] }); f.move(at + 30); f.input('touchend', { touches: [] }); }
    f.advance(3000);
    assert.ok(Math.abs(f.view.scrollY - stops[2].y) < 1, `${fine ? 'wheel' : 'touch'} reaches the following stop`);
    f.assist.dispose();
  }
});

test('a continuous desktop wheel stops on the last offer; only a second swipe after a pause opens the FAQ', () => {
  const bounds = geometry(), pricing = bounds.transitions.find(item => item.to.id === 'open-weight').end;
  const reading = { start: pricing, end: pricing + 2000, faq: pricing + 3000 };
  const f = fixture({ fine: true }); f.bounds.pricing = reading; f.move(reading.end - 260); f.advance(500);
  // Each notch is native inside the offers; Chrome's smooth scroll keeps moving after it.
  for (let i = 0; i < 12; i++) { f.input('wheel', { deltaY: 100, deltaX: 0 }); for (let k = 0; k < 3; k++) { f.advance(16); f.move(f.view.scrollY + 34); } }
  f.end(); f.advance(3000);
  assert.equal(f.view.scrollY, reading.end, 'continuous scrolling rests on the last offer');
  f.advance(400); f.input('wheel', { deltaY: 100, deltaX: 0 }); f.advance(3000);
  assert.equal(f.view.scrollY, reading.faq, 'a second swipe opens the FAQ');
  f.assist.dispose();
});
