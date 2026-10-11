// Explicit, local-only Safari investigation. No work occurs before start().
const number = value => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const text = value => typeof value === "string" ? value.slice(0, 160) : null;
const boolean = value => value === "true" ? true : value === "false" ? false : null;

export function createPerformanceCapture({ view, onFinish, readState = () => ({}), durationMs = 20_000, maxSamples = 5_000 }) {
  const duration = Math.max(1, Math.min(30_000, number(durationMs) || 20_000));
  const limit = Math.max(1, Math.min(5_000, Math.floor(number(maxSamples) || 5_000)));
  let disposed = false, active = false, frame = 0, timer = 0;
  let canvas, started, previous, previousFrame, report;
  function boundary() {
    const current = view.document.querySelector(".scene-canvas");
    const rect = current?.getBoundingClientRect();
    return {
      at: view.performance.now() - started,
      visibility: view.document.hidden ? "hidden" : "visible",
      nativeDPR: number(view.devicePixelRatio),
      viewportResizes: number(current?.dataset.viewportResizes),
      ready: current?.dataset.ready === "true",
      fallback: Boolean(view.document.querySelector(".world")?.classList?.contains("world-fallback")),
      viewport: { width: number(view.innerWidth), height: number(view.innerHeight) },
      canvas: current ? {
        cssWidth: number(rect.width), cssHeight: number(rect.height),
        width: current.width, height: current.height,
        pixelRatioX: rect.width ? current.width / rect.width : null,
        pixelRatioY: rect.height ? current.height / rect.height : null,
      } : null,
    };
  }
  function cleanup() {
    active = false;
    view.cancelAnimationFrame(frame); view.clearTimeout(timer);
    frame = 0; timer = 0;
    view.document.removeEventListener("visibilitychange", visibility);
    view.removeEventListener("pagehide", pagehide);
  }
  function finish(reason) {
    if (!active) return;
    cleanup();
    const ended = view.performance.now();
    const result = {
      ...report, reason, complete: reason === "duration",
      durationMs: ended - started,
      firstRAFDelayMs: report.samples[0]?.at ?? null,
      timeSinceLastRAFMs: previous == null ? null : ended - previous,
      pendingFirstRAFWaitMs: previous == null ? ended - started : null,
      deadlineOverrunMs: Math.max(0, ended - started - duration),
      end: boundary(), overflow: reason === "sample-limit",
    };
    report = null; canvas = null;
    onFinish(result);
  }
  function visibility() { if (view.document.hidden) finish("hidden"); }
  function pagehide() { finish("pagehide"); }
  function sample(frameTime) {
    const now = view.performance.now();
    frame = 0;
    if (!active) return;
    if (view.document.hidden) { finish("hidden"); return; }
    const data = canvas?.isConnected !== false ? canvas?.dataset : null;
    const state = readState() || {};
    report.samples.push({
      at: now - started, frameTimestampMs: frameTime - started,
      intervalMs: previousFrame == null ? null : frameTime - previousFrame,
      deliveryIntervalMs: previous == null ? null : now - previous,
      afterDeadline: now - started >= duration,
      targetScrollDistance: number(state.scrollDistance),
      scene: data ? {
        frames: number(data.frames), renderCPUms: number(data.renderCPUms),
        section: text(data.section), progress: number(data.progress),
        settled: boolean(data.settled), suspended: boolean(data.suspended),
        model: text(data.model), renderedModel: text(data.renderedModel),
        loadingModel: text(data.loadingModel), modelError: Boolean(data.modelError),
        drawCalls: number(data.drawCalls), triangles: number(data.triangles),
        viewportResizes: number(data.viewportResizes),
      } : null,
    });
    previous = now; previousFrame = frameTime;
    if (now - started >= duration) { finish("duration"); return; }
    if (report.samples.length >= limit) { finish("sample-limit"); return; }
    frame = view.requestAnimationFrame(sample);
  }
  function cancel() {
    cleanup(); report = null; canvas = null;
  }
  return {
    start() {
      if (disposed || active || view.document.hidden) return false;
      started = view.performance.now(); previous = null; previousFrame = null;
      canvas = view.document.querySelector(".scene-canvas");
      report = {
        schema: 1, startedAt: new Date().toISOString(), requestedDurationMs: duration,
        metadata: {
          userAgent: String(view.navigator.userAgent || "").slice(0, 512),
        },
        method: "RAF timestamp intervals and actual callback delivery intervals, not physical display FPS. Scene counters are the last completed submission and may be unchanged across samples. No GPU time is measured. Time since the last RAF and deadline overrun are pending delivery observations, not completed RAF intervals. Capture itself adds bounded sampling work.",
        start: boundary(), samples: [],
      };
      active = true;
      view.document.addEventListener("visibilitychange", visibility);
      view.addEventListener("pagehide", pagehide);
      timer = view.setTimeout(() => finish("duration"), duration);
      frame = view.requestAnimationFrame(sample);
      return true;
    },
    stop() { finish("manual"); }, cancel,
    dispose() { disposed = true; cancel(); },
  };
}
