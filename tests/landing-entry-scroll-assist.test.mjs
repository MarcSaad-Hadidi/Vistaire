import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { scaledCinematicTiming, measureChapterTransitions } from '../components/immersive/SceneDirector.js';

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

function fixture({ scrollend = true, stageHeight = 844, pace = 1 } = {}) {
  assert.equal(typeof createEntryScrollAssist, 'function', 'the entry assist helper must exist');
  const listeners = new Map(), timers = new Map(), calls = [];
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
    performance: { now: () => clock }, matchMedia: () => media,
    setTimeout(callback, delay) { timers.set(++timerId, { callback, at: clock + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    scrollTo(options) { calls.push(options); },
  };
  const bounds = geometry(stageHeight, pace);
  const assist = createEntryScrollAssist({ getGeometry: () => bounds, isBlocked: () => blocked }, view);
  const emit = (object, type, extra = {}) => {
    const event = { type, target, isTrusted: true, defaultPrevented: false, ...extra };
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
      const [id, timer] = next; timers.delete(id); clock = timer.at; timer.callback();
    }
    clock = until;
  };
  return { assist, bounds, view, document, media, target, calls, input, move, wheel, end, advance, timers, listeners, emit, block: value => { blocked = value; } };
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
