import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { scaledCinematicTiming, measureChapterTransitions, chapterNavigationTarget } from '../components/immersive/SceneDirector.js';

import * as assistance from '../components/immersive/EntryScrollAssist.js';
const { createEntryScrollAssist } = assistance;

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

function fixture({ scrollend = true, stageHeight = 844, pace = 1, diagnostics = false, reporterThrows = false, mode = "baseline" } = {}) {
  assert.equal(typeof createEntryScrollAssist, 'function', 'the entry assist helper must exist');
  const listeners = new Map(), timers = new Map(), calls = [], reports = [];
  let clock = 0, timerId = 0, blocked = false;
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
    location: { search: mode === "baseline" ? "?sceneDiagnostics=1&scrollAssistMode=baseline" : diagnostics ? "?sceneDiagnostics=1&scrollAssistMode=early" : "?scrollAssistMode=baseline" },
    __vistaireScrollAssistTrace: diagnostics ? row => { if (reporterThrows) throw new Error("diagnostic consumer failed"); reports.push(row); } : undefined,
    performance: { now: () => clock }, matchMedia: () => media,
    setTimeout(callback, delay) { timers.set(++timerId, { callback, at: clock + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { timers.set(++timerId, { callback, at: clock + 16, frame: true }); return timerId; },
    cancelAnimationFrame(id) { timers.delete(id); },
    scrollTo(options) {
      calls.push(options);
      if (options.behavior === 'instant' && mode !== 'baseline') {
        view.scrollY = options.top;
        view.setTimeout(() => { emit(view, 'scroll', { target: document }); emit(document, 'scrollend', { target: document }); }, 0);
      }
    },
  };
  const bounds = geometry(stageHeight, pace);
  const assist = createEntryScrollAssist({ getGeometry: () => bounds, isBlocked: () => blocked }, view);
  const emit = (object, type, extra = {}) => {
    const event = { type, target, timeStamp: clock, isTrusted: true, defaultPrevented: false, ...extra };
    for (const handler of listeners.get(object)?.get(type) || []) handler(event);
  };
  const input = (type, extra) => emit(document, type, extra);
  const move = y => { view.scrollY = y; emit(view, 'scroll', { target: document }); };
  const wheel = (y, direction = 1, extra = {}) => {
    view.scrollY = y - direction * 20;
    input('wheel', { deltaY: direction * 20, deltaX: 0, ...extra });
    move(y);
  };
  const end = () => emit(document, 'scrollend', { target: document });
  const advance = ms => {
    const until = clock + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next; timers.delete(id); clock = timer.at; timer.callback(clock);
    }
    clock = until;
  };
  return { assist, bounds, view, document, media, target, calls, reports, now: () => clock, stall: ms => { clock += ms; for (const timer of timers.values()) if (timer.at < clock) timer.at = clock; }, frames: () => [...timers.values()].filter(timer => timer.frame).length, input, move, wheel, end, advance, timers, listeners, emit, block: value => { blocked = value; } };
}

const smoothCalls = f => f.calls.filter(call => call.behavior === 'smooth');

test('native scrollend completes only a committed handoff and never chains chapters', () => {
  const f = fixture(), join = f.bounds.transitions[0];
  f.wheel(join.end - 50);
  f.advance(1000);
  f.emit(f.document, 'scrollend', { target: {} });
  assert.equal(f.calls.length, 0, 'nested scrollers must not end the document gesture');
  assert.equal(f.calls.length, 0, 'supported scrollend must own native inertia completion');
  f.end();
  assert.deepEqual(f.calls, [{ top: join.end, behavior: 'smooth' }]);
  f.move(join.end); f.end();
  f.move(f.bounds.transitions[1].end - 50); f.end();
  assert.equal(f.calls.length, 1, 'the assist and later programmatic scroll cannot rearm themselves');
  f.wheel(join.start + 20); f.end();
  assert.equal(f.calls.length, 1, 'an uncommitted start must not jump the entire handoff');
  f.assist.dispose();

  const small = fixture({ stageHeight: 300 }), smallJoin = small.bounds.transitions[0];
  small.wheel(smallJoin.end - 481); small.end();
  assert.equal(small.calls.length, 0, 'the stage-relative cap also applies');
  small.wheel(smallJoin.end - 479); small.end();
  assert.equal(smoothCalls(small)[0]?.top, smallJoin.end);
  small.assist.dispose();

  const short = fixture(), shortJoin = short.bounds.transitions[0];
  shortJoin.start = shortJoin.end - 100;
  short.wheel(shortJoin.end - 51); short.end();
  assert.equal(short.calls.length, 0, 'the measured transition fraction is also capped');
  short.wheel(shortJoin.end - 49); short.end();
  assert.equal(smoothCalls(short)[0]?.top, shortJoin.end);
  short.assist.dispose();
});

test('mid-transition completion follows one measured trajectory in either direction and caps slow-preview travel', () => {
  for (const calibration of [
    { stageHeight: 844, limit: 1350.4 }, { stageHeight: 900, limit: 1440 },
    { stageHeight: 844, pace: 0.25, limit: 1688 }, { stageHeight: 844, pace: 4, limit: 654.1 },
  ]) {
    const f = fixture(calibration), { opening, transitions } = f.bounds;
    const leg = (opening.motionTravel - opening.aiHoldTravel) / 2;
    const entries = [
      { start: opening.top, end: opening.top + leg },
      { start: opening.top + leg + opening.aiHoldTravel, end: opening.top + opening.motionTravel },
      ...transitions.filter(join => !['open-weight', 'footer'].includes(join.to.id)),
    ];
    assert.equal(entries.length, 9);
    for (const entry of entries) for (const direction of [-1, 1]) {
      const target = direction > 0 ? entry.end : entry.start;
      const before = smoothCalls(f).length;
      f.wheel(target - direction * (calibration.limit + 1), direction); f.end();
      assert.equal(smoothCalls(f).length, before, 'long or uncommitted remainder stays native');
      const start = target - direction * (calibration.limit - 1);
      f.wheel(start, direction); f.end();
      assert.equal(smoothCalls(f).length, before + 1, 'a meaningful transition remainder completes');
      assert.equal(smoothCalls(f).at(-1).top, target);
      assert.ok(Math.abs(target - start) <= 2 * opening.stageHeight, 'no assist exceeds two frozen stages');
      for (let sample = 0; sample <= 10; sample++) {
        const y = start + (target - start) * sample / 10;
        assert.ok(y >= entry.start - 1e-7 && y <= entry.end + 1e-7, 'the entire requested path remains in this one measured handoff');
      }
      f.move(target); f.end();
    }
    f.assist.dispose();
  }
});

test('the committed end of a section completes to its authored boundary without auto-chaining through the next handoff', () => {
  const f = fixture(), previous = f.bounds.transitions[0], next = f.bounds.transitions[1];
  f.wheel(next.start - 361); f.end();
  assert.equal(f.calls.length, 0, 'the body of an unread section remains native');
  f.wheel(next.start - 300); f.end();
  assert.deepEqual(smoothCalls(f), [{ top: next.start, behavior: 'smooth' }]);
  f.move(next.start); f.end(); f.advance(1000);
  assert.equal(smoothCalls(f).length, 1, 'finishing a section does not chain a second transition');
  f.wheel(previous.end + 300, -1); f.end();
  assert.equal(smoothCalls(f).at(-1).top, previous.end, 'reverse section completion returns to the same first reading pose');
  f.assist.dispose();
});

test('opening entries stop at the measured AI or phone pose without consuming a reading hold', () => {
  const f = fixture(), opening = f.bounds.opening;
  const firstEnd = opening.top + (opening.motionTravel - opening.aiHoldTravel) / 2;
  for (const end of [firstEnd, opening.top + opening.motionTravel]) {
    f.wheel(end - 40); f.end();
    assert.equal(smoothCalls(f).at(-1).top, end);
    f.move(end); f.end();
  }
  f.wheel(firstEnd + opening.aiHoldTravel / 2); f.end();
  assert.equal(smoothCalls(f).length, 2, 'ordinary AI reading remains native');
  f.assist.dispose();
});

test('reverse input never pulls forward and can finish only the nearby reverse entry', () => {
  const f = fixture(), join = f.bounds.transitions[0];
  f.wheel(join.end - 40, -1); f.end();
  assert.equal(f.calls.length, 0);
  f.wheel(join.start + 40, -1); f.end();
  assert.deepEqual(smoothCalls(f), [{ top: join.start, behavior: 'smooth' }]);
  f.move(join.start); f.end();
  f.wheel(join.end - 40, 1); f.move(join.end - 60); f.end();
  assert.equal(smoothCalls(f).length, 1, 'reverse movement cancels mismatched gesture intent');
  f.assist.dispose();
});

test('fresh wheel, touch, key or pointer immediately interrupts the helper smooth scroll', () => {
  for (const [type, extra] of [['wheel', { deltaY: -20 }], ['touchstart', { touches: [{ clientY: 100 }] }], ['keydown', { key: 'Escape' }], ['pointerdown', {}]]) {
    const f = fixture(), join = f.bounds.transitions[0];
    f.wheel(join.end - 40); f.end(); f.move(join.end - 20);
    f.input(type, extra);
    assert.deepEqual(f.calls.at(-1), { top: join.end - 20, behavior: 'instant' }, type);
    f.end(); f.advance(1000);
    assert.equal(smoothCalls(f).length, 1, `${type} needs fresh matching scroll before another assist`);
    f.assist.dispose();
  }
});

test('direct anchors, synthetic input, controls, editing and stale intent cannot arm entry assistance', () => {
  for (const kind of ['programmatic', 'hash', 'cancel', 'untrusted', 'control', 'focused-control', 'stale', 'home']) {
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
      if (kind === 'stale') f.advance(1000);
      f.move(y);
    }
    f.end(); f.advance(1000);
    assert.equal(f.calls.length, 0, kind);
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

test('a no-pixel same-direction tail retains genuine native motion until settlement without rearming completion', () => {
  for (const scrollend of [true, false]) {
    const f = fixture({ scrollend }), join = f.bounds.transitions[0];
    f.wheel(join.end - 40);
    f.advance(100);
    f.input('wheel', { deltaY: 0.1, deltaX: 0 });
    if (scrollend) f.end();
    else {
      f.advance(279); assert.equal(f.calls.length, 0, 'tail input restarts the quiet wait'); f.advance(1);
    }
    assert.deepEqual(smoothCalls(f), [{ top: join.end, behavior: 'smooth' }], 'subpixel tail cannot discard the native movement already observed');
    f.move(join.end); f.end();
    f.input('wheel', { deltaY: 0.1, deltaX: 0 }); f.end(); f.advance(1000);
    assert.equal(smoothCalls(f).length, 1, 'the consumed gesture cannot rearm on residual packets without fresh native motion');
    f.assist.dispose();
  }
  const reverse = fixture(), join = reverse.bounds.transitions[0];
  reverse.wheel(join.end - 40);
  reverse.input('wheel', { deltaY: -0.1, deltaX: 0 }); reverse.end();
  assert.equal(reverse.calls.length, 0, 'a reverse tail cancels previous forward intent');
  reverse.assist.dispose();
  const keyboard = fixture();
  keyboard.wheel(keyboard.bounds.transitions[0].end - 40);
  keyboard.input('keydown', { key: 'PageDown' });
  keyboard.input('keyup', { key: 'PageDown' }); keyboard.end();
  assert.equal(keyboard.calls.length, 0, 'switching input types starts fresh intent and cannot inherit old wheel movement');
  keyboard.assist.dispose();
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
    f.end();
    assert.deepEqual(smoothCalls(f), [{ top: join.end, behavior: 'smooth' }], `${tag} stale focus, ${input} on background`);
    f.move(join.end); f.end();
    f.wheel(y, 1, { target: control }); f.end();
    f.input('keydown', { key: 'PageDown', target: control }); f.move(y + 10);
    f.input('keyup', { key: 'PageDown', target: control }); f.end();
    assert.equal(smoothCalls(f).length, 1, 'events targeting the focused control still cannot arm assistance');
    f.assist.dispose();
  }
  for (const tag of ['input', 'textarea', '[role="slider"]', '[contenteditable]:not([contenteditable="false"])', '[role="dialog"]', '[role="menu"]', 'video']) {
    const f = fixture();
    f.document.activeElement = element(tag);
    f.wheel(f.bounds.transitions[0].end - 40); f.end();
    assert.equal(f.calls.length, 0, `${tag} focus keeps its existing protection`);
    f.assist.dispose();
  }
});

test('fallback waits for input and scroll silence after physical touch or key release', () => {
  const f = fixture({ scrollend: false }), y = f.bounds.transitions[0].end - 40;
  f.view.scrollY = y - 20;
  f.input('touchstart', { touches: [{ clientY: 200 }] });
  f.input('touchmove', { touches: [{ clientY: 180 }] }); f.move(y);
  f.advance(1000);
  assert.equal(f.calls.length, 0, 'a held finger never triggers assistance');
  f.input('touchend', { touches: [] });
  f.advance(200); f.move(y + 5); f.advance(279);
  assert.equal(f.calls.length, 0, 'native inertia resets the quiet interval');
  f.advance(1);
  assert.deepEqual(smoothCalls(f), [{ top: f.bounds.transitions[0].end, behavior: 'smooth' }]);
  f.assist.dispose();

  const keyboard = fixture({ scrollend: false });
  keyboard.view.scrollY = y - 20;
  keyboard.input('keydown', { key: 'PageDown' }); keyboard.move(y);
  keyboard.advance(1000); assert.equal(keyboard.calls.length, 0, 'held keyboard input stays native');
  keyboard.input('keyup', { key: 'PageDown' }); keyboard.advance(280);
  assert.equal(smoothCalls(keyboard).length, 1);
  keyboard.assist.dispose();
});

test('blocked, hidden, reduced-motion and natural pricing/footer spans remain native; disposal removes all work', () => {
  for (const kind of ['blocked', 'hidden', 'reduced', 'pricing', 'footer', 'pricing-visible']) {
    const f = fixture(), pricing = f.bounds.transitions.find(join => join.to.id === 'open-weight');
    if (kind === 'blocked') f.block(true);
    if (kind === 'hidden') f.document.hidden = true;
    if (kind === 'reduced') f.media.matches = true;
    const y = kind === 'pricing' ? pricing.end - 40 : kind === 'footer' ? f.bounds.transitions.at(-1).end - 40
      : kind === 'pricing-visible' ? pricing.to.top - f.view.innerHeight + 40 : f.bounds.transitions[0].end - 40;
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
  assert.match(source, /getGeometry: \(\) => \(\{ opening, transitions \}\)/);
  assert.match(source, /arActive: arStatus !== "idle"/);
});


test('diagnostics are opt-in and cannot change scroll outputs, timer lifecycle, cancellation or disposal', () => {
  const run = options => {
    const f = fixture(options), states = [], target = f.bounds.transitions[0].end;
    const snapshot = () => states.push({ y: f.view.scrollY, calls: structuredClone(f.calls), timers: [...f.timers.values()].map(timer => timer.at), listeners: [...f.listeners.values()].flatMap(types => [...types.values()].map(handlers => handlers.size)) });
    f.wheel(target - 50); snapshot(); f.end(); snapshot();
    f.input('pointerdown', {}); snapshot();
    f.wheel(target - 20, -1); f.move(target - 40); f.end(); snapshot();
    f.assist.cancel('layout-changed'); snapshot();
    f.input('wheel', { deltaY: 20 }); f.advance(750); f.move(target - 10); f.end(); snapshot();
    f.input('keydown', { key: 'PageDown' }); f.move(target - 5); f.end(); snapshot();
    f.input('keyup', { key: 'PageDown' }); f.end(); snapshot();
    f.move(target); f.end(); f.advance(1000); snapshot();
    f.assist.dispose(); snapshot();
    return { states, reports: f.reports };
  };
  for (const scrollend of [true, false]) {
    const ordinary = run({ scrollend }), traced = run({ scrollend, diagnostics: true }), throwing = run({ scrollend, diagnostics: true, reporterThrows: true });
    assert.deepEqual(traced.states, ordinary.states);
    assert.deepEqual(throwing.states, ordinary.states, 'a diagnostic callback must not break the native lifecycle');
    assert.equal(ordinary.reports.length, 0);
    assert.ok(traced.reports.length > 0, 'enabled diagnostics must actually report');
    assert.ok(traced.reports.some(row => row.type === 'cancel' && row.reason === 'layout-changed'));
    assert.ok(traced.reports.some(row => row.type === 'settle-return' && row.reason === 'key-held'));
  }
});

test('diagnostics distinguish passive zero-delta delivery, age rejection, blocked intent, settlement and measured eligibility', () => {
  const f = fixture({ diagnostics: true }), target = f.bounds.transitions[0].end;
  f.view.scrollY = target - 40;
  f.input('wheel', { deltaY: 40, timeStamp: 3 }); f.move(target - 40); f.end();
  assert.ok(f.reports.some(row => row.type === 'scroll-return' && row.reason === 'zero-delta' && row.lastY === target - 40));
  assert.ok(f.reports.some(row => row.type === 'settle-return' && row.reason === 'no-native-motion' && row.gesture?.scrolled === false));
  f.input('wheel', { deltaY: 20, timeStamp: 5 }); f.advance(750); f.move(target - 20);
  const expired = f.reports.find(row => row.type === 'scroll-cancel' && row.reason === 'first-scroll-expired');
  assert.equal(expired.age, 750); assert.equal(expired.handledAt, 750); assert.equal(expired.eventTimeStamp, 750);
  assert.equal(expired.hasScrollEnd, true); assert.equal(expired.currentY, target - 20);
  f.block(true); f.input('wheel', { deltaY: 20 });
  assert.ok(f.reports.some(row => row.type === 'intent-rejected' && row.reason === 'caller-blocked'));
  f.block(false); f.input('wheel', { deltaY: 20, target: { closest: () => ({}) } });
  assert.ok(f.reports.some(row => row.type === 'intent-rejected' && row.reason === 'control-target'));
  f.wheel(target - 50); f.end();
  const eligible = f.reports.find(row => row.type === 'assist-start');
  assert.equal(eligible.target, target); assert.equal(eligible.distance, 50); assert.ok(Math.abs(eligible.limit - 1350.4) < 1e-8);
  assert.equal(eligible.phase.start, f.bounds.transitions[0].start); assert.equal(eligible.phase.end, target);
  assert.equal(eligible.geometry.stageHeight, 844);
  assert.ok(f.reports.some(row => row.type === 'scrollend' && row.gesture?.scrolled));
  f.assist.dispose();
});

test('the two retained c9 Chromium compositor-before-wheel orderings still complete after their matching scroll event', () => {
  for (const trace of [
    { baselineAt: 5190.5, inputAt: 5248.8, handledAt: 5271.6, scrollAt: 5271 },
    { baselineAt: 5708.9, inputAt: 5820.9, handledAt: 9752.1, scrollAt: 9751.3 },
  ]) for (const direction of [1, -1]) for (const noPixelTail of [false, true]) {
    const f = fixture({ diagnostics: true });
    const target = direction > 0 ? f.bounds.opening.motionTravel / 2 - f.bounds.opening.aiHoldTravel / 2 : 0;
    const baseline = direction > 0 ? 2621 : 80, advanced = baseline + direction * 40;
    f.advance(trace.baselineAt); f.move(baseline); f.end();
    f.advance(trace.handledAt - trace.baselineAt);
    f.view.scrollY = advanced; // Compositor already moved; its scroll event is queued.
    f.input('wheel', { deltaY: direction * 40, timeStamp: trace.inputAt });
    if (noPixelTail) f.input('wheel', { deltaY: direction * 0.01, timeStamp: trace.inputAt + 0.1 });
    assert.equal(smoothCalls(f).length, 0, 'a pre-input position difference alone cannot start assistance');
    f.emit(f.view, 'scroll', { target: f.document, timeStamp: trace.scrollAt });
    f.end();
    assert.equal(smoothCalls(f).length, 1, `matching ${direction} movement survives delivery at ${trace.handledAt}`);
    assert.equal(smoothCalls(f)[0].top, target);
    f.move(target); f.end();
    const calls = f.calls.length;
    f.input('wheel', { deltaY: direction * 0.01 }); f.move(target); f.end();
    assert.equal(f.calls.length, calls, 'a consumed completion and no-pixel tail cannot start another phase');
    f.assist.dispose();
  }
});

test('pending compositor evidence excludes stale programmatic scroll, reverse motion, rejected controls and active assistance', () => {
  for (const scenario of ['missing-scroll', 'old-scroll', 'untrusted-scroll', 'input-before-baseline', 'reverse', 'control', 'untrusted-input', 'cancelled', 'assisting']) {
    const f = fixture();
    f.advance(100); f.move(2621); f.end(); f.advance(20);
    if (scenario === 'assisting') { f.wheel(2621); f.end(); }
    const prior = smoothCalls(f).length;
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
    f.end();
    assert.equal(smoothCalls(f).length, prior, scenario);
    f.assist.dispose();
  }
});

test('native keyboard overshoot is never pulled back while an in-range keyboard entry can complete', () => {
  const f = fixture({ stageHeight: 843.984375 });
  const end = (f.bounds.opening.motionTravel - f.bounds.opening.aiHoldTravel) / 2;
  assert.equal(end, 2700.75);
  f.move(2620);
  f.input('keydown', { key: 'ArrowDown' });
  f.move(2709); // Actual pinned WebKit movement: 89px, beyond the small-gap target.
  f.input('keyup', { key: 'ArrowDown' });
  f.end();
  assert.equal(smoothCalls(f).length, 0, 'native overshoot must not trigger backward completion');
  assert.equal(f.view.scrollY, 2709);
  f.move(2520);
  f.input('keydown', { key: 'ArrowDown' });
  f.move(2609); // The same real input now has room before the intended endpoint.
  f.input('keyup', { key: 'ArrowDown' });
  f.end();
  assert.deepEqual(smoothCalls(f), [{ top: end, behavior: 'smooth' }]);
  f.assist.dispose();
});


function decelerate(f, target, { held = false } = {}) {
  f.view.scrollY = target - 1200;
  if (held) { f.input('touchstart', { touches: [{ clientY: 200 }] }); f.input('touchmove', { touches: [{ clientY: 180 }] }); }
  else f.input('wheel', { deltaY: 20 });
  f.advance(16); f.move(target - 1180);
  for (const delta of [12, 6, 2]) {
    f.view.scrollY += delta; f.advance(16); f.move(f.view.scrollY);
  }
}

test('early handoff uses released, freshly decelerating native motion before a missing scrollend, with no idle loop', () => {
  const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
  decelerate(f, target);
  assert.equal(f.calls.length, 0, 'native motion owns every advancing frame');
  f.advance(16); assert.equal(f.calls.length, 0, 'one stationary frame is insufficient');
  f.advance(16);
  const handoff = f.reports.find(row => row.type === 'handoff');
  assert.equal(handoff?.source, 'deceleration');
  assert.equal(handoff?.stationaryMs, 32); assert.equal(handoff?.stationaryFrames, 2);
  assert.ok(handoff.velocity >= 0 && handoff.velocity <= 0.125);
  assert.equal(f.calls.length, 0, 'handoff is followed by the next animation frame');
  f.advance(16); assert.equal(f.calls[0]?.behavior, 'instant');
  f.advance(1000); assert.equal(f.view.scrollY, target); assert.equal(f.frames(), 0);
  const calls = f.calls.length; f.advance(5000); f.end(); assert.equal(f.calls.length, calls);
  f.assist.dispose();
});

test('resumed inertia, held contact and long delivery pauses invalidate the early handoff evidence', () => {
  for (const scenario of ['resumed-before-handoff', 'resumed-before-write', 'held-touch', 'held-pointer', 'long-frame']) {
    const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
    if (scenario === 'held-pointer') f.input('pointerdown', { pointerId: 1 });
    decelerate(f, target, { held: scenario === 'held-touch' });
    if (scenario === 'resumed-before-handoff') { f.advance(16); f.view.scrollY += 3; f.advance(16); }
    else if (scenario === 'resumed-before-write') { f.advance(32); f.view.scrollY += 3; f.advance(16); }
    else if (scenario === 'long-frame') { f.stall(250); f.advance(0); }
    else f.advance(100);
    assert.equal(f.calls.length, 0, scenario);
    f.assist.dispose(); assert.equal(f.frames(), 0);
  }
});

test('early continuation yields to fresh input, foreign movement, reduced motion and disposal at every phase', () => {
  for (const phase of [0, 32, 96]) for (const action of ['wheel', 'touchstart', 'keydown', 'pointerdown', 'foreign', 'reduced', 'dispose']) {
    const f = fixture({ mode: 'early' }), target = f.bounds.transitions[0].end;
    decelerate(f, target); f.advance(phase);
    if (action === 'foreign') f.view.scrollY -= 5;
    else if (action === 'reduced') { f.media.matches = true; f.emit(f.media, 'change'); }
    else if (action === 'dispose') f.assist.dispose();
    else f.input(action, { deltaY: -20, key: 'Escape', touches: [{ clientY: 200 }] });
    const calls = f.calls.length; f.advance(1000);
    assert.equal(f.calls.length, calls, `${action} at ${phase}`);
    f.assist.dispose(); assert.equal(f.frames(), 0);
  }
});

test('the candidate completes one adjacent reading stop and keeps baseline comparison diagnostic-only', () => {
  for (const mode of ['baseline', 'early']) {
    const f = fixture({ mode }), target = f.bounds.transitions[0].end;
    f.wheel(target - 2000); f.end(); f.advance(5000);
    if (mode === 'baseline') assert.equal(f.calls.length, 0, 'same-build baseline keeps the published range');
    else { assert.equal(f.view.scrollY, target, 'scrollAssistMode=baseline without sceneDiagnostics cannot disable the candidate'); assert.ok(f.calls.every(call => call.behavior === 'instant')); }
    f.assist.dispose();
  }
  const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[1].end;
  f.wheel(f.bounds.transitions[1].start - 1000); f.end(); f.advance(10000);
  assert.equal(f.view.scrollY, target); const calls = f.calls.length;
  f.end(); f.advance(1000); assert.equal(f.calls.length, calls); f.assist.dispose();
});

test('corroborated pre-handler displacement never becomes inferred velocity or early deceleration', () => {
  const f = fixture({ mode: 'early', diagnostics: true });
  f.advance(100); f.move(2621); f.end(); f.advance(4000);
  f.view.scrollY = 2661; f.input('wheel', { deltaY: 40, timeStamp: 120 });
  f.emit(f.view, 'scroll', { target: f.document, timeStamp: 4099 });
  f.advance(96); assert.equal(f.calls.length, 0, 'unknown-timing displacement has no deceleration evidence');
  f.end();
  assert.equal(f.reports.find(row => row.type === 'handoff')?.velocity, 0);
  f.advance(1000); assert.equal(f.view.scrollY, f.bounds.opening.motionTravel / 2); f.assist.dispose();
});

test('the seeded curve is monotone by feasible ramps, with zero endpoint acceleration and no stale velocity replay', () => {
  assert.equal(typeof assistance.createScrollContinuation, 'function');
  for (const direction of [-1, 1]) for (const distance of [40, 1000, 2295.68, 2532]) for (const velocity of [0, 0.5, 2.5, 6]) {
    const curve = assistance.createScrollContinuation(5000, 5000 + direction * distance, direction * velocity, 844);
    const seed = Math.min(velocity, 844 * 4 / 1000);
    assert.ok(Number.isFinite(curve.duration) && curve.duration > 0);
    assert.ok(seed * curve.duration / distance <= 2 + 1e-10);
    const h = .001;
    assert.ok(Math.abs((curve.at(h) - curve.at(0)) / h - direction * seed) < .002);
    assert.ok(Math.abs((curve.at(2 * h) - 2 * curve.at(h) + curve.at(0)) / h ** 2) < .02);
    let previous = 5000;
    for (let i = 1; i <= 200; i++) { const y = curve.at(i * curve.duration / 200); assert.ok((y - previous) * direction >= -1e-8); assert.ok((5000 + direction * distance - y) * direction >= -1e-8); previous = y; }
    assert.equal(curve.at(curve.duration), 5000 + direction * distance);
  }
});


test('intermediate scrollend in a 16ms native packet train cannot start repeated assistance', () => {
  const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
  f.move(target - 1000);
  for (const delta of [80, 40, 20, 10, 5, 2]) {
    f.input('wheel', { deltaY: delta }); f.move(f.view.scrollY + delta); f.end(); f.advance(16);
    assert.equal(f.calls.length, 0, 'native packets retain ownership throughout the burst');
  }
  f.advance(1000); assert.equal(f.view.scrollY, target);
  assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1);
  f.assist.dispose();
});

test('a native scrollend acknowledging the last moving frame remains valid without low-speed deceleration', () => {
  const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
  f.move(target - 1000);
  for (const delta of [80, 80, 80]) {
    f.input('wheel', { deltaY: delta }); f.move(f.view.scrollY + delta); f.end(); f.advance(16);
  }
  f.advance(1000);
  assert.equal(f.reports.find(row => row.type === 'handoff')?.source, 'scrollend');
  assert.equal(f.view.scrollY, target); f.assist.dispose();
});

test('physical release restarts the quiet window and natural offers reading never starts an observer', () => {
  const held = fixture({ mode: 'early', diagnostics: true }), target = held.bounds.transitions[0].end;
  decelerate(held, target, { held: true }); held.advance(32);
  held.input('touchend', { touches: [] }); held.end(); held.advance(48);
  assert.equal(held.calls.length, 0, 'physical release requires its own input-silence window');
  held.advance(1000); assert.equal(held.view.scrollY, target); held.assist.dispose();
  const reading = fixture({ mode: 'early' }), pricing = reading.bounds.transitions.find(join => join.to.id === 'open-weight');
  reading.wheel(pricing.to.top + 100);
  assert.equal(reading.frames(), 0, 'offers/FAQ native reading has no assistance observer');
  reading.end(); reading.advance(1000); assert.equal(reading.calls.length, 0); reading.assist.dispose();
});

test('a stalled continuation frame pauses then completes instead of jumping or abandoning its target', () => {
  const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
  decelerate(f, target); f.advance(48);
  assert.ok(f.calls.length > 0);
  const calls = f.calls.length, y = f.view.scrollY;
  f.stall(250); f.advance(0);
  assert.equal(f.calls.length, calls); assert.equal(f.view.scrollY, y);
  assert.ok(f.reports.some(row => row.type === 'continuation-paused'));
  assert.equal(f.frames(), 1);
  f.advance(2000); assert.equal(f.view.scrollY, target); assert.equal(f.frames(), 0); f.assist.dispose();
});

test('native touch pan pointercancel releases pointer ownership without discarding the independent touch gesture', () => {
  for (const pointerFirst of [false, true]) {
    const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
    f.view.scrollY = target - 1000;
    const pointer = () => f.input('pointerdown', { pointerType: 'touch', pointerId: 1 });
    if (pointerFirst) pointer();
    f.input('touchstart', { touches: [{ clientY: 200 }] });
    if (!pointerFirst) pointer();
    f.input('touchmove', { touches: [{ clientY: 180 }] }); f.move(target - 980);
    f.input('pointercancel', { pointerType: 'touch', pointerId: 1 });
    f.input('touchmove', { touches: [{ clientY: 160 }] }); f.move(target - 960);
    f.input('touchend', { touches: [] }); f.end(); f.advance(1000);
    assert.equal(f.view.scrollY, target, 'Touch Events may continue after UA panning cancels Pointer Events');
    assert.ok(!f.reports.some(row => row.type === 'intent-rejected' && row.reason === 'no-eligible-touch-start'));
    f.assist.dispose();
  }
  const cancelled = fixture({ mode: 'early' }), target = cancelled.bounds.transitions[0].end;
  decelerate(cancelled, target, { held: true }); cancelled.input('touchcancel', { touches: [] });
  cancelled.end(); cancelled.advance(1000); assert.equal(cancelled.calls.length, 0); cancelled.assist.dispose();
});

test('native observation uses actual delivery time when rAF timestamps lag the observed position', () => {
  const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
  decelerate(f, target); // Last native sample at 64ms; two decreasing velocities.
  const deliver = rafAt => {
    const [id, timer] = [...f.timers].find(([, entry]) => entry.frame);
    f.timers.delete(id); timer.callback(rafAt);
  };
  f.stall(250); deliver(80); // Callback reads current position at 314ms, not 80ms.
  f.stall(16); deliver(96); // Another stale stamp must not manufacture 32ms quiet.
  assert.equal(f.reports.filter(row => row.type === 'handoff').length, 0,
    'a 250ms delivery pause invalidates deceleration rather than qualifying early takeover');
  assert.equal(f.calls.length, 0);
  f.assist.dispose(); assert.equal(f.frames(), 0);
});

test('continuation pause uses actual callback delivery despite a fresh-looking rAF timestamp', () => {
  const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
  decelerate(f, target); f.advance(48); // First assisted frame at 112ms.
  const calls = f.calls.length, y = f.view.scrollY;
  f.stall(250); // Actual next callback delivery is 362ms.
  const [id, timer] = [...f.timers].find(([, entry]) => entry.frame);
  f.timers.delete(id); timer.callback(128); // Its stamp misleadingly implies only 16ms.
  assert.equal(f.calls.length, calls, 'pause before any write across the actual 250ms gap');
  assert.equal(f.view.scrollY, y);
  assert.ok(f.reports.some(row => row.type === 'continuation-paused'));
  assert.equal(f.frames(), 1);
  f.advance(2000); assert.equal(f.view.scrollY, target); f.assist.dispose();
});

test('retained assistance diagnostics snapshot immutable scalar state rather than the live controller', () => {
  const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
  decelerate(f, target); f.advance(48);
  const row = f.reports.find(entry => entry.assisting && typeof entry.assisting === 'object');
  assert.ok(row, 'the first assisted frame retains its diagnostic state');
  const snapshot = JSON.parse(JSON.stringify(row.assisting));
  f.advance(64);
  assert.deepEqual(row.assisting, snapshot, 'later frames must not rewrite an earlier retained row');
  assert.deepEqual(Object.keys(row.assisting).sort(), ['duration', 'expectedY', 'lastFrameAt', 'started', 'target']);
  assert.equal(typeof row.assisting.duration, 'number');
  f.assist.dispose();
});

test('short stop completion keeps the tuned release handoff and stationary proof', () => {
  const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
  f.wheel(target - 40); f.end();
  f.advance(32);
  assert.equal(f.reports.filter(row => row.type === 'handoff').length, 0, '32ms is still inside the 40ms input-silence gate');
  f.advance(16);
  const handoff = f.reports.find(row => row.type === 'handoff');
  assert.equal(handoff?.inputQuietMs, 48, 'a 16ms frame cadence can now transfer before the old 60ms gate');
  assert.equal(handoff?.duration, 120);
  f.advance(16);
  assert.equal(f.calls.length, 1); assert.equal(f.now(), 64);
  assert.ok(f.view.scrollY > target - 39.5, 'the first write requests more than half a CSS pixel');
  f.advance(16);
  assert.ok(f.view.scrollY >= target - 39, 'the request exceeds one CSS pixel by 80ms in this deterministic fixture');
  f.advance(1000); assert.equal(f.view.scrollY, target); f.assist.dispose();
  const curve = assistance.createScrollContinuation(0, 1000, 0, 844);
  assert.ok(Math.abs(curve.duration - 514.9447077409163) < 1e-8);
});


function authoredReadingStops(bounds, pace = 1) {
  const { opening, transitions } = bounds, timing = scaledCinematicTiming(1 / pace);
  return [
    ...[['hero', 0], ['ai', .5], ['wearable', 1]].map(([id, anchor]) => ({ id, y: opening.top + opening.motionTravel * anchor })),
    ...transitions.filter(join => !['open-weight', 'footer'].includes(join.to.id)).map(join => {
      const y = chapterNavigationTarget(join.to, opening.stageHeight, timing);
      assert.ok(Math.abs(y - join.end) < 1e-7, 'incoming end must match the existing navigation pose');
      return { id: join.to.id, y };
    }).flatMap(stop => stop.id !== 'testimonies' ? [stop] : [{ id: 'sustainability-open', y: (join => join.from.top + join.from.travel * (timing.sceneScreens - timing.edgeScreens) / timing.sceneScreens)(transitions.find(join => join.from.id === 'sustainability')) }, stop]),
  ];
}

test('every authored gap and handoff completes to its adjacent navigation reading stop with no proximity eligibility', () => {
  for (const pace of [.25, 1, 4]) {
    const bounds = geometry(844, pace), stops = authoredReadingStops(bounds, pace);
    assert.deepEqual(stops.map(stop => stop.id), ['hero', 'ai', 'wearable', 'features', 'encryption', 'grip', 'sustainability', 'sustainability-open', 'testimonies', 'social-content', 'product']);
    for (let i = 1; i < stops.length; i++) {
      const before = stops[i - 1], after = stops[i];
      const points = new Set([before.y + .25, (before.y + after.y) / 2, after.y - .25]);
      for (const join of bounds.transitions) for (const y of [join.start + .25, (join.start + join.end) / 2, join.end - .25])
        if (y > before.y && y < after.y) points.add(y);
      for (const y of points) for (const direction of [-1, 1]) {
        const f = fixture({ mode: 'early', pace, diagnostics: true });
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
    const f = fixture({ mode: 'early' }), y = stops[i].y + offset;
    const next = direction > 0 ? stops.find(stop => stop.y > y) : [...stops].reverse().find(stop => stop.y < y);
    f.wheel(y, direction); f.end(); f.advance(30000); assert.equal(f.view.scrollY, next.y); f.assist.dispose();
  }
  for (const y of [stops.at(-1).y, stops.at(-1).y + 100]) {
    const f = fixture({ mode: 'early' }); f.wheel(y); f.end(); f.advance(30000);
    assert.equal(f.calls.length, 0, 'pricing/footer are not automatic destinations'); f.assist.dispose();
  }
});

test('long travel scales duration instead of compressing into 850ms or crawling at a near-zero seed', () => {
  for (const distance of [.25, 40, 1000, 9452.8, 35279.2]) for (const velocity of [0, .001, .15, 2.5, 1000]) {
    const curve = assistance.createScrollContinuation(0, distance, velocity, 844);
    const seed = Math.min(velocity, 844 * 4 / 1000);
    assert.ok(curve.duration > 0 && curve.duration <= 20900 + 1e-6);
    if (distance >= 9452) assert.ok(curve.duration >= 2800, 'a whole long chapter is not compressed into a fast jump');
    assert.ok(seed * curve.duration / distance <= 2 + 1e-8);
    let y = 0;
    for (let i = 1; i <= 100; i++) { const next = curve.at(i * curve.duration / 100); assert.ok(next >= y - 1e-6 && next <= distance + 1e-6); y = next; }
    assert.equal(curve.at(curve.duration), distance);
  }
});

test('repeated late frames preserve the same target but fresh user input cancels permanently while paused', () => {
  for (const interrupt of [false, true]) for (const beforeFirstWrite of [false, true]) {
    const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
    decelerate(f, target); f.advance(beforeFirstWrite ? 32 : 48);
    const before = f.view.scrollY, beforeCalls = f.calls.length;
    f.stall(791); f.advance(0); assert.equal(f.view.scrollY, before); assert.equal(f.calls.length, beforeCalls);
    for (const delay of [1084, 1163]) { f.stall(delay); f.advance(0); }
    const y = f.view.scrollY, calls = f.calls.length;
    assert.ok(y > before, 'consecutive stalls make bounded logical progress rather than stranding the stop');
    assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1);
    if (interrupt) f.input('pointerdown', {});
    f.advance(30000);
    assert.equal(f.view.scrollY, interrupt ? y : target);
    if (interrupt) assert.equal(f.calls.length, calls);
    assert.equal(f.frames(), 0); f.assist.dispose();
  }
});

test('a still-current trusted first scroll survives 1624ms delivery without borrowing cancelled or older motion', () => {
  for (const invalidation of [null, 'new-input', 'hidden', 'layout', 'older-event', 'untrusted-event']) {
    const f = fixture({ mode: 'early', diagnostics: true });
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
    assert.equal(f.view.scrollY, invalidation ? start + 20 : target, invalidation || 'late current input completes');
    assert.equal(f.reports.filter(row => row.type === 'handoff').length, invalidation ? 0 : 1);
    f.assist.dispose();
  }
});


test('long trips keep a fixed startup ramp and add cruise time rather than stretching the dead gap', () => {
  for (const velocity of [0, .001, .15, 2.5, 1000]) {
    const short = assistance.createScrollContinuation(0, 1000, velocity, 844);
    const long = assistance.createScrollContinuation(0, 35279.2, velocity, 844);
    assert.ok(long.at(16) >= .5, 'first request clears half a pixel at the next timely frame');
    assert.ok(long.at(32) >= 1, 'second timely frame clears one requested CSS pixel');
    assert.ok(Math.abs(short.at(16) - long.at(16)) < 1e-8, 'distance adds cruise, not slower startup');
    const seed = Math.min(velocity, 844 * 4 / 1000), peak = Math.max(seed, 844 * 3 / 1000);
    const cruise = (35279.2 - 120 * (seed / 2 + peak)) / peak;
    assert.ok(Math.abs(long.duration - (240 + cruise)) < 1e-8);
    for (const join of [120, 120 + cruise]) {
      const dt = .01, left = (long.at(join) - long.at(join - dt)) / dt, right = (long.at(join + dt) - long.at(join)) / dt;
      assert.ok(Math.abs(left - right) < 1e-5, 'velocity is continuous at each ramp/cruise join');
      assert.ok(Math.abs(left - peak) < 1e-5);
    }
  }
});

test('sustained 83ms and 100ms cadence eventually arrives using bounded logical steps after the first rebase', () => {
  for (const cadence of [83, 100]) {
    const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
    f.wheel(target - 1000); f.end(); f.advance(48);
    const curve = assistance.createScrollContinuation(target - 1000, target, 0, 844);
    f.stall(cadence); f.advance(0);
    assert.equal(f.calls.length, 0, 'the first stale callback must not catch up or write');
    let callbacks = 1;
    while (f.frames() && callbacks < 100) {
      f.stall(cadence); f.advance(0); callbacks++;
      assert.ok(Math.abs(f.view.scrollY - curve.at((callbacks - 1) * 16)) < 1e-7, 'one bounded logical frame, independent of late wall-time delivery');
    }
    assert.equal(f.view.scrollY, target); assert.equal(f.frames(), 0);
    assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1);
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
    const f = fixture({ mode: 'early', diagnostics: true }), target = f.bounds.transitions[0].end;
    f.view.scrollY = target - 1000;
    sequence(f, target);
    f.advance(8); f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
    assert.equal(f.view.scrollY, target, `${name}: the released touch completes its adjacent stop`);
    assert.equal(f.reports.filter(row => row.type === 'handoff').length, 1, name);
    f.assist.dispose();
  }
  // A scroll left over from earlier opposite inertia is not evidence for the new touch direction.
  const f = fixture({ mode: 'early' }), target = f.bounds.transitions[0].end;
  f.view.scrollY = target - 1000;
  f.input('touchstart', { touches: [{ clientY: 200 }] });
  f.move(target - 1010);
  f.input('touchmove', { touches: [{ clientY: 170 }] });
  f.input('touchend', { touches: [] }); f.end(); f.advance(30000);
  assert.equal(f.calls.length, 0);
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
      const f = fixture({ mode: 'early', pace }); f.wheel(y, direction); f.end(); f.advance(30000);
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
});
