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
  let gesture = null;
  let assisting = null;
  let lastY = view.scrollY;
  let timer = null;
  let touchY = null;
  let touching = false;
  let heldKey = null;
  let disposed = false;
  const blocked = () => disposed || document.hidden || reduced.matches || isBlocked()
    // A clicked header button may retain focus while the next gesture targets
    // the scene. Preserve editing/slider focus; event targets stay excluded.
    || controlled(document.activeElement, FOCUSED_CONTROLS);
  const clearTimer = () => { view.clearTimeout(timer); timer = null; };
  const cancel = () => {
    clearTimer();
    gesture = null;
    if (assisting != null) {
      assisting = null;
      // Abort only our own smooth scroll. Never stop native wheel/touch inertia.
      view.scrollTo({ top: view.scrollY, behavior: "instant" });
    }
    lastY = view.scrollY;
  };
  const settle = () => {
    clearTimer();
    if (assisting != null) { assisting = null; return; }
    if (!gesture?.scrolled || touching || heldKey) return;
    const direction = gesture.direction;
    gesture = null; // One gesture can complete at most one entry.
    if (blocked() || view.scrollY !== lastY) return;
    const { opening, transitions } = getGeometry();
    if (!opening) return;
    const y = view.scrollY;
    const pricing = transitions.find(join => join.to.id === "open-weight");
    if (pricing && y + view.innerHeight >= pricing.to.top) return;
    const leg = (opening.motionTravel - opening.aiHoldTravel) / 2;
    const windows = [
      { from: { id: "hero" }, to: { id: "ai" }, start: opening.top, end: opening.top + leg },
      { from: { id: "ai" }, to: { id: "wearable" }, start: opening.top + leg + opening.aiHoldTravel, end: opening.top + opening.motionTravel },
      ...transitions,
    ];
    const entry = windows.find(({ start, end }) => y >= start && y <= end);
    let target, limit;
    if (entry) {
      if (natural(entry.from.id) || natural(entry.to.id)) return;
      target = direction > 0 ? entry.end : entry.start;
      // Half of the actual handoff must already be traversed. Long preview
      // paces cannot turn this into several screens of automatic movement.
      limit = Math.min(opening.stageHeight * 2, (entry.end - entry.start) * 0.5);
    } else {
      const next = windows.findIndex(window => window.start > y);
      const before = windows[next - 1], after = windows[next];
      if (!before || !after || natural(before.to.id)) return;
      target = direction > 0 ? after.start : before.end;
      // End the current section's presentation at its existing stable pose.
      // Never chain through the following handoff or consume an entire hold.
      limit = Math.min(360, opening.stageHeight * 0.45, (after.start - before.end) * 0.2);
    }
    const distance = (target - y) * direction;
    if (distance <= 1 || distance > limit) return;
    assisting = target;
    view.scrollTo({ top: target, behavior: "smooth" });
  };
  const quiet = () => {
    clearTimer();
    // Older Safari has no reliable end-of-inertia signal. Silence is only a
    // conservative fallback, reset by every scroll/input and never while held.
    if (!hasScrollEnd && !touching && !heldKey && (gesture?.scrolled || assisting != null))
      timer = view.setTimeout(settle, QUIET_MS);
  };
  const intent = (event, direction) => {
    const continued = gesture?.type === event.type && gesture.direction === direction && gesture.scrolled;
    cancel();
    if (!event.isTrusted || event.defaultPrevented || !direction || blocked() || controlled(event.target)) return;
    // A final subpixel packet must not erase actual document movement in this
    // unsettled gesture. Settlement/cancellation still consumes it entirely.
    gesture = { type: event.type, direction, scrolled: Boolean(continued), at: view.performance.now() };
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
  };
  const touchstart = event => {
    cancel();
    touching = event.touches.length > 0;
    touchY = event.isTrusted && event.touches.length === 1 && !blocked() && !controlled(event.target)
      ? event.touches[0].clientY : null;
  };
  const touchmove = event => {
    if (touchY == null || event.touches.length !== 1) { cancel(); touchY = null; return; }
    const y = event.touches[0].clientY;
    intent(event, Math.sign(touchY - y));
    touchY = y;
  };
  const touchend = event => {
    touching = event.touches.length > 0;
    if (!touching) { touchY = null; quiet(); }
  };
  const reset = () => { cancel(); touching = false; touchY = null; heldKey = null; };
  const scroll = event => {
    if (event.target !== document) return;
    const y = view.scrollY, delta = y - lastY;
    lastY = y;
    if (blocked()) { cancel(); return; }
    if (assisting != null) {
      if (Math.abs(y - assisting) <= 1) assisting = null;
      quiet();
      return;
    }
    if (!gesture || !delta) return;
    if (Math.sign(delta) !== gesture.direction
      || (!gesture.scrolled && view.performance.now() - gesture.at > INPUT_MAX_AGE_MS)) {
      cancel();
      return;
    }
    gesture.scrolled = true;
    quiet();
  };
  const scrollend = event => { if (event.target === document) settle(); };
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
  return {
    cancel: reset,
    dispose() {
      reset();
      disposed = true;
      for (const [target, type, handler] of listeners) target.removeEventListener(type, handler, options);
    },
  };
}
