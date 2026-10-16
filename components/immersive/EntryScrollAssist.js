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
// Scroll continuation starts only after native momentum has settled. A short
// C2 entrance ramp reacts promptly without racing WebKit's own inertia.
// Front-load visible motion on the long 3D scene joins. Preserve zero
// endpoint velocity and the same authored camera/text poses.
const launchEase = (progress, fast = false) =>
  cinematicEase(fast ? 1 - (1 - progress) ** 1.6 : progress, 0.14);
// Wheel packets closer than this belong to one swipe or its trackpad inertia.
const WHEEL_GAP_MS = 180;
// A drag this far and mostly sideways rotates a 3D model, not the page.
const HORIZONTAL_PX = 12;
const natural = id => id === "open-weight" || id === "footer";

// Monotonic, continuous timing: shorter trips must never take longer than
// longer trips (the former >6-screen special case made pacing jump by 600ms).
const FAST_SCENE_DESTINATIONS = new Set([
  "encryption", "grip", "sustainability", "testimonies",
  "social-content", "product", "open-weight",
]);
export function assistedScrollDuration(stages, destinationId, fast = FAST_SCENE_DESTINATIONS.has(destinationId)) {
  const screens = Math.max(0, stages);
  // Only these destination scenes (and content pages) get faster pacing; other
  // stops keep their timing. This duration remains continuous as distance varies.
  return fast
    ? Math.min(950, Math.max(650, 550 + 55 * screens))
    : Math.min(1300, Math.max(650, 580 + 90 * screens));
}

/** Complete one adjacent reading stop: at touch release, else after native momentum ends.
 * One RAF owns the continuation; the caller cancels before programmatic
 * navigation/layout remaps and while UI blocks scrolling. No idle RAF remains.
 */
