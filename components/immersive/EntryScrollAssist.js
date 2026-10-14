import { CINEMATIC_TIMING, cinematicEase, readingTiming } from "./SceneDirector.js";

const RELEASE_MS = 40;
const QUIET_MS = 280;
// Sustainability's lid reaches its widest keyframe where chapterPhase reaches 1,
// at the end of the chapter's active span (pace scales travel, not this ratio).
const LAPTOP_OPEN = (CINEMATIC_TIMING.sceneScreens - CINEMATIC_TIMING.edgeScreens) / CINEMATIC_TIMING.sceneScreens;
// Reading chapters settle each later option where its card/menu change ends.
const READING_OPTIONS = readingTiming().transitions.map(([, end]) => end);
const FOCUSED_CONTROLS = 'input, select, textarea, video, audio, iframe, dialog, [role="slider"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], [role="dialog"], [aria-modal="true"], [contenteditable]:not([contenteditable="false"])';
const CONTROLS = `a, button, summary, [role="button"], [role="tab"], ${FOCUSED_CONTROLS}`;
// Touch owners keep their own vertical touch handling. Other targets (links,
// buttons, pan-y model surfaces, videos) only arm after native document scroll.
const TOUCH_OWNERS = 'input, select, textarea, iframe, dialog, [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], [role="dialog"], [aria-modal="true"], [contenteditable]:not([contenteditable="false"])';
const controlled = (target, selector = CONTROLS) => Boolean(target?.closest?.(selector));
// A released touch leaves at its native speed: f(0)=0, f(1)=1, f'(0)=slope.
// Up to slope 4 the added term keeps cinematicEase monotonic (no overshoot).
const launchEase = (progress, slope) => cinematicEase(progress) + Math.min(4, slope) * progress * (1 - progress) ** 3;
// Programmatic scroll normally stops iOS momentum; positions still ahead of the
// written pose after this window mean it survived, so native inertia keeps it.
const MOMENTUM_PROOF_MS = 100;
// Wheel packets closer than this belong to one swipe or its trackpad inertia.
const WHEEL_GAP_MS = 180;
// Safari applies a write 25-47ms later; momentum keeps moving until then.
// Released trips write that far ahead so the landing pose is never behind it.
const APPLY_LEAD_MS = 48;
// A drag this far and mostly sideways rotates a 3D model, not the page.
const HORIZONTAL_PX = 12;
const natural = id => id === "open-weight" || id === "footer";

/** Complete one adjacent reading stop: at touch release, else after native momentum ends.
 * One RAF owns the continuation; the caller cancels before programmatic
 * navigation/layout remaps and while UI blocks scrolling. No idle RAF remains.
 */
