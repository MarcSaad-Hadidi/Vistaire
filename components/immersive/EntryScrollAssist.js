import { CINEMATIC_TIMING, readingTiming } from "./SceneDirector.js";

const QUIET_MS = 280;
// Sustainability's lid reaches its widest keyframe where chapterPhase reaches 1,
// at the end of the chapter's active span (pace scales travel, not this ratio).
const LAPTOP_OPEN = (CINEMATIC_TIMING.sceneScreens - CINEMATIC_TIMING.edgeScreens) / CINEMATIC_TIMING.sceneScreens;
// Reading chapters settle each later option where its card/menu change ends.
const READING_OPTIONS = readingTiming().transitions.map(([, end]) => end);
const INPUT_MAX_AGE_MS = 600;
const STALL_MS = 125;
const FOCUSED_CONTROLS = 'input, select, textarea, video, audio, iframe, dialog, [role="slider"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], [role="dialog"], [aria-modal="true"], [contenteditable]:not([contenteditable="false"])';
const CONTROLS = `a, button, summary, [role="button"], [role="tab"], ${FOCUSED_CONTROLS}`;
// Touch owners keep their own vertical touch handling. Other targets (links,
// buttons, pan-y model surfaces, videos) only arm after native document scroll.
const TOUCH_OWNERS = 'input, select, textarea, iframe, dialog, [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], [role="dialog"], [aria-modal="true"], [contenteditable]:not([contenteditable="false"])';
const controlled = (target, selector = CONTROLS) => Boolean(target?.closest?.(selector));
const natural = id => id === "open-weight" || id === "footer";

/** Integrate smooth velocity ramps around a constant-speed cruise. Distance
 * adds cruise time, not a slower startup. Ramp time is shortened when needed
 * so its area fits the trip with a nonnegative peak at least the seed speed.
 * Velocity and acceleration are continuous at both cruise joins. */
export function createScrollContinuation(from, to, velocity, stageHeight) {
  const distance = Math.abs(to - from), direction = Math.sign(to - from);
  const seed = Math.min(Math.max(0, direction * velocity), stageHeight * 4 / 1000);
  let peak = Math.max(seed, stageHeight * 3 / 1000);
  let ramp = Math.min(120, Math.max(60, distance / peak));
  if (seed > 0) ramp = Math.min(ramp, 2 * distance / (3 * seed));
  // Both ramps cover ramp * (seed/2 + peak). Short trips lower the peak;
  // the seed-derived bound above ensures this never asks for negative speed.
  peak = Math.min(peak, distance / ramp - seed / 2);
  const entryDistance = ramp * (seed + peak) / 2;
  const cruise = Math.max(0, (distance - ramp * (seed / 2 + peak)) / peak);
  const duration = 2 * ramp + cruise;
  const integrated = t => t ** 3 - t ** 4 / 2; // Integral of 3t² - 2t³.
  return {
    duration,
    at(elapsed) {
      if (elapsed <= 0) return from;
      if (elapsed >= duration) return to;
      let position;
      if (elapsed < ramp) {
        position = seed * elapsed + (peak - seed) * ramp * integrated(elapsed / ramp);
      } else if (elapsed < ramp + cruise) {
        position = entryDistance + peak * (elapsed - ramp);
      } else {
        const t = (elapsed - ramp - cruise) / ramp;
        position = entryDistance + peak * cruise + peak * ramp * (t - integrated(t));
      }
      return from + direction * position;
    },
  };
}

/** Complete one adjacent authored navigation reading stop in gesture direction. The caller
 * cancels before any programmatic navigation/layout remap and when UI blocks
 * scrolling. Geometry stays owned by App; one gesture-scoped RAF observes native motion
 * and transfers to one bounded continuation. No idle RAF remains.
 */
