import { useEffect, useState } from "react";

// Give input and painting a turn between the expensive WebGL setup stages.
export function yieldToMainThread() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Keep the poster's first paint ahead of model downloads, then prepare the
// scene at the first idle opportunity without waiting for a visitor gesture.
export function useDeferredScene(prefetch) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    let idle;
    let timer;
    const start = () => setStarted(true);
    const schedule = () => {
      prefetch();
      if (typeof requestIdleCallback === "function")
        idle = requestIdleCallback(start, { timeout: 500 });
      else timer = setTimeout(start, 0);
    };
    if (document.readyState === "complete") schedule();
    else addEventListener("load", schedule, { once: true });
    return () => {
      removeEventListener("load", schedule);
      if (idle !== undefined) cancelIdleCallback(idle);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the opening is fixed per page.
  }, []);
  return started;
}