export function createEntryScrollAssist({ getGeometry, isBlocked }, view = window) {
  const document = view.document;
  const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = view.matchMedia("(hover: hover) and (pointer: fine)");
  const hasScrollEnd = "onscrollend" in document;
  const diagnostics = new URLSearchParams(view.location?.search || "").get("sceneDiagnostics") === "1"
    || typeof view.__vistaireScrollAssistTrace === "function";
  let pointerHeld = false;
  let blockedReason = null;
  let gesture = null;
  let assisting = null;
  let lastY = view.scrollY;
  let lastYAt = view.performance.now();
  let velocity = 0;
  let timer = null;
  let frame = null;
  let nativeEnd = null;
  let touchY = null;
  let touchStart = null;
  let touchOrigin = null;
  let writes = [];
  // Native momentum of an offer-reading gesture stops at the first/last offer.
  let readingGuard = null;
  let touching = false;
  let heldKey = null;
  let disposed = false;
  let inputKind = null;
  const report = (type, event, details = {}) => {
    if (!diagnostics || typeof view.__vistaireScrollAssistTrace !== "function") return;
    try {
      view.__vistaireScrollAssistTrace({
        type, handledAt: view.performance.now(), eventTimeStamp: event?.timeStamp ?? null,
        eventType: event?.type ?? null, hasScrollEnd, touching, heldKey, touchY, pointerHeld, mode: "controlled",
        gesture: gesture ? { ...gesture } : null,
        assisting: assisting ? { ...assisting } : null,
        lastY, currentY: view.scrollY,
        age: gesture ? view.performance.now() - gesture.at : null,
        blockedReason, ...details,
      });
    } catch { /* Diagnostics must not affect scrolling. */ }
  };
  const blocked = () => {
    let callerBlocked = false;
    // Visibility changes reset ownership (listener below); a page reporting
    // hidden while it is shown (app panes, in-app browsers) keeps its assist.
    const result = disposed || reduced.matches || (callerBlocked = isBlocked())
      // A clicked header button may retain focus while the next gesture targets
      // the scene. Preserve editing/slider focus; event targets stay excluded.
      // Tapping or mouse-turning a 3D model focuses its slider; that focus only
      // owns arrow keys. Touch and wheel defer to editing focus alone.
      || controlled(document.activeElement, inputKind === "touch" || inputKind === "wheel" ? TOUCH_OWNERS : FOCUSED_CONTROLS);
    blockedReason = !result ? null : disposed ? "disposed"
      : reduced.matches ? "reduced-motion" : callerBlocked ? "caller-blocked" : "protected-focus";
    return result;
  };
  const clearTimer = () => { view.clearTimeout(timer); timer = null; };
  const cancel = (source = "caller-cancel", event) => {
    if (diagnostics) report("cancel", event || (typeof source === "object" ? source : null),
      { reason: typeof source === "string" ? source : source?.type || "caller-cancel" });
    clearTimer();
    view.cancelAnimationFrame(frame); frame = null;
    gesture = null; nativeEnd = null; assisting = null;
    // A new contact keeps the visible native pose. Reading scrollY here and
    // writing it back can reset a compositor position that has advanced ahead.
  };
  const complete = event => {
    if (!assisting || assisting.elapsed + assisting.lead < assisting.duration || view.scrollY !== assisting.lastY
      || Math.abs(assisting.lastY - assisting.target) > 1) return;
    const { target, started } = assisting;
    view.cancelAnimationFrame(frame); frame = null; assisting = null;
    if (diagnostics) report("completed", event, { target, duration: view.performance.now() - started });
  };
  const animate = now => {
    frame = null;
    const active = assisting;
    if (!active) return;
    if (blocked()) { cancel("blocked-animation"); return; }
    // Ordinary slow frames retain their elapsed time. A long main-thread stall
    // cannot jump through the whole remaining scene on the next delivered frame.
    active.elapsed += Math.min(125, Math.max(0, now - active.frameAt));
    active.frameAt = now;
    const progress = Math.min(1, (active.elapsed + active.lead) / active.duration);
    // Never write behind a native position observed ahead of the curve.
    const curve = active.from + (active.target - active.from) * launchEase(progress, active.slope);
    const y = active.direction > 0 ? Math.max(curve, active.lastY) : Math.min(curve, active.lastY);
    active.written = y;
    writes = [...writes.slice(-3), y];
    if (diagnostics) report("assist-write", null, { y, progress });
    view.scrollTo({ top: y, behavior: "instant" });
    // Immediate scrollTo readback is not a native position observation. Only
    // document scroll events update lastY, including harmless repeated poses.
    if (assisting !== active) return;
    if (progress < 1) frame = view.requestAnimationFrame(animate);
    else complete(null); // A rounded final no-op may have no further scroll event.
  };
  // A released touch hands off at once instead of waiting for native inertia.
  const released = () => gesture?.type === "touchmove";
  const settle = (event, source = released() ? "release" : hasScrollEnd ? "scrollend" : "quiet-fallback") => {
    clearTimer();
    if (diagnostics) report("settle", event, { source });
    if (assisting) return;
    if (!gesture?.scrolled || touching || heldKey || pointerHeld) {
      if (diagnostics) report("settle-return", event, { reason: !gesture ? "no-gesture" : !gesture.scrolled ? "no-native-motion" : touching ? "touch-held" : heldKey ? "key-held" : "pointer-held" });
      return;
    }
    if (view.performance.now() - gesture.at < RELEASE_MS) { schedule(); return; }
    if (blocked()) { cancel("blocked-handoff", event); return; }
    // WebKit may expose a new compositor position before its document scroll.
    // Preserve the gesture until that event corroborates the current position.
    if (gesture.pendingScroll || view.scrollY !== lastY) {
      if (diagnostics) report("settle-return", event, { reason: "await-native-scroll" });
      return;
    }
    if (hasScrollEnd && !released() && (!nativeEnd || nativeEnd.y !== lastY)) {
      if (diagnostics) report("settle-return", event, { reason: "await-native-end" });
      return;
    }
    const { at, inputY } = gesture;
    let { direction } = gesture;
    const early = released();
    gesture = null; nativeEnd = null; // One gesture owns one destination and cannot chain.
    const y = view.scrollY;
    const plan = route(y, inputY ?? y, direction);
    if (plan.native) {
      const { reading, naturalFrom } = plan;
      if (reading && y > reading.start - 1 && y < reading.end + 1) readingGuard = { start: reading.start, end: reading.end };
      // A fling up out of a page's guide/FAQ stops at the guide's head instead
      // of racing through several chapters; the next gesture returns one chapter.
      else if (naturalFrom != null && direction < 0 && y > naturalFrom + 1) readingGuard = { start: naturalFrom, end: Infinity };
      if (diagnostics) report("settle-return", event, { reason: "pricing-reading", direction });
      return;
    }
    if (!plan.destination) {
      if (diagnostics) report("settle-return", event, { reason: "no-adjacent-reading-stop", direction });
      return;
    }
    travel(event, source, plan.destination, plan.opening, y, direction, early, at);
  };
  // One destination rule for touch, wheel/trackpad, keys and idle returns.
  const route = (y, origin, direction) => {
    const { opening, transitions, pricing: reading, naturalFrom } = getGeometry();
    if (!opening) return {};
    // The collection stops on the pricing phone with its first offer. Offers
    // scroll natively but stop at the first and last offer; only a gesture
    // from rest on that edge continues (FAQ forward, collection backward).
    const pricing = reading?.start ?? transitions.find(join => join.to.id === "open-weight")?.end;
    let exit = null, native = false;
    if (reading) {
      const { start, end, faq } = reading, edge = (value, at) => Math.abs(value - at) <= 1;
      if ((origin > start + 1 && origin < end - 1) || (edge(origin, start) && direction > 0) || (edge(origin, end) && direction < 0)) {
        if (y > end + 1) exit = { id: "pricing-end", y: end };
        else if (y < start - 1) exit = { id: "open-weight", y: start };
        else native = true;
      } else if (y > start + 1) {
        if (direction > 0 && y >= end - 1 && y < faq - 1) exit = { id: "faq", y: faq };
        else if (direction < 0 && y > end + 1 && y <= faq + 1) exit = { id: "pricing-end", y: end };
        else if (!direction && y > end + 1 && y < faq - 1)
          exit = y - end < faq - y ? { id: "pricing-end", y: end } : { id: "faq", y: faq };
        else native = true;
      }
    } else native = pricing != null && y > pricing + 1;
    // Pages end with free reading (guide, FAQ, footer): no stop below it.
    if (naturalFrom != null && y > naturalFrom + 1) native = true;
    if (native) return { native: true, reading, naturalFrom };
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
      ...(pricing != null ? [{ id: "open-weight", y: pricing }] : []),
      // A page's free reading starts with one more stop: the guide's head.
      ...(naturalFrom != null ? [{ id: "natural", y: naturalFrom }] : []),
    ];
    const nearest = !direction && stops.reduce((best, stop) => Math.abs(stop.y - y) < Math.abs(best.y - y) ? stop : best);
    // Within 1px a stop is reached: 1x displays round scrollY below fractional stops.
    const destination = exit || (direction > 0 ? stops.find(stop => stop.y > y + 1)
      : direction < 0 ? stops.findLast(stop => stop.y < y - 1)
        : Math.abs(nearest.y - y) > 1 ? nearest : null);
    return { destination, opening };
  };
  const travel = (event, source, destination, opening, y, direction, early, at) => {
    const target = destination.y;
    // The trip travels toward its stop (an idle return or an offer-edge return
    // can run against the gesture's own direction).
    direction = Math.sign(target - y) || direction;
    const phase = diagnostics ? { kind: "reading-stop", id: destination.id, target } : undefined;

    const now = view.performance.now();
    // A full-scene join (over 6 stages, e.g. signature to angles or collection
    // to pricing) is one continuous move, so it travels faster than the cap.
    const stages = Math.abs(target - y) / opening.stageHeight;
    const duration = stages > 6 ? 1400 : Math.min(2000, Math.max(1000, 500 * stages));
    const speed = now - lastYAt < MOMENTUM_PROOF_MS ? Math.max(0, velocity * direction) : 0;
    readingGuard = null;
    assisting = { target, started: now, direction, lastY: y, from: y, duration, elapsed: 0, frameAt: now,
      written: y, slope: early ? speed * duration / Math.abs(target - y) : 0, early, lead: early ? APPLY_LEAD_MS : 0 };
    writes = [];
    if (diagnostics) {
      report("assist-start", event, { direction, target, duration, distance: (target - y) * direction, phase, geometry: { ...opening } });
      report("handoff", event, { source, target, inputQuietMs: now - at });
    }
    frame = view.requestAnimationFrame(animate);
  };
  const schedule = () => {
    clearTimer();
    if (!gesture?.scrolled || assisting || touching || heldKey || pointerHeld || (hasScrollEnd && !nativeEnd && !released())) return;
    const quick = hasScrollEnd || released();
    const quietSince = quick ? gesture.at : Math.max(gesture.at, lastYAt);
    const remaining = Math.max(0, (quick ? RELEASE_MS : QUIET_MS) - (view.performance.now() - quietSince));
    timer = view.setTimeout(() => settle(), remaining);
  };
  const intent = (event, direction) => {
    const sameInput = gesture?.type === event.type && gesture.direction === direction;
    const previous = sameInput ? gesture : null;
    const continued = sameInput && gesture.scrolled;
    // Passive input can follow compositor movement. Preserve only a matching
    // difference until its trusted document scroll arrives. A touch scroll may
    // be stamped before its coalesced touchmove, but never before this gesture.
    const touchInput = event.type === "touchmove" && touchStart;
    const inputAt = touchInput ? previous?.inputAt ?? touchStart.since : event.timeStamp;
    const pendingScroll = (sameInput && gesture.pendingScroll) || ((event.type === "wheel" || touchInput) && assisting == null
      && (!gesture || sameInput)
      && Number.isFinite(event.timeStamp) && event.timeStamp >= (touchInput ? touchStart.since : lastYAt) && event.timeStamp <= view.performance.now()
      && Math.sign(view.scrollY - lastY) === direction
      ? { delta: view.scrollY - lastY, inputAt } : null);
    inputKind = event.type === "touchmove" ? "touch" : event.type;
    if (diagnostics) report("intent", event, { direction, continued: Boolean(continued), trusted: event.isTrusted, defaultPrevented: event.defaultPrevented });
    cancel("new-input", event);
    if (!event.isTrusted || event.defaultPrevented || !direction || blocked()
      || controlled(event.target, event.type === "touchmove" ? TOUCH_OWNERS : CONTROLS)) {
      if (diagnostics) report("intent-rejected", event, { direction, reason: !event.isTrusted ? "untrusted" : event.defaultPrevented ? "default-prevented" : !direction ? "no-scroll-direction" : blockedReason || "control-target" });
      return;
    }
    // A final subpixel packet must not erase actual document movement in this
    // unsettled gesture. Settlement/cancellation still consumes it entirely.
    gesture = previous || { type: event.type, direction, scrolled: Boolean(continued), inputY: view.scrollY };
    // A continuing gesture keeps its first input time; a touch gesture starts at
    // touchstart because coalesced native scroll can be stamped before a later
    // touchmove, or arrive before the first touchmove at all.
    gesture.at = view.performance.now(); gesture.pendingScroll = pendingScroll;
    gesture.inputAt = previous ? previous.inputAt
      : event.type === "touchmove" && touchStart ? touchStart.since : event.timeStamp;
    if (event.type === "touchmove" && touchStart) {
      // Only trusted document scroll observed since this intent began counts as
      // its native motion. Each touchmove consumes that evidence, so a reversal
      // or an older scroll can never be reused by a later direction.
      if (!previous && Math.sign(touchStart.motion) === direction) gesture.scrolled = true;
      touchStart.motion = 0; touchStart.since = event.timeStamp;
    }
    if (diagnostics) report("intent-accepted", event, { direction });
    schedule();
  };
  // Desktop wheel/trackpad: like a mobile release, a swipe starts its trip at
  // once and the rest of that swipe (or trackpad inertia) is absorbed. Offers
  // keep native wheel scrolling with hard edges; the FAQ/footer stay native.
  let wheelAt = -Infinity, wheelDirection = 0, wheelOwned = false;
  const ownWheel = event => {
    if (!finePointer.matches || !event.isTrusted || event.ctrlKey || event.defaultPrevented) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.innerHeight : 1);
    const direction = Math.abs(event.deltaY) > Math.abs(event.deltaX || 0) ? Math.sign(delta) : 0;
    inputKind = "wheel";
    if (!direction || touching || blocked() || controlled(event.target, TOUCH_OWNERS)) { wheelOwned = false; return; }
    const now = view.performance.now(), fresh = now - wheelAt > WHEEL_GAP_MS || direction !== wheelDirection;
    wheelAt = now; wheelDirection = direction;
    if (!fresh && wheelOwned) { event.preventDefault(); return; }
    const y = view.scrollY, plan = route(y, y, direction);
    if (plan.native) {
      const { reading } = plan, edge = reading && (direction > 0 ? reading.end : reading.start);
      // Chrome animates each notch after this event: guard the edge against it.
      if (reading && y > reading.start - 1 && y < reading.end + 1) readingGuard = { start: reading.start, end: reading.end };
      wheelOwned = edge != null && y > reading.start - 1 && y < reading.end + 1 && (y + delta - edge) * direction > 0;
      if (wheelOwned) {
        event.preventDefault(); cancel("wheel-edge", event);
        if (Math.abs(y - edge) > 0.5) view.scrollTo({ top: edge, behavior: "instant" });
      }
      return;
    }
    // Nothing ahead (end of a page's chapters): the wheel stays native so the
    // guide, FAQ and footer below remain reachable.
    if (!plan.destination) { wheelOwned = false; return; }
    event.preventDefault(); wheelOwned = true;
    if (assisting && Math.abs(assisting.target - plan.destination.y) <= 1) return;
    cancel("wheel-gesture", event);
    travel(event, "wheel", plan.destination, plan.opening, y, direction, false, now);
  };
  const wheel = event => {
    if (event.defaultPrevented) return; // Owned above; native wheel keeps the gesture path.
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
      if (gesture) gesture.at = view.performance.now();
      schedule();
    }
    if (diagnostics) report("key-release", event);
  };
  const touchstart = event => {
    cancel("touchstart", event);
    readingGuard = null;
    inputKind = "touch";
    touching = event.touches.length > 0;
    // A pan that starts on a link or button is still a page scroll; a tap never
    // scrolls, so it cannot arm assistance. Fields, menus and dialogs own touch.
    touchY = event.isTrusted && event.touches.length === 1 && !blocked() && !controlled(event.target, TOUCH_OWNERS)
      ? event.touches[0].clientY : null;
    // Native scroll may arrive before the first touchmove; `scroll` records it
    // only when trusted and stamped after the intent it would support.
    touchStart = touchY != null ? { since: event.timeStamp, motion: 0 } : null;
    touchOrigin = touchY != null ? { x: event.touches[0].clientX, y: touchY } : null;
    if (diagnostics) report("touch-start", event, { accepted: touchY != null, reason: touchY != null ? null : !event.isTrusted ? "untrusted" : event.touches.length !== 1 ? "touch-count" : blockedReason || "control-target" });
  };
  const touchmove = event => {
    if (touchY == null || event.touches.length !== 1) {
      if (diagnostics) report("intent-rejected", event, { reason: touchY == null ? "no-eligible-touch-start" : "touch-count" });
      cancel("invalid-touch-move", event); touchY = null; return;
    }
    const y = event.touches[0].clientY;
    const dx = Math.abs((event.touches[0].clientX ?? touchOrigin.x) - touchOrigin.x);
    if (dx > HORIZONTAL_PX && dx > Math.abs(y - touchOrigin.y)) {
      if (diagnostics) report("intent-rejected", event, { reason: "horizontal-drag" });
      cancel("horizontal-drag", event); touchY = null; touchStart = null; return;
    }
    // A packet without vertical change carries no new intent; it must not
    // erase the gesture (horizontal jitter, duplicate coalesced packets).
    if (y === touchY) {
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
      if (gesture) gesture.at = view.performance.now();
      schedule();
    }
    if (diagnostics) report("touch-release", event);
  };
  const reset = source => { cancel(source); readingGuard = null; touching = false; touchY = null; touchStart = null; heldKey = null; pointerHeld = false; };
  // A press may follow a link that scrolls the page: no edge guard survives it.
  const pointerdown = event => { pointerHeld = true; readingGuard = null; cancel(event); };
  const pointerup = () => {
    pointerHeld = false;
    if (gesture) gesture.at = view.performance.now();
    schedule();
  };
  const pointercancel = event => {
    pointerHeld = false;
    // UA panning may suppress Pointer Events while an independently observed
    // Touch Events gesture continues. Only touchcancel terminates that stream.
    if (event.pointerType === "touch" && touching && touchY != null && assisting == null) {
      if (diagnostics) report("pointer-release", event, { reason: "pointer-stream-cancelled" });
      return;
    }
    reset(event);
  };
  const scroll = event => {
    if (event.target !== document) return;
    const y = view.scrollY;
    // The first scroll must move beyond this input’s starting position unless
    // a pending compositor displacement has its own matching event evidence.
    let delta = y - (gesture && !gesture.scrolled && !gesture.pendingScroll ? gesture.inputY : lastY);
    if (diagnostics) report("scroll", event, { delta });
    // Momentum past an offer edge stops there; on iOS a write ends deceleration.
    if (readingGuard && !touching && !assisting && (y > readingGuard.end || y < readingGuard.start)) {
      if (inputKind === "wheel") wheelOwned = true; // Absorb the rest of this swipe at the edge.
      view.scrollTo({ top: y > readingGuard.end ? readingGuard.end : readingGuard.start, behavior: "instant" });
      return;
    }
    velocity = (y - lastY) / Math.max(1, view.performance.now() - lastYAt);
    lastY = y;
    lastYAt = view.performance.now();
    if (blocked()) { cancel("scroll-blocked", event); return; }
    if (assisting) {
      const active = assisting;
      if (!event.isTrusted || !Number.isFinite(event.timeStamp) || event.timeStamp < active.started
        || event.timeStamp > view.performance.now()) return;
      // Navigation calls cancel explicitly. Unexpected reverse movement or a
      // position beyond this one destination relinquishes assisted ownership.
      // Safari can land an earlier write after momentum or a later write was
      // observed. That echo is this trip's own pose, not foreign movement.
      if ((y - active.lastY) * active.direction < 0 && writes.some(write => Math.abs(write - y) <= 1)) {
        active.lastY = y; return;
      }
      // Momentum frames rendered before Safari applied the first lead write
      // still arrive for up to ~50ms; behind that write they are not foreign.
      if (active.early && view.performance.now() - active.started < MOMENTUM_PROOF_MS
        && (y - active.from) * active.direction >= 0 && (y - active.written) * active.direction <= 0) return;
      if ((y - active.lastY) * active.direction < 0 || (y - active.target) * active.direction > 1) {
        cancel("foreign-scroll", event); return;
      }
      if (active.early && (y - active.written) * active.direction > 1
        && view.performance.now() - active.started >= MOMENTUM_PROOF_MS) {
        // Native momentum survived the writes: never fight it. Inertia keeps the
        // page and the same destination rule applies after its corroborated end.
        view.cancelAnimationFrame(frame); frame = null; assisting = null;
        gesture = { type: "momentum", direction: active.direction, scrolled: true, inputY: y,
          at: view.performance.now() - RELEASE_MS, inputAt: active.started, pendingScroll: null };
        if (diagnostics) report("momentum-yield", event, { written: active.written });
        return;
      }
      active.lastY = y;
      complete(event);
      return;
    }
    if (gesture?.pendingScroll) {
      const pending = gesture.pendingScroll;
      gesture.pendingScroll = null; // One event can corroborate it; never replay it.
      const confirmed = !delta && event.isTrusted && Number.isFinite(event.timeStamp)
        && event.timeStamp >= pending.inputAt && event.timeStamp <= view.performance.now();
      if (!delta && !confirmed) { cancel("unconfirmed-scroll", event); return; }
      if (confirmed) delta = pending.delta;
      if (diagnostics) report("pending-scroll", event, { confirmed, pending, delta });
    }
    if (!gesture && delta && touching && touchStart && event.isTrusted && Number.isFinite(event.timeStamp)
      && event.timeStamp >= touchStart.since && event.timeStamp <= view.performance.now()) touchStart.motion += delta;
    if (!gesture || !delta) {
      if (diagnostics) report("scroll-return", event, { reason: !gesture ? "no-gesture" : "zero-delta", delta });
      return;
    }
    const invalidScroll = !event.isTrusted
      || !Number.isFinite(event.timeStamp) || event.timeStamp < gesture.inputAt || event.timeStamp > view.performance.now();
    // Direction proves the first native movement. Under a held finger, a later
    // viewport correction keeps the touch intent (real reversals arrive as
    // touchmove). Without contact, Safari may suppress the touch events of a new
    // fling during inertia, so an unexplained reversal returns the page to native.
    if ((Math.sign(delta) !== gesture.direction && (!gesture.scrolled || !touching)) || invalidScroll) {
      if (diagnostics) report("scroll-cancel", event, { reason: invalidScroll ? "unconfirmed-scroll"
        : "reverse-scroll", delta });
      cancel("native-scroll-rejected", event);
      return;
    }
    gesture.scrolled = true;
    if (nativeEnd && nativeEnd.y !== y) nativeEnd = null;
    if (diagnostics) report("scroll-accepted", event, { delta });
    // Safari can dispatch its final document scroll after scrollend. That exact
    // position corroborates the stored end without waiting another timer turn.
    if (hasScrollEnd && nativeEnd) settle(event, released() ? "release" : "scrollend");
    else if (released()) settle(event);
    else schedule();
  };
  const scrollend = event => {
    if (diagnostics) report("scrollend", event, { documentScroll: event.target === document });
    if (!hasScrollEnd || event.target !== document || !event.isTrusted || !Number.isFinite(event.timeStamp)
      || event.timeStamp < (assisting?.started ?? gesture?.inputAt ?? 0) || event.timeStamp > view.performance.now()) return;
    if (assisting) complete(event);
    else if (!gesture && !touching && !heldKey && !pointerHeld) {
      // General rule: a page left at rest between two stops returns to the
      // nearest one. It also recovers gestures whose touches Safari never
      // dispatched during deceleration (WebKit 191218/310540).
      gesture = { type: "idle", direction: 0, scrolled: true, inputY: view.scrollY,
        at: view.performance.now() - RELEASE_MS, inputAt: event.timeStamp, pendingScroll: null };
      nativeEnd = { y: view.scrollY };
      settle(event, "idle-nearest");
    } else {
      // A discrete native key scroll can end before keyup. Remember its pose;
      // settle still waits for release, and later input/movement invalidates it.
      if (gesture) nativeEnd = { y: view.scrollY };
      settle(event);
    }
  };
  const listeners = [
    [view, "scroll", scroll], [document, "scrollend", scrollend],
    [document, "wheel", wheel], [document, "keydown", keydown], [document, "keyup", keyup],
    [document, "touchstart", touchstart], [document, "touchmove", touchmove],
    [document, "touchend", touchend], [document, "touchcancel", reset],
    [document, "pointerdown", pointerdown], [document, "pointerup", pointerup], [document, "pointercancel", pointercancel],
    [document, "click", cancel], [document, "focusin", cancel],
    [document, "visibilitychange", reset], [view, "hashchange", reset],
    // Capture also receives element blurs (an inert pricing layer drops focus
    // mid-trip); only the window losing focus releases ownership.
    [view, "blur", event => { if (event.target === view) reset(event); }], [reduced, "change", reset],
  ];
  const options = { passive: true, capture: true };
  const ownership = { passive: false, capture: true }; // preventDefault needs an active listener.
  document.addEventListener("wheel", ownWheel, ownership); // Registered first: runs before `wheel`.
  for (const [target, type, handler] of listeners) target.addEventListener(type, handler, options);
  if (diagnostics) report("installed", null);
  return {
    cancel: reset,
    dispose() {
      reset("dispose");
      disposed = true;
      document.removeEventListener("wheel", ownWheel, ownership);
      for (const [target, type, handler] of listeners) target.removeEventListener(type, handler, options);
    },
  };
}