export function createEntryScrollAssist({ getGeometry, isBlocked }, view = window) {
  const document = view.document;
  const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
  const hasScrollEnd = "onscrollend" in document;
  const parameters = new URLSearchParams(view.location?.search || "");
  const diagnostics = parameters.get("sceneDiagnostics") === "1";
  const baseline = diagnostics && parameters.get("scrollAssistMode") === "baseline";
  let frame = null;
  let pointerHeld = false;
  let blockedReason = null;
  let gesture = null;
  let assisting = null;
  let lastY = view.scrollY;
  let lastYAt = view.performance.now();
  let timer = null;
  let touchY = null;
  let touchStart = null;
  let touching = false;
  let heldKey = null;
  let disposed = false;
  const report = (type, event, details = {}) => {
    if (!diagnostics || typeof view.__vistaireScrollAssistTrace !== "function") return;
    // The consumer owns bounded retention. Observability must never change the
    // native gesture if an optional diagnostic consumer fails.
    try {
      view.__vistaireScrollAssistTrace({
        type, handledAt: view.performance.now(), eventTimeStamp: event?.timeStamp ?? null,
        eventType: event?.type ?? null, hasScrollEnd, touching, heldKey, touchY, pointerHeld, mode: baseline ? "baseline" : "early",
        gesture: gesture ? { ...gesture } : null,
        assisting: !baseline && assisting != null ? {
          target: assisting.target, started: assisting.started, lastFrameAt: assisting.lastFrameAt,
          expectedY: assisting.expectedY, duration: assisting.curve.duration,
        } : assisting,
        lastY, currentY: view.scrollY,
        age: gesture ? view.performance.now() - gesture.at : null,
        blockedReason, ...details,
      });
    } catch { /* Diagnostics must not affect scrolling. */ }
  };
  const blocked = () => {
    let callerBlocked = false;
    const result = disposed || document.hidden || reduced.matches || (callerBlocked = isBlocked())
      // A clicked header button may retain focus while the next gesture targets
      // the scene. Preserve editing/slider focus; event targets stay excluded.
      || controlled(document.activeElement, FOCUSED_CONTROLS);
    blockedReason = !result ? null : disposed ? "disposed" : document.hidden ? "hidden"
      : reduced.matches ? "reduced-motion" : callerBlocked ? "caller-blocked" : "protected-focus";
    return result;
  };
  const clearTimer = () => { view.clearTimeout(timer); timer = null; };
  const cancel = (source = "caller-cancel", event) => {
    if (diagnostics) report("cancel", event || (typeof source === "object" ? source : null),
      { reason: typeof source === "string" ? source : source?.type || "caller-cancel" });
    clearTimer();
    view.cancelAnimationFrame(frame); frame = null;
    gesture = null;
    if (assisting != null) {
      assisting = null;
      // Abort only our own smooth scroll. Never stop native wheel/touch inertia.
      if (baseline) view.scrollTo({ top: view.scrollY, behavior: "instant" });
    }
    lastY = view.scrollY;
    lastYAt = view.performance.now();
  };
  const animate = () => {
    const deliveredAt = view.performance.now();
    frame = null;
    const active = assisting;
    if (!active) return;
    if (blocked() || touching || heldKey || pointerHeld) { cancel("blocked-continuation"); return; }
    if (Math.abs(view.scrollY - active.expectedY) > 1) { cancel("foreign-scroll"); return; }
    const gap = deliveredAt - active.lastFrameAt;
    active.lastFrameAt = deliveredAt;
    // Slow but steady frames (heavy transitions measured at 83-104ms on an
    // integrated GPU) follow wall time, so the trip keeps its authored duration.
    // A real stall rebases without a write; persistent stalls advance one
    // bounded logical frame. Never catch up by time that rendered no frames.
    const step = gap > STALL_MS ? (active.paused ? 16 : 0) : Math.max(0, gap);
    active.paused = gap > STALL_MS;
    if (active.paused && diagnostics) report("continuation-paused", null,
      { gap, elapsed: active.elapsed, logicalStep: step, target: active.target });
    if (!step) { frame = view.requestAnimationFrame(animate); return; }
    const elapsed = active.elapsed += step;
    view.scrollTo({ top: active.curve.at(elapsed), behavior: "instant" });
    active.expectedY = lastY = view.scrollY;
    lastYAt = deliveredAt;
    if (elapsed >= active.curve.duration) {
      assisting = null;
      if (diagnostics) report("completed", null, { target: active.target, duration: elapsed });
    } else frame = view.requestAnimationFrame(animate);
  };
  const watch = () => {
    // Position is read at callback delivery, which may lag the rAF timestamp.
    const now = view.performance.now();
    frame = null;
    const current = gesture;
    if (!current?.scrolled || assisting != null) return;
    if (blocked()) { cancel("blocked-observer"); return; }
    const y = view.scrollY, dt = now - current.sampleAt, delta = y - current.sampleY;
    if (dt < 8 || dt > 50) {
      // A long main-thread pause is not stationary/decelerating native evidence.
      current.velocity = 0; current.decelerationSamples = 0; current.stationaryFrames = 0;
      current.lastMotionAt = now;
    } else if (delta) {
      if (Math.sign(delta) !== current.direction) { cancel("reverse-observed-motion"); return; }
      const velocity = delta / dt;
      current.decelerationSamples = Math.abs(velocity) < Math.abs(current.velocity)
        ? current.decelerationSamples + 1 : 0;
      current.velocity = velocity;
      current.stationaryFrames = 0; current.lastMotionAt = now;
      if (y !== lastY) current.nativeEnded = false;
    } else current.stationaryFrames++;
    current.sampleY = y; current.sampleAt = now;
    const released = !touching && !heldKey && !pointerHeld && now - current.at >= 40;
    if (released && current.nativeEnded) { settle(null, "scrollend"); return; }
    if (released && current.decelerationSamples >= 2 && Math.abs(current.velocity) <= 0.15
      && current.stationaryFrames >= 2 && now - current.lastMotionAt >= 32
      && now - current.lastMotionAt <= 80 && y === lastY) {
      settle(null, "deceleration"); return;
    }
    // Bounded observation only. Long native inertia can still finish via the
    // actual scrollend or the conservative unsupported-browser fallback.
    if (now - current.at < 2000) frame = view.requestAnimationFrame(watch);
  };
  const observe = () => {
    if (baseline || frame != null || assisting != null || !gesture?.scrolled) return;
    const pricing = getGeometry().transitions.find(join => join.to.id === "open-weight");
    if (pricing && view.scrollY + view.innerHeight >= pricing.to.top) return;
    if (gesture.sampleAt == null) {
      gesture.sampleAt = view.performance.now(); gesture.sampleY = view.scrollY;
      gesture.velocity = 0; gesture.decelerationSamples = 0;
      gesture.stationaryFrames = 0; gesture.lastMotionAt = gesture.sampleAt;
    }
    frame = view.requestAnimationFrame(watch);
  };
  const settle = (event, source = event ? "scrollend" : "quiet-timer") => {
    if (diagnostics) report("settle", event, { source });
    clearTimer();
    if (assisting != null) {
      if (diagnostics) report("settle-return", event, { reason: baseline ? "assist-settled" : "own-scrollend" });
      if (baseline) assisting = null;
      return;
    }
    if (!baseline && gesture?.scrolled && source === "scrollend") {
      gesture.nativeEnded = true;
      if (touching || heldKey || pointerHeld || view.performance.now() - gesture.at < 40) {
        if (diagnostics) report("settle-return", event, { reason: "await-input-release" });
        observe(); return;
      }
    }
    if (!gesture?.scrolled || touching || heldKey) {
      if (diagnostics) report("settle-return", event, { reason: !gesture ? "no-gesture" : !gesture.scrolled ? "no-native-motion" : touching ? "touch-held" : "key-held" });
      return;
    }
    const motion = gesture;
    const direction = gesture.direction;
    gesture = null;
    view.cancelAnimationFrame(frame); frame = null; // One gesture can complete at most one entry.
    if (blocked() || (!baseline && pointerHeld) || view.scrollY !== lastY) {
      if (diagnostics) report("settle-return", event, { reason: blockedReason || "position-changed-without-scroll", direction });
      return;
    }
    const { opening, transitions } = getGeometry();
    if (!opening) {
      if (diagnostics) report("settle-return", event, { reason: "missing-opening", direction });
      return;
    }
    const y = view.scrollY;
    const pricing = transitions.find(join => join.to.id === "open-weight");
    if (pricing && y + view.innerHeight >= pricing.to.top) {
      if (diagnostics) report("settle-return", event, { reason: "pricing-visible", direction, pricingTop: pricing.to.top, viewportHeight: view.innerHeight });
      return;
    }
    let target, limit = null, phase;
    if (!baseline) {
      // Match App's authored navigation anchors, including AI's hold midpoint.
      // External navigation poses are the measured incoming handoff ends.
      const stops = [
        { id: "hero", y: opening.top },
        { id: "ai", y: opening.top + opening.motionTravel / 2 },
        { id: "wearable", y: opening.top + opening.motionTravel },
        ...transitions.filter(join => !natural(join.from.id) && !natural(join.to.id))
          .flatMap(join => [
            // Internal stable poses are their own stops, so one gesture never
            // skips the open laptop or a detail/menu option to the next chapter.
            ...(join.from.id === "sustainability" ? [LAPTOP_OPEN]
              : join.from.id === "features" || join.from.id === "social-content" ? READING_OPTIONS : [])
              .map((progress, index) => ({ id: `${join.from.id}-${index + 1}`, y: join.from.top + join.from.travel * progress })),
            { id: join.to.id, y: join.end },
          ]),
      ];
      const destination = direction > 0 ? stops.find(stop => stop.y > y)
        : stops.findLast(stop => stop.y < y);
      if (!destination) {
        if (diagnostics) report("settle-return", event, { reason: "no-adjacent-reading-stop", direction });
        return;
      }
      target = destination.y;
      if (diagnostics) phase = { kind: "reading-stop", id: destination.id, target };
    } else {
      const leg = (opening.motionTravel - opening.aiHoldTravel) / 2;
      const windows = [
        { from: { id: "hero" }, to: { id: "ai" }, start: opening.top, end: opening.top + leg },
        { from: { id: "ai" }, to: { id: "wearable" }, start: opening.top + leg + opening.aiHoldTravel, end: opening.top + opening.motionTravel },
        ...transitions,
      ];
      const entry = windows.find(({ start, end }) => y >= start && y <= end);
      if (entry) {
        if (diagnostics) phase = { kind: "handoff", from: entry.from.id, to: entry.to.id, start: entry.start, end: entry.end };
        if (natural(entry.from.id) || natural(entry.to.id)) {
          if (diagnostics) report("settle-return", event, { reason: "natural-handoff", phase, direction });
          return;
        }
        target = direction > 0 ? entry.end : entry.start;
        limit = Math.min(opening.stageHeight * 2, (entry.end - entry.start) * 0.5);
      } else {
        const next = windows.findIndex(window => window.start > y);
        const before = windows[next - 1], after = windows[next];
        if (!before || !after || natural(before.to.id)) {
          if (diagnostics) report("settle-return", event, { reason: !before ? "missing-previous-handoff" : !after ? "missing-next-handoff" : "natural-section", direction, before: before ? { id: before.to.id, end: before.end } : null, after: after ? { id: after.from.id, start: after.start } : null });
          return;
        }
        if (diagnostics) phase = { kind: "section-ending", id: before.to.id, start: before.end, end: after.start };
        target = direction > 0 ? after.start : before.end;
        // End the current section's presentation at its existing stable pose.
        // Never chain through the following handoff or consume an entire hold.
        limit = Math.min(360, opening.stageHeight * 0.45, (after.start - before.end) * 0.2);
      }
    }
    const distance = (target - y) * direction;
    if (baseline && (distance <= 1 || distance > limit)) {
      if (diagnostics) report("settle-return", event, { reason: distance <= 1 ? "at-or-past-target" : "outside-completion-range", direction, target, distance, limit, phase, geometry: { ...opening } });
      return;
    }
    if (diagnostics) report("assist-start", event, { direction, target, distance, limit, phase, geometry: { ...opening } });
    if (baseline) {
      assisting = target;
      view.scrollTo({ top: target, behavior: "smooth" });
    } else {
      const now = view.performance.now(), sampleAge = now - (motion.lastMotionAt ?? now);
      const velocity = (motion.velocity || 0) * Math.max(0, 1 - sampleAge / 80);
      const curve = createScrollContinuation(y, target, velocity, opening.stageHeight);
      assisting = { target, curve, started: now, lastFrameAt: now, elapsed: 0, expectedY: y };
      if (diagnostics) report("handoff", event, { source, target, velocity, sampleAge, duration: curve.duration,
        stationaryMs: sampleAge, stationaryFrames: motion.stationaryFrames || 0,
        inputQuietMs: now - motion.at, decelerationSamples: motion.decelerationSamples || 0 });
      frame = view.requestAnimationFrame(animate);
    }
  };
  const quiet = () => {
    clearTimer();
    // Older Safari has no reliable end-of-inertia signal. Silence is only a
    // conservative fallback, reset by every scroll/input and never while held.
    if (!hasScrollEnd && !touching && !heldKey && (gesture?.scrolled || assisting != null))
      timer = view.setTimeout(settle, QUIET_MS);
    if (diagnostics) report("quiet", null, { scheduled: timer != null, delay: timer != null ? QUIET_MS : null,
      reason: hasScrollEnd ? "native-scrollend-owner" : touching ? "touch-held" : heldKey ? "key-held" : timer != null ? "fallback-armed" : "no-observed-motion" });
  };
  const intent = (event, direction) => {
    const sameInput = gesture?.type === event.type && gesture.direction === direction;
    const previous = sameInput ? gesture : null;
    const continued = sameInput && gesture.scrolled;
    // Passive wheel delivery can follow compositor movement. Preserve only a
    // matching, post-observation difference; do not call it native motion until
    // its ordered document scroll arrives. Never borrow our own active scroll.
    const pendingScroll = (sameInput && gesture.pendingScroll) || (!continued && event.type === "wheel" && assisting == null
      && (!gesture || sameInput)
      && Number.isFinite(event.timeStamp) && event.timeStamp >= lastYAt && event.timeStamp <= view.performance.now()
      && Math.sign(view.scrollY - lastY) === direction
      ? { delta: view.scrollY - lastY, inputAt: event.timeStamp } : null);
    if (diagnostics) report("intent", event, { direction, continued: Boolean(continued), trusted: event.isTrusted, defaultPrevented: event.defaultPrevented });
    cancel("new-input", event);
    if (!event.isTrusted || event.defaultPrevented || !direction || blocked()
      || controlled(event.target, event.type === "touchmove" ? TOUCH_OWNERS : CONTROLS)) {
      if (diagnostics) report("intent-rejected", event, { direction, reason: !event.isTrusted ? "untrusted" : event.defaultPrevented ? "default-prevented" : !direction ? "no-scroll-direction" : blockedReason || "control-target" });
      return;
    }
    // A final subpixel packet must not erase actual document movement in this
    // unsettled gesture. Settlement/cancellation still consumes it entirely.
    gesture = !baseline && previous ? previous : { type: event.type, direction, scrolled: Boolean(continued) };
    // A continuing gesture keeps its first input time; a touch gesture starts at
    // touchstart because coalesced native scroll can be stamped before a later
    // touchmove, or arrive before the first touchmove at all.
    gesture.at = view.performance.now(); gesture.pendingScroll = pendingScroll;
    gesture.inputAt = !baseline && previous ? previous.inputAt
      : !baseline && event.type === "touchmove" && touchStart ? touchStart.since : event.timeStamp;
    if (!baseline) {
      gesture.nativeEnded = false;
      if (event.type === "touchmove" && touchStart) {
        // Only trusted document scroll observed since this intent began counts as
        // its native motion. Each touchmove consumes that evidence, so a reversal
        // or an older scroll can never be reused by a later direction.
        if (!previous && Math.sign(touchStart.motion) === direction) gesture.scrolled = true;
        touchStart.motion = 0; touchStart.since = event.timeStamp;
      }
    }
    if (diagnostics) report("intent-accepted", event, { direction });
    quiet(); observe();
  };
  const wheel = event => {
    intent(event, !event.ctrlKey && Math.abs(event.deltaY) > Math.abs(event.deltaX || 0)
      ? Math.sign(event.deltaY) : 0);
  };
  const keydown = event => {
    const direction = event.key === "ArrowDown" || event.key === "PageDown" ? 1
      : event.key === "ArrowUp" || event.key === "PageUp" ? -1
        : event.key === " " ? (event.shiftKey ? -1 : 1) : 0;
    intent(event, !event.ctrlKey && !event.metaKey && !event.altKey ? direction : 0);
    heldKey = gesture ? event.key : null;
  };
  const keyup = event => {
    if (event.key === heldKey) {
      heldKey = null;
      if (!baseline && gesture) gesture.at = view.performance.now();
      quiet(); observe();
    }
    if (diagnostics) report("key-release", event);
  };
  const touchstart = event => {
    cancel("touchstart", event);
    touching = event.touches.length > 0;
    // A pan that starts on a link or button is still a page scroll; a tap never
    // scrolls, so it cannot arm assistance. Fields, menus and dialogs own touch.
    touchY = event.isTrusted && event.touches.length === 1 && !blocked() && !controlled(event.target, TOUCH_OWNERS)
      ? event.touches[0].clientY : null;
    // Native scroll may arrive before the first touchmove; `scroll` records it
    // only when trusted and stamped after the intent it would support.
    touchStart = touchY != null ? { since: event.timeStamp, motion: 0 } : null;
    if (diagnostics) report("touch-start", event, { accepted: touchY != null, reason: touchY != null ? null : !event.isTrusted ? "untrusted" : event.touches.length !== 1 ? "touch-count" : blockedReason || "control-target" });
  };
  const touchmove = event => {
    if (touchY == null || event.touches.length !== 1) {
      if (diagnostics) report("intent-rejected", event, { reason: touchY == null ? "no-eligible-touch-start" : "touch-count" });
      cancel("invalid-touch-move", event); touchY = null; return;
    }
    const y = event.touches[0].clientY;
    // A packet without vertical change carries no new intent; it must not
    // erase the gesture (horizontal jitter, duplicate coalesced packets).
    if (y === touchY && !baseline) {
      if (diagnostics) report("touch-still", event);
      return;
    }
    intent(event, Math.sign(touchY - y));
    touchY = y;
  };
  const touchend = event => {
    touching = event.touches.length > 0;
    if (!touching) {
      touchY = null; touchStart = null;
      if (!baseline && gesture) gesture.at = view.performance.now();
      quiet(); observe();
    }
    if (diagnostics) report("touch-release", event);
  };
  const reset = source => { cancel(source); touching = false; touchY = null; touchStart = null; heldKey = null; pointerHeld = false; };
  const pointerdown = event => { pointerHeld = true; cancel(event); };
  const pointerup = () => {
    pointerHeld = false;
    if (!baseline && gesture) gesture.at = view.performance.now();
    observe();
  };
  const pointercancel = event => {
    pointerHeld = false;
    // UA panning may suppress Pointer Events while an independently observed
    // Touch Events gesture continues. Only touchcancel terminates that stream.
    if (baseline || (event.pointerType === "touch" && touching && touchY != null && assisting == null)) {
      if (diagnostics) report("pointer-release", event, { reason: "pointer-stream-cancelled" });
      return;
    }
    reset(event);
  };
  const scroll = event => {
    if (event.target !== document) {
      if (diagnostics) report("scroll-return", event, { reason: "nested-scroller" });
      return;
    }
    const y = view.scrollY;
    let delta = y - lastY;
    if (diagnostics) report("scroll", event, { delta });
    lastY = y;
    lastYAt = view.performance.now();
    if (blocked()) {
      if (diagnostics) report("scroll-cancel", event, { reason: blockedReason, delta });
      cancel("scroll-blocked", event); return;
    }
    if (assisting != null) {
      if (!baseline) {
        if (Math.abs(y - assisting.expectedY) > 1) cancel("foreign-scroll");
        return;
      }
      if (diagnostics) report("scroll-return", event, { reason: "assisting", delta, reachedTarget: Math.abs(y - assisting) <= 1 });
      if (Math.abs(y - assisting) <= 1) assisting = null;
      quiet();
      return;
    }
    if (gesture?.pendingScroll) {
      const pending = gesture.pendingScroll;
      gesture.pendingScroll = null; // One event can corroborate it; never replay it.
      const confirmed = !delta && event.isTrusted && Number.isFinite(event.timeStamp)
        && event.timeStamp >= pending.inputAt && event.timeStamp <= view.performance.now();
      if (confirmed) delta = pending.delta;
      if (diagnostics) report("pending-scroll", event, { confirmed, pending, delta });
    }
    if (!gesture && delta && touching && touchStart && event.isTrusted && Number.isFinite(event.timeStamp)
      && event.timeStamp >= touchStart.since && event.timeStamp <= view.performance.now()) touchStart.motion += delta;
    if (!gesture || !delta) {
      if (diagnostics) report("scroll-return", event, { reason: !gesture ? "no-gesture" : "zero-delta", delta });
      return;
    }
    const invalidFirst = !baseline && !gesture.scrolled && (!event.isTrusted
      || !Number.isFinite(event.timeStamp) || event.timeStamp < gesture.inputAt || event.timeStamp > view.performance.now());
    if (Math.sign(delta) !== gesture.direction || invalidFirst
      || (baseline && !gesture.scrolled && view.performance.now() - gesture.at > INPUT_MAX_AGE_MS)) {
      if (diagnostics) report("scroll-cancel", event, { reason: Math.sign(delta) !== gesture.direction ? "reverse-scroll"
        : invalidFirst ? "first-scroll-unconfirmed" : "first-scroll-expired", delta, maxAge: baseline ? INPUT_MAX_AGE_MS : null });
      cancel("native-scroll-rejected", event);
      return;
    }
    gesture.scrolled = true;
    if (!baseline) gesture.nativeEnded = false;
    if (diagnostics) report("scroll-accepted", event, { delta });
    quiet(); observe();
  };
  const scrollend = event => {
    if (diagnostics) report("scrollend", event, { documentScroll: event.target === document });
    if (event.target === document) settle(event);
  };
  const listeners = [
    [view, "scroll", scroll], [document, "scrollend", scrollend],
    [document, "wheel", wheel], [document, "keydown", keydown], [document, "keyup", keyup],
    [document, "touchstart", touchstart], [document, "touchmove", touchmove],
    [document, "touchend", touchend], [document, "touchcancel", reset],
    [document, "pointerdown", pointerdown], [document, "pointerup", pointerup], [document, "pointercancel", pointercancel],
    [document, "click", cancel], [document, "focusin", cancel],
    [document, "visibilitychange", reset], [view, "hashchange", reset],
    [view, "blur", reset], [reduced, "change", reset],
  ];
  const options = { passive: true, capture: true };
  for (const [target, type, handler] of listeners) target.addEventListener(type, handler, options);
  if (diagnostics) report("installed", null);
  return {
    cancel: reset,
    dispose() {
      reset("dispose");
      disposed = true;
      for (const [target, type, handler] of listeners) target.removeEventListener(type, handler, options);
    },
  };
}
