const QUIET_MS = 280;
const INPUT_MAX_AGE_MS = 600;
const FOCUSED_CONTROLS = 'input, select, textarea, video, audio, iframe, dialog, [role="slider"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], [role="dialog"], [aria-modal="true"], [contenteditable]:not([contenteditable="false"])';
const CONTROLS = `a, button, summary, [role="button"], [role="tab"], ${FOCUSED_CONTROLS}`;
const controlled = (target, selector = CONTROLS) => Boolean(target?.closest?.(selector));
const natural = id => id === "open-weight" || id === "footer";

/** Complete the committed end of one authored section or handoff. The caller
 * cancels before any programmatic navigation/layout remap and when UI blocks
 * scrolling. Geometry stays owned by App; this helper has no animation loop.
 */
export function createEntryScrollAssist({ getGeometry, isBlocked }, view = window) {
  const document = view.document;
  const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
  const hasScrollEnd = "onscrollend" in document;
  const diagnostics = new URLSearchParams(view.location?.search || "").get("sceneDiagnostics") === "1";
  let blockedReason = null;
  let gesture = null;
  let assisting = null;
  let lastY = view.scrollY;
  let lastYAt = view.performance.now();
  let timer = null;
  let touchY = null;
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
        eventType: event?.type ?? null, hasScrollEnd, touching, heldKey, touchY,
        gesture: gesture ? { ...gesture } : null, assisting, lastY, currentY: view.scrollY,
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
    gesture = null;
    if (assisting != null) {
      assisting = null;
      // Abort only our own smooth scroll. Never stop native wheel/touch inertia.
      view.scrollTo({ top: view.scrollY, behavior: "instant" });
    }
    lastY = view.scrollY;
    lastYAt = view.performance.now();
  };
  const settle = event => {
    if (diagnostics) report("settle", event, { source: event ? "scrollend" : "quiet-timer" });
    clearTimer();
    if (assisting != null) {
      if (diagnostics) report("settle-return", event, { reason: "assist-settled" });
      assisting = null; return;
    }
    if (!gesture?.scrolled || touching || heldKey) {
      if (diagnostics) report("settle-return", event, { reason: !gesture ? "no-gesture" : !gesture.scrolled ? "no-native-motion" : touching ? "touch-held" : "key-held" });
      return;
    }
    const direction = gesture.direction;
    gesture = null; // One gesture can complete at most one entry.
    if (blocked() || view.scrollY !== lastY) {
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
    const leg = (opening.motionTravel - opening.aiHoldTravel) / 2;
    const windows = [
      { from: { id: "hero" }, to: { id: "ai" }, start: opening.top, end: opening.top + leg },
      { from: { id: "ai" }, to: { id: "wearable" }, start: opening.top + leg + opening.aiHoldTravel, end: opening.top + opening.motionTravel },
      ...transitions,
    ];
    const entry = windows.find(({ start, end }) => y >= start && y <= end);
    let target, limit, phase;
    if (entry) {
      if (diagnostics) phase = { kind: "handoff", from: entry.from.id, to: entry.to.id, start: entry.start, end: entry.end };
      if (natural(entry.from.id) || natural(entry.to.id)) {
        if (diagnostics) report("settle-return", event, { reason: "natural-handoff", phase, direction });
        return;
      }
      target = direction > 0 ? entry.end : entry.start;
      // Half of the actual handoff must already be traversed. Long preview
      // paces cannot turn this into several screens of automatic movement.
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
    const distance = (target - y) * direction;
    if (distance <= 1 || distance > limit) {
      if (diagnostics) report("settle-return", event, { reason: distance <= 1 ? "at-or-past-target" : "outside-completion-range", direction, target, distance, limit, phase, geometry: { ...opening } });
      return;
    }
    if (diagnostics) report("assist-start", event, { direction, target, distance, limit, phase, geometry: { ...opening } });
    assisting = target;
    view.scrollTo({ top: target, behavior: "smooth" });
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
    if (!event.isTrusted || event.defaultPrevented || !direction || blocked() || controlled(event.target)) {
      if (diagnostics) report("intent-rejected", event, { direction, reason: !event.isTrusted ? "untrusted" : event.defaultPrevented ? "default-prevented" : !direction ? "no-scroll-direction" : blockedReason || "control-target" });
      return;
    }
    // A final subpixel packet must not erase actual document movement in this
    // unsettled gesture. Settlement/cancellation still consumes it entirely.
    gesture = { type: event.type, direction, scrolled: Boolean(continued), at: view.performance.now(), pendingScroll };
    if (diagnostics) report("intent-accepted", event, { direction });
    quiet();
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
    if (event.key === heldKey) { heldKey = null; quiet(); }
    if (diagnostics) report("key-release", event);
  };
  const touchstart = event => {
    cancel("touchstart", event);
    touching = event.touches.length > 0;
    touchY = event.isTrusted && event.touches.length === 1 && !blocked() && !controlled(event.target)
      ? event.touches[0].clientY : null;
    if (diagnostics) report("touch-start", event, { accepted: touchY != null, reason: touchY != null ? null : !event.isTrusted ? "untrusted" : event.touches.length !== 1 ? "touch-count" : blockedReason || "control-target" });
  };
  const touchmove = event => {
    if (touchY == null || event.touches.length !== 1) {
      if (diagnostics) report("intent-rejected", event, { reason: touchY == null ? "no-eligible-touch-start" : "touch-count" });
      cancel("invalid-touch-move", event); touchY = null; return;
    }
    const y = event.touches[0].clientY;
    intent(event, Math.sign(touchY - y));
    touchY = y;
  };
  const touchend = event => {
    touching = event.touches.length > 0;
    if (!touching) { touchY = null; quiet(); }
    if (diagnostics) report("touch-release", event);
  };
  const reset = source => { cancel(source); touching = false; touchY = null; heldKey = null; };
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
    if (!gesture || !delta) {
      if (diagnostics) report("scroll-return", event, { reason: !gesture ? "no-gesture" : "zero-delta", delta });
      return;
    }
    if (Math.sign(delta) !== gesture.direction
      || (!gesture.scrolled && view.performance.now() - gesture.at > INPUT_MAX_AGE_MS)) {
      if (diagnostics) report("scroll-cancel", event, { reason: Math.sign(delta) !== gesture.direction ? "reverse-scroll" : "first-scroll-expired", delta, maxAge: INPUT_MAX_AGE_MS });
      cancel("native-scroll-rejected", event);
      return;
    }
    gesture.scrolled = true;
    if (diagnostics) report("scroll-accepted", event, { delta });
    quiet();
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
    [document, "pointerdown", cancel], [document, "click", cancel], [document, "focusin", cancel],
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