export function createEntryScrollAssist({ getGeometry, isBlocked, fastTrips = false }, view = window) {
  const document = view.document;
  const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = view.matchMedia("(hover: hover) and (pointer: fine)");
  const coarsePointer = view.matchMedia("(hover: none) and (pointer: coarse)");
  const cinematicMain = document.querySelector?.("main");
  const presentationRoot = document.querySelector?.("[data-immersive-vistaire]");
  // The pricing phone is a portal outside main; its first-offer boundary
  // must honor the same directional touch ownership as the main document.
  const pricingScreenHost = document.getElementById?.("pricing-screen-host");
  const pricingActionsHost = document.getElementById?.("pricing-actions-host");
  const hasScrollEnd = "onscrollend" in document;
  const diagnostics = new URLSearchParams(view.location?.search || "").get("sceneDiagnostics") === "1"
    || typeof view.__vistaireScrollAssistTrace === "function";
  let pointerHeld = false;
  let blockedReason = null;
  let gesture = null;
  let assisting = null;
  let interruptedTrip = null;
  let lastY = view.scrollY;
  let lastYAt = view.performance.now();
  let timer = null;
  let frame = null;
  let nativeEnd = null;
  let touchY = null;
  let touchStart = null;
  let touchOrigin = null;
  let ownedTouch = null;
  let touchRange = null;
  let touchSuppressed = false;
  let touchGeometry = null;
  let touchSequence = 0;
  let latestInputAt = -Infinity;
  const rememberInput = event => {
    if (event.isTrusted && Number.isFinite(event.timeStamp) && event.timeStamp <= view.performance.now())
      latestInputAt = Math.max(latestInputAt, event.timeStamp);
  };
  // Browser navigation events can be delivered after newer input under load.
  // Keep provenance after reset/completion so both engine and App agree.
  const isNavigationCurrent = event => !Number.isFinite(event?.timeStamp) || event.timeStamp >= latestInputAt;
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
        eventType: event?.type ?? null, hasScrollEnd, touching, heldKey, touchY, pointerHeld, mode: assisting ? "cinematic" : ownedTouch ? "pending-touch" : "native",
        gesture: gesture ? { ...gesture } : null,
        assisting: assisting ? { ...assisting } : null,
        lastY, currentY: view.scrollY, gestureId: touchSequence,
        owner: assisting || ownedTouch?.reserved || ownedTouch?.claimed ? "javascript" : ownedTouch ? "pending" : "native",
        cancelable: event?.cancelable ?? null, defaultPrevented: event?.defaultPrevented ?? null,
        viewport: { height: view.innerHeight, visibleHeight: view.visualViewport?.height, offsetTop: view.visualViewport?.offsetTop },
        touchLocked: cinematicMain?.classList?.contains("cinematic-touch-lock"),
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
    gesture = null; nativeEnd = null; assisting = null; ownedTouch = null; interruptedTrip = null;
    // A new contact keeps the visible native pose. Reading scrollY here and
    // writing it back can reset a compositor position that has advanced ahead.
  };
  const complete = event => {
    if (!assisting || assisting.elapsed < assisting.duration || view.scrollY !== assisting.lastY
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
    // Use wall-clock time instead of capped frame increments: busy 3D frames
    // must not leave the user stranded between authored section stops.
    active.elapsed = Math.max(0, now - active.started);
    const progress = Math.min(1, active.elapsed / active.duration);
    // Never write behind the latest observed native/document position.
    const curve = active.from + (active.target - active.from) * (active.coast ? 1 - (1 - progress) ** 3 : launchEase(progress, active.fast));
    const y = active.direction > 0 ? Math.max(curve, active.lastY) : Math.min(curve, active.lastY);
    active.written = y;
    writes = [...writes.slice(-3), y];
    if (diagnostics) report("assist-write", null, { y, progress });
    view.scrollTo({ top: y, behavior: "instant" });
    // Immediate scrollTo readback is not a native position observation. Only
    // document scroll events update lastY, including harmless repeated poses.
    if (assisting !== active) return;
    if (progress < 1) frame = view.requestAnimationFrame(animate);
    else {
      // The last browser scroll event may arrive after the final instant write.
      // Verify for 400ms without leaving a dead controlled trip behind.
      complete(null);
      if (assisting === active) {
        if (now - active.started < active.duration + 400) frame = view.requestAnimationFrame(animate);
        else cancel("arrival-unconfirmed");
      }
    }
  };
  // Never write scrollTo into WebKit's live touch inertia. scrollend is the
  // preferred proof; a quiet native position is a guarded missing-event fallback.
  const settle = (event, source = hasScrollEnd ? "scrollend" : "quiet-fallback") => {
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
    const validEnd = hasScrollEnd && nativeEnd?.y === lastY;
    const waitingEnd = hasScrollEnd && gesture.type !== "touchmove" && !validEnd;
    if (!validEnd && (waitingEnd ||
      view.performance.now() - Math.max(gesture.at, lastYAt) < QUIET_MS)) {
      if (diagnostics) report("settle-return", event, { reason: "await-native-end-or-quiet" });
      if (!waitingEnd) schedule();
      return;
    }
    const { at, inputY } = gesture;
    let { direction } = gesture;
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
    travel(event, source, plan.destination, plan.opening, y, direction, at);
  };
  // One destination rule for touch, wheel/trackpad, keys and idle returns.
  const route = (y, origin, direction) => {
    const { opening, transitions, pricing: reading, naturalFrom } = touchGeometry ?? getGeometry();
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
  // Mobile browser chrome and native inertial scrolling must not compete with
  // the authored timeline. Only cinematic stops are locked; pricing and guides
  // regain native page scrolling. Layout-reading boundaries are cached.
  const syncTouchLock = (refresh = false) => {
    if (!cinematicMain?.classList) return false;
    // touch-action is negotiated at contact start, never renegotiated by a
    // resize or a scroll callback in the middle of that same gesture.
    if (touching) return cinematicMain.classList.contains("cinematic-touch-lock");
    // Pricing measures after App; keep refreshing until its offers exist.
    if (refresh || !touchRange || touchRange.readingEnd == null) {
      const geometry = coarsePointer.matches && !reduced.matches ? getGeometry() : null;
      const pricingStart = geometry?.pricing?.start ??
        geometry?.transitions?.find(join => join.to.id === "open-weight")?.end ?? null;
      // Offers are read by JavaScript-owned touch too: a native pan there lets
      // Brave/Chrome iOS move their toolbars and resize the layout viewport.
      const readingEnd = geometry?.pricing?.end;
      // A content page's guide head is the same native-forward, owned-reverse edge.
      const returnAt = pricingStart ?? geometry?.naturalFrom ?? null;
      touchRange = geometry?.opening ? {
        top: geometry.opening.top,
        // WebKit floors fractional destinations; Chromium can round them.
        // Cover either representable pixel and one pixel of arrival drift.
        pricingStart: returnAt == null ? null : Math.floor(returnAt),
        pricingEnd: returnAt == null ? null : Math.ceil(returnAt),
        readingEnd,
        end: Math.min(readingEnd != null ? Math.ceil(readingEnd) + 2
          : pricingStart == null ? Infinity : Math.floor(pricingStart), geometry.naturalFrom ?? Infinity),
      } : null;
    }
    const enabled = coarsePointer.matches && !reduced.matches && !touchSuppressed;
    const locked = Boolean(enabled && touchRange
      && view.scrollY >= touchRange.top - 1 && view.scrollY < touchRange.end - 1);
    // The first offer keeps native pan-y. Only a cancelable first reverse
    // movement may claim a cinematic return before native panning begins.
    const pricingReturn = Boolean(!locked && enabled
      && touchRange?.pricingStart != null
      && view.scrollY >= touchRange.pricingStart - 1
      && view.scrollY <= touchRange.pricingEnd + 1);
    cinematicMain.classList.toggle("cinematic-touch-lock", locked);
    cinematicMain.classList.toggle("cinematic-pricing-return", pricingReturn);
    presentationRoot?.classList?.toggle("cinematic-touch-lock", locked);
    presentationRoot?.classList?.toggle("cinematic-pricing-return", pricingReturn);
    pricingScreenHost?.classList?.toggle("cinematic-pricing-return", pricingReturn);
    pricingActionsHost?.classList?.toggle("cinematic-pricing-return", pricingReturn);
    return locked;
  };
  const travel = (event, source, destination, opening, y, direction, at, { duration: fixed, coast = false } = {}) => {
    const target = destination.y;
    // The trip travels toward its stop (an idle return or an offer-edge return
    // can run against the gesture's own direction).
    direction = Math.sign(target - y) || direction;
    const phase = diagnostics ? { kind: "reading-stop", id: destination.id, target } : undefined;

    const now = view.performance.now();
    // A shorter physical trip never takes longer than a longer one.
    const stages = Math.abs(target - y) / opening.stageHeight;
    const fast = fastTrips || FAST_SCENE_DESTINATIONS.has(destination.id);
    const duration = fixed ?? assistedScrollDuration(stages, destination.id, fast);
    readingGuard = null;
    assisting = { target, started: now, direction, lastY: y, from: y, duration, coast,
      fast, elapsed: 0, written: y };
    writes = [];
    if (diagnostics) {
      report("assist-start", event, { direction, target, duration, distance: (target - y) * direction, phase, geometry: { ...opening } });
      report("handoff", event, { source, target, inputQuietMs: now - at });
    }
    frame = view.requestAnimationFrame(animate);
  };
  const schedule = () => {
    clearTimer();
    if (!gesture?.scrolled || assisting || touching || heldKey || pointerHeld) return;
    const nativeStopped = hasScrollEnd && nativeEnd?.y === lastY;
    if (hasScrollEnd && !nativeStopped && gesture.type !== "touchmove") return;
    const quietSince = nativeStopped ? gesture.at : Math.max(gesture.at, lastYAt);
    const remaining = Math.max(0, (nativeStopped ? RELEASE_MS : QUIET_MS) - (view.performance.now() - quietSince));
    timer = view.setTimeout(() => settle(null, nativeStopped ? "scrollend" : "quiet-fallback"), remaining);
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
    if (event.type !== "wheel" || (!finePointer.matches && !sameInput)) rememberInput(event);
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
    if (fresh) rememberInput(event); // Absorbed inertia is not a new navigation intent.
    wheelAt = now; wheelDirection = direction;
    if (!fresh && wheelOwned) { event.preventDefault(); return; }
    const y = view.scrollY, plan = route(y, y, direction);
    if (plan.native) {
      // Offers have two hard edges; a page's free reading (guide/FAQ) has one:
      // its head, so an upward fling never coasts into the chapters above.
      const { reading, naturalFrom } = plan;
      const start = reading ? reading.start : naturalFrom, end = reading ? reading.end : Infinity;
      const edge = reading ? (direction > 0 ? reading.end : reading.start) : direction < 0 ? naturalFrom : null;
      const inside = start != null && y > start - 1 && y < end + 1;
      // Chrome animates each notch after this event: guard the edge against it.
      if (inside) readingGuard = { start, end };
      wheelOwned = edge != null && inside && (y + delta - edge) * direction > 0;
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
    travel(event, "wheel", plan.destination, plan.opening, y, direction, now);
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
    if (direction) readingGuard = null; // A new key press is new intent, not momentum.
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
    const interrupted = assisting ?? interruptedTrip;
    cancel("touchstart", event);
    readingGuard = null;
    inputKind = "touch";
    const locked = syncTouchLock(true);
    touching = event.touches.length > 0;
    touchSequence += 1;
    const geometry = getGeometry();
    touchGeometry = { ...geometry, pricing: geometry.pricing ? { ...geometry.pricing } : undefined };
    // A pan that starts on a link or button is still a page scroll; a tap never
    // scrolls, so it cannot arm assistance. Fields, menus and dialogs own touch.
    touchY = event.isTrusted && event.touches.length === 1 && !blocked() && !controlled(event.target, TOUCH_OWNERS)
      ? event.touches[0].clientY : null;
    // Native scroll may arrive before the first touchmove; `scroll` records it
    // only when trusted and stamped after the intent it would support.
    if (touchY != null) rememberInput(event);
    touchStart = touchY != null ? { since: event.timeStamp, motion: 0 } : null;
    touchOrigin = touchY != null ? { x: event.touches[0].clientX, y: touchY } : null;
    const pricingReturn = !locked && cinematicMain?.classList?.contains("cinematic-pricing-return");
    // On pricing and pinned 3D scenes, much of the visible background and
    // the phone portals live outside main. They must still own mobile swipes.
    const onScene = presentationRoot?.contains?.(event.target)
      || cinematicMain?.contains?.(event.target)
      || (pricingReturn && (pricingScreenHost?.contains?.(event.target)
        || pricingActionsHost?.contains?.(event.target)));
    if (touchY != null && (locked || pricingReturn) && onScene) {
      const reading = touchGeometry.pricing, origin = view.scrollY;
      ownedTouch = { x: event.touches[0].clientX ?? 0, y: touchY, direction: 0, claimed: false,
        pricingReturn, at: view.performance.now(), origin,
        // Inside the offers the finger drives the phone reader directly.
        reading: locked && reading && origin > reading.start - 1 && origin < reading.end + 1 ? reading : null,
        interrupted: !controlled(event.target) ? interrupted : null };
      touchStart = null; // No native scroll evidence is needed for this gesture.
    }
    if (diagnostics) report("touch-start", event, { accepted: touchY != null, locked: Boolean(ownedTouch),
      reason: touchY != null ? null : !event.isTrusted ? "untrusted" : event.touches.length !== 1 ? "touch-count" : blockedReason || "control-target" });
  };
  const touchmove = event => {
    if (ownedTouch) {
      if (event.touches.length !== 1) { ownedTouch = null; touchY = null; return; }
      const x = event.touches[0].clientX ?? ownedTouch.x;
      const y = event.touches[0].clientY;
      const dx = Math.abs(x - ownedTouch.x), dy = ownedTouch.y - y;
      // Horizontal 3D rotation and small taps are not vertical navigation.
      if (!ownedTouch.claimed && dx > HORIZONTAL_PX && dx > Math.abs(dy)) {
        ownedTouch = null; touchY = null; touchOrigin = null;
        if (diagnostics) report("intent-rejected", event, { reason: "horizontal-drag" });
        return;
      }
      // Offers follow the finger inside their edges. An outward swipe that
      // starts on an edge keeps the authored transition at release.
      const reading = ownedTouch.reading;
      if (reading && ownedTouch.follow == null && Math.abs(dy) > dx && Math.abs(dy) >= 2)
        // Two pixels cover WebKit/Chromium rounding of fractional edges.
        ownedTouch.follow = !((dy > 0 && ownedTouch.origin >= reading.end - 2) || (dy < 0 && ownedTouch.origin <= reading.start + 2));
      if (reading && ownedTouch.follow === false && !ownedTouch.outward) ownedTouch.outward = Math.sign(dy);
      if (ownedTouch.follow) {
        if (event.cancelable) event.preventDefault();
        rememberInput(event);
        const top = Math.min(reading.end, Math.max(reading.start, ownedTouch.origin + dy)), now = view.performance.now();
        ownedTouch.samples = [...(ownedTouch.samples ?? []).filter(sample => now - sample.at <= 100), { at: now, y: top }];
        ownedTouch.claimed = true;
        ownedTouch.direction = Math.sign(dy) || ownedTouch.direction;
        if (diagnostics) report("touch-follow", event, { top });
        view.scrollTo({ top, behavior: "instant" });
        touchY = y;
        return;
      }
      // Pricing remains native on both WebKit and Chromium. Decide ownership
      // on the first vertical move, before the browser starts a pan. A gesture
      // yielded to native reading cannot switch back to JavaScript on reversal.
      if (!ownedTouch.claimed && Math.abs(dy) > dx && Math.abs(dy) >= (ownedTouch.pricingReturn || reading ? 1 : 12)) {
        if (ownedTouch.pricingReturn && dy > 0 && !ownedTouch.reserved) {
          ownedTouch = null; touchY = null; touchStart = null;
          if (diagnostics) report("touch-native-reading", event);
          return;
        }
        if (!event.cancelable || event.defaultPrevented) {
          ownedTouch = null; touchY = null; touchStart = null;
          if (diagnostics) report("touch-native-owner", event);
          return;
        }
        event.preventDefault();
        if (!event.defaultPrevented) {
          ownedTouch = null; touchY = null; touchStart = null;
          return;
        }
        rememberInput(event);
        ownedTouch.reserved = true;
        ownedTouch.claimed = Math.abs(dy) >= 12;
      }
      if (ownedTouch.claimed) {
        rememberInput(event);
        ownedTouch.direction = Math.abs(dy) >= 12 ? Math.sign(dy) : 0;
        if (event.cancelable) event.preventDefault();
        if (diagnostics) report("touch-locked-move", event, { direction: ownedTouch.direction, displacement: dy });
      }
      touchY = y;
      return;
    }
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
    const owned = ownedTouch;
    ownedTouch = null;
    if (!touching) {
      touchY = null; touchStart = null;
      syncTouchLock(true);
      if (owned?.follow && !blocked()) {
        if (event.cancelable) event.preventDefault();
        const { start, end } = owned.reading, y = view.scrollY, now = view.performance.now();
        const recent = (owned.samples ?? []).filter(sample => now - sample.at <= 100);
        const velocity = recent.length > 1 ? (recent.at(-1).y - recent[0].y) / Math.max(1, recent.at(-1).at - recent[0].at) : 0;
        // A flick coasts like native inertia but never crosses an offer edge.
        const top = Math.min(end, Math.max(start, y + velocity * 325));
        if (Math.abs(velocity) > 0.05 && Math.abs(top - y) > 1)
          travel(event, "touch-coast", { id: "pricing-reading", y: top }, (touchGeometry ?? getGeometry()).opening, y,
            Math.sign(velocity), owned.at, { duration: Math.min(1200, Math.max(180, (3 * Math.abs(top - y)) / Math.abs(velocity))),
              coast: true });
        if (diagnostics) report("touch-release", event, { locked: true, velocity });
        touchGeometry = null;
        return;
      }
      if (owned?.claimed && owned.direction && !blocked()) {
        if (event.cancelable) event.preventDefault();
        const y = view.scrollY;
        let plan = route(y, owned.origin, owned.direction);
        // An outward swipe from an offer edge opens the FAQ or returns below;
        // a reversal back over the offers within that contact navigates nowhere.
        if (owned.reading) plan = owned.direction !== owned.outward ? {}
          : owned.direction > 0 ? { opening: (touchGeometry ?? getGeometry()).opening, destination: { id: "faq", y: owned.reading.faq } } : plan;
        if ((owned.pricingReturn || owned.reading?.start != null && owned.outward < 0) && owned.direction < 0) {
          // Return from the actual first-offer reading anchor to Product,
          // never to the incoming Pricing animation's intermediate position.
          const geometry = touchGeometry ?? getGeometry();
          // A content page's guide head returns to its own previous stop (route).
          const product = geometry.naturalFrom == null && geometry.transitions?.find(join => join.to.id === "product");
          if (product && product.end < y - 1)
            plan = { opening: geometry.opening, destination: { id: "product", y: product.end } };
        }
        if (!plan.native && plan.destination)
          travel(event, "touch-locked", plan.destination, plan.opening, y, owned.direction, owned.at);
        else if (diagnostics) report("touch-locked-native", event, { direction: owned.direction });
        if (diagnostics) report("touch-release", event, { locked: true });
        touchGeometry = null;
        return;
      }
      // A background contact pauses the trip while held. With no new swipe,
      // finish that same adjacent stop; controls and model drags never resume it.
      if (owned?.interrupted && !blocked()) {
        const y = view.scrollY;
        const plan = route(y, y, owned.interrupted.direction);
        if (!plan.native && plan.destination && Math.abs(plan.destination.y - owned.interrupted.target) <= 1) {
          if (event.cancelable) event.preventDefault(); // suppress the compatibility click
          travel(event, "touch-resume", plan.destination, plan.opening, y, owned.interrupted.direction, owned.at);
        }
        touchGeometry = null;
        return;
      }
      // Free-reading guides have a native upper edge. Arm its existing
      // momentum guard before coasting can cross it, without starting an RAF.
      const reading = gesture?.scrolled && gesture.direction < 0
        ? route(view.scrollY, gesture.inputY ?? view.scrollY, gesture.direction) : null;
      if (reading?.native && reading.naturalFrom != null && view.scrollY > reading.naturalFrom + 1) {
        readingGuard = { start: reading.naturalFrom, end: Infinity };
        gesture = null; nativeEnd = null; clearTimer();
      } else {
        if (gesture) gesture.at = view.performance.now();
        schedule();
      }
    }
    if (!touching) touchGeometry = null;
    if (diagnostics) report("touch-release", event);
  };
  const reset = source => { cancel(source); readingGuard = null; touching = source?.type === "touchcancel" && source.touches.length > 0; touchGeometry = null; touchY = null; touchStart = null; heldKey = null; pointerHeld = false; syncTouchLock(true); };
  // A press may follow a link that scrolls the page: no edge guard survives it.
  const pointerdown = event => {
    const interrupted = event.pointerType === "touch" ? assisting : null;
    pointerHeld = true; readingGuard = null; cancel(event);
    interruptedTrip = interrupted;
  };
  const pointerup = () => {
    pointerHeld = false;
    if (gesture) gesture.at = view.performance.now();
    schedule();
  };
  const pointercancel = event => {
    pointerHeld = false;
    // UA panning may suppress Pointer Events while an independently observed
    // Touch Events gesture continues. Only touchcancel terminates that stream.
    if (event.pointerType === "touch" && touching && assisting == null) {
      if (diagnostics) report("pointer-release", event, { reason: "pointer-stream-cancelled" });
      return;
    }
    reset(event);
  };
  const scroll = event => {
    if (event.target !== document) return;
    const y = view.scrollY;
    syncTouchLock();
    // The first scroll must move beyond this input’s starting position unless
    // a pending compositor displacement has its own matching event evidence.
    let delta = y - (gesture && !gesture.scrolled && !gesture.pendingScroll ? gesture.inputY : lastY);
    if (diagnostics) report("scroll", event, { delta });
    // Brave/Chrome iOS (and WebKit flings during inertia) can withhold touch
    // events, so native movement from inside the offers always arms their edges,
    // and native reading below them (FAQ, guide) never coasts back above its head.
    // A navigation jump is larger than one viewport and is never pulled back.
    if (!readingGuard && !touching && !assisting && touchRange && Math.abs(y - lastY) < view.innerHeight) {
      const { pricing: reading, naturalFrom } = getGeometry(), inside = at => at > reading.start - 1 && at < reading.end + 1;
      const floor = reading?.end ?? naturalFrom;
      if (reading && (inside(y) || inside(lastY) || (gesture && inside(gesture.inputY))))
        readingGuard = { start: reading.start, end: reading.end };
      else if (floor != null && lastY > floor + 1) readingGuard = { start: floor, end: Infinity };
    }
    // Momentum past an offer edge stops there; on iOS a write ends deceleration.
    if (readingGuard && !touching && !assisting && (y > readingGuard.end || y < readingGuard.start)) {
      if (inputKind === "wheel") wheelOwned = true; // Absorb the rest of this swipe at the edge.
      view.scrollTo({ top: y > readingGuard.end ? readingGuard.end : readingGuard.start, behavior: "instant" });
      return;
    }
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
      if ((y - active.lastY) * active.direction < 0 || (y - active.target) * active.direction > 1) {
        cancel("foreign-scroll", event); return;
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
    if (hasScrollEnd && nativeEnd) settle(event, "scrollend");
    else schedule();
  };
  const scrollend = event => {
    if (diagnostics) report("scrollend", event, { documentScroll: event.target === document });
    if (!hasScrollEnd || event.target !== document || !event.isTrusted || !Number.isFinite(event.timeStamp)
      || event.timeStamp < (assisting?.started ?? gesture?.inputAt ?? 0) || event.timeStamp > view.performance.now()) return;
    if (assisting) complete(event);
    else if (!gesture) {
      // A toolbar resize, browser navigation or compositor correction can emit
      // scrollend with no user intent. Never create a phantom snap gesture.
      return;
    } else {
      // A discrete native key scroll can end before keyup. Remember its pose;
      // settle still waits for release, and later input/movement invalidates it.
      if (gesture) nativeEnd = { y: view.scrollY };
      settle(event);
    }
  };
  const navigateHash = event => {
    if (!isNavigationCurrent(event)) {
      if (diagnostics) report("navigation-rejected", event, { reason: "older-than-input", latestInputAt });
      return;
    }
    reset(event);
  };
  const listeners = [
    [view, "scroll", scroll], [document, "scrollend", scrollend],
    [document, "wheel", wheel], [document, "keydown", keydown], [document, "keyup", keyup],
    [document, "touchstart", touchstart], [document, "touchmove", touchmove],
    [document, "touchend", touchend], [document, "touchcancel", reset],
    [document, "pointerdown", pointerdown], [document, "pointerup", pointerup], [document, "pointercancel", pointercancel],
    [document, "click", cancel], [document, "focusin", event => { if (!ownedTouch) cancel(event); }],
    [document, "visibilitychange", reset], [view, "hashchange", navigateHash],
    // Capture also receives element blurs (an inert pricing layer drops focus
    // mid-trip); only the window losing focus releases ownership.
    [view, "blur", event => { if (event.target === view) reset(event); }], [reduced, "change", reset],
  ];
  const options = { passive: true, capture: true };
  const ownership = { passive: false, capture: true }; // preventDefault needs an active listener.
  document.addEventListener("wheel", ownWheel, ownership); // Registered first: runs before `wheel`.
  for (const [target, type, handler] of listeners)
    target.addEventListener(type, handler, type === "touchmove" || type === "touchend" ? ownership : options);
  syncTouchLock();
  if (diagnostics) report("installed", null);
  return {
    isNavigationCurrent,
    cancel(source) {
      // A layout/navigation invalidation cancels the old destination, but it
      // cannot end a physical contact or renegotiate the browser's pan policy.
      if (touching) {
        cancel(source); readingGuard = null; touchY = null; touchStart = null;
      } else reset(source);
    },
    syncTouchLock: () => syncTouchLock(true),
    setTouchSuppressed(suppressed) {
      touchSuppressed = Boolean(suppressed);
      syncTouchLock(true);
    },
    dispose() {
      reset("dispose");
      disposed = true;
      document.removeEventListener("wheel", ownWheel, ownership);
      for (const [target, type, handler] of listeners)
        target.removeEventListener(type, handler, type === "touchmove" || type === "touchend" ? ownership : options);
      cinematicMain?.classList?.remove("cinematic-touch-lock");
      cinematicMain?.classList?.remove("cinematic-pricing-return");
      presentationRoot?.classList?.remove("cinematic-touch-lock");
      presentationRoot?.classList?.remove("cinematic-pricing-return");
      pricingScreenHost?.classList?.remove("cinematic-pricing-return");
      pricingActionsHost?.classList?.remove("cinematic-pricing-return");
    },
  };
}
