import { useEffect, useState } from "react";

const SCROLL_KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "End", "Home"]);
// The visitor inputs that scroll the journey: wheel, touch drags and scroll
// keys outside form fields.
export function isHeldScroll(event) {
  if (event.type === "keydown")
    return SCROLL_KEYS.has(event.key) && !event.target.closest?.("input, textarea, select, [contenteditable]");
  return event.type === "wheel" || event.type === "touchmove";
}

// A page paints its opening (still and copy) before any 3D work. The models
// download right after load (network only, `prefetch`), and the scene's
// main-thread setup starts on the visitor's first input or six seconds after
// load on idle, so it never lands in the page's first seconds. Returns whether
// the scene should be mounted.
export function useDeferredScene(prefetch) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    let timer;
    let idle;
    let fetched = false;
    const inputs = ["pointerdown", "touchstart", "wheel", "keydown", "scroll"];
    const fetchOnce = () => {
      if (fetched) return;
      fetched = true;
      prefetch();
    };
    const start = (event) => {
      stop();
      // The journey waits at the opening while the scene loads (useScrollHold):
      // the starting wheel or key does not scroll.
      if (event && isHeldScroll(event)) event.preventDefault();
      fetchOnce();
      setStarted(true);
    };
    const stop = () => {
      clearTimeout(timer);
      if (idle) cancelIdleCallback(idle);
      inputs.forEach((type) => removeEventListener(type, start));
      removeEventListener("load", schedule);
    };
    const schedule = () => {
      fetchOnce();
      timer = setTimeout(() => {
        if (typeof requestIdleCallback === "function") idle = requestIdleCallback(() => start(), { timeout: 2000 });
        else start();
      }, 6000);
    };
    // A restored or anchored scroll position is already past the opening.
    if (scrollY > 0) start();
    else {
      inputs.forEach((type) => addEventListener(type, start, { passive: type !== "wheel" }));
      if (document.readyState === "complete") schedule();
      else addEventListener("load", schedule);
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the opening is fixed per page.
  }, []);
  return started;
}

// While the scene loads, scrolling waits at the opening: shots reached early
// showed objects without their room. Visitor inputs are held, not the page:
// overflow hidden would drop the desktop scrollbar and shift the layout, and
// the journey's own scrolls (anchors, chapter links) must still land. 20 s
// releases a load that never finishes.
export function useScrollHold(active) {
  useEffect(() => {
    if (!active) return;
    const hold = (event) => { if (isHeldScroll(event)) event.preventDefault(); };
    const types = ["wheel", "touchmove", "keydown"];
    const release = () => types.forEach((type) => removeEventListener(type, hold));
    types.forEach((type) => addEventListener(type, hold, { passive: false }));
    const timer = setTimeout(release, 20_000);
    return () => { clearTimeout(timer); release(); };
  }, [active]);
}
