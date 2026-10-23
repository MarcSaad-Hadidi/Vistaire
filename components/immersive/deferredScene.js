import { useEffect, useState } from "react";

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
// it never lands in the page's first seconds. Inputs are passive: never held.
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
    // A restored or anchored scroll position is already past the opening.
    if (scrollY > 0) start();
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
