import { useEffect, useState } from "react";

// The visitor inputs that scroll the journey: wheel, touch drags and scroll keys
// outside focused controls (Space activates a button or summary) and
// self-scrolling overlays (mobile menu, dialog). Self-contained: its source also
// runs inline before hydration (EARLY_SCROLL_HOLD).
function holdInput(event) {
  // The native scrollbar scrolls without a cancelable input: while it is
  // pressed, scrolling returns to where it started (anchors still land).
  if (event.type === "pointerdown" || event.type === "pointerup") {
    const root = document.documentElement;
    globalThis.__vistaireScrollbarY = event.type === "pointerdown" && event.target === root &&
      event.clientX >= root.clientWidth ? scrollY : undefined;
    return;
  }
  if (event.type === "scroll") {
    if (globalThis.__vistaireScrollbarY !== undefined) scrollTo(0, globalThis.__vistaireScrollbarY);
    return;
  }
  if (event.type === "keydown") {
    if (![" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "End", "Home"].includes(event.key)) return;
    if (event.target.closest?.("input, textarea, select, button, summary, audio, video, [contenteditable], " +
      "[role=button], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], " +
      "[role=option], [role=slider], [role=spinbutton], [role=combobox], [role=listbox], [role=textbox]")) return;
  } else if (event.type !== "wheel" && event.type !== "touchmove") return;
  for (let el = event.target; el instanceof Element && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) return;
  }
  globalThis.__vistaireIntent = true;
  event.preventDefault();
}
const HELD_INPUTS = ["wheel", "touchmove", "keydown", "pointerdown", "pointerup", "scroll"];
// One listener from the HTML parse to the ready scene: hydration adopts the
// inline one, so releasing it removes both.
const heldListener = () => (globalThis.__vistaireHoldInput ??= holdInput);
// Rendered inline by pages with a scene: scrolling waits before hydration too.
export const EARLY_SCROLL_HOLD = `window.__vistaireHoldInput=${holdInput};` +
  `${JSON.stringify(HELD_INPUTS)}.forEach(t=>addEventListener(t,__vistaireHoldInput,{passive:false}));` +
  `window.__vistaireHoldTimer=setTimeout(()=>${JSON.stringify(HELD_INPUTS)}.forEach(t=>removeEventListener(t,__vistaireHoldInput)),20000);` +
  // A tap before hydration is an intent too; the scene then starts at mount.
  `["pointerdown","touchstart"].forEach(t=>addEventListener(t,()=>{window.__vistaireIntent=true},{passive:true,once:true}))`;

// Give input and painting a turn between the expensive WebGL setup stages.
export function yieldToMainThread() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
  return new Promise(resolve => setTimeout(resolve, 0));
}

// three 0.183's compileAsync polls disposed materials; poll only live programs.
async function programsReady(renderer, stopped) {
  while (!stopped() && renderer.info.programs.some(program => !program.isReady()))
    await new Promise(resolve => setTimeout(resolve, 16));
  return !stopped();
}

export function prepareSceneShaders(renderer, scene, camera, stopped) {
  renderer.compile(scene, camera);
  return programsReady(renderer, stopped);
}

// PMREMGenerator.fromScene otherwise waits for its shader links synchronously.
// shortcut: uses PMREMGenerator internals of the pinned three 0.183; recheck on upgrade.
export function prepareEnvironmentShaders(renderer, pmrem, environment, camera, stopped) {
  pmrem._setSize(256);
  const target = pmrem._allocateTargets();
  const { toneMapping } = renderer;
  renderer.toneMapping = 0; // NoToneMapping, as fromScene renders.
  renderer.setRenderTarget(target);
  try {
    renderer.compile(environment, camera);
    const filter = pmrem._lodMeshes[0];
    for (const material of [pmrem._blurMaterial, pmrem._ggxMaterial]) {
      filter.material = material;
      renderer.compile(filter, camera);
    }
  } finally {
    renderer.toneMapping = toneMapping;
    renderer.setRenderTarget(null);
    target.dispose();
  }
  return programsReady(renderer, stopped);
}

// The poster is presented first; the models then download (network only) and
// the scene's main-thread setup waits for a visitor input or a quiet spell, so
// it never lands in the page's first seconds. Scrolling waits at the opening
// meanwhile (useScrollHold).
// A frame callback is not enough: WebGL work can delay presenting that frame.
const INPUTS = ["pointerdown", "touchstart", "wheel", "keydown", "scroll"];
// Lab traces end ~2.5 s after the first paint on a quiet page; 4 s keeps a margin.
const QUIET_SPELL_MS = 4000;
export function useDeferredScene(prefetch) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    let idle;
    let timer;
    let painted;
    let fetched = false;
    const download = () => {
      if (!fetched) prefetch();
      fetched = true;
    };
    const stop = () => {
      painted?.disconnect();
      clearTimeout(timer);
      if (idle !== undefined) cancelIdleCallback(idle);
      INPUTS.forEach(name => removeEventListener(name, start));
      removeEventListener("load", schedule);
    };
    const start = () => {
      stop();
      download();
      setStarted(true);
    };
    const afterPaint = () => {
      painted?.disconnect();
      download();
      timer = setTimeout(() => {
        if (typeof requestIdleCallback === "function") idle = requestIdleCallback(start, { timeout: 2000 });
        else start();
      }, QUIET_SPELL_MS);
    };
    const schedule = () => {
      if (!globalThis.PerformanceObserver?.supportedEntryTypes?.includes("paint")) return afterPaint();
      painted = new PerformanceObserver(list => {
        if (list.getEntries().some(entry => entry.name === "first-contentful-paint")) afterPaint();
      });
      painted.observe({ type: "paint", buffered: true });
    };
    // A restored or anchored scroll position is already past the opening, and
    // an input held before hydration (EARLY_SCROLL_HOLD) asked for the scene.
    if (scrollY > 0 || globalThis.__vistaireIntent) start();
    else {
      INPUTS.forEach(name => addEventListener(name, start, { passive: true }));
      if (document.readyState === "complete") schedule();
      else addEventListener("load", schedule, { once: true });
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the opening is fixed per page.
  }, []);
  return started;
}

// Until the scene is ready, scrolling waits at the opening: shots reached early
// showed objects without their room. Visitor inputs are held, not the page:
// overflow hidden would drop the desktop scrollbar and shift the layout, and
// the journey's own scrolls (anchors, chapter links) must still land. 20 s
// releases a load that never finishes. Returns whether scrolling is held (for
// the loading cue).
export function useScrollHold(active) {
  const [timedOut, setTimedOut] = useState(false);
  const holding = active && !timedOut;
  useEffect(() => {
    // The page's own timer replaces the inline one, which could otherwise
    // release a later page's hold after a client-side navigation.
    clearTimeout(globalThis.__vistaireHoldTimer);
    const release = () => {
      HELD_INPUTS.forEach(type => removeEventListener(type, heldListener()));
      globalThis.__vistaireScrollbarY = undefined;
    };
    if (!holding) return release();
    HELD_INPUTS.forEach(type => addEventListener(type, heldListener(), { passive: false }));
    const timer = setTimeout(() => setTimedOut(true), 20_000);
    return () => {
      clearTimeout(timer);
      release();
    };
  }, [holding]);
  return holding;
}
