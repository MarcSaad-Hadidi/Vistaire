const CHAPTERS = [
  "hero",
  "ai",
  "wearable",
  "features",
  "encryption",
  "grip",
  "sustainability",
  "testimonies",
  "social-content",
  "product",
  "open-weight",
  "footer",
];

const unit = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
// All distances use the frozen sticky stage, never the room's larger mobile
// canvas or elapsed time. Entry/exit share the same derived edge portion of each chapter.
const paceScale = 1.6;
const activeScreens = 2.5 * paceScale;
const transitionScreens = 2 * paceScale;
const edgeScreens = (transitionScreens - 1) / 2;
const sceneScreens = activeScreens + 2 * edgeScreens;
const detailScreens = 0.44 * paceScale;
export const CINEMATIC_TIMING = Object.freeze({
  sceneScreens, activeScreens, transitionScreens, edgeScreens, detailScreens,
  chapterHeightVh: (sceneScreens + 1) * 100,
  openingMotionScreens: transitionScreens * 2,
  phoneHoldScreens: 1.5,
  openingReleaseScreens: edgeScreens,
});

// C2 acceleration ramps, constant-speed middle half, zero endpoint velocity.
// Peak normalized speed is 4/3, rather than cubic smoothstep's 3/2. Apply once
// to a motion phase; do not smooth an already eased progress a second time.
export function cinematicEase(value) {
  const t = unit(value), ramp = 0.25;
  const enter = q => {
    const u = q / ramp;
    return ramp * (u ** 3 - 0.5 * u ** 4) / (1 - ramp);
  };
  return t < ramp ? enter(t) : t > 1 - ramp ? 1 - enter(1 - t)
    : (t - ramp / 2) / (1 - ramp);
}
// One shared text handoff: fade out, then fade in. Never superimpose
// different headings at 50% alpha in the same compensated viewport frame.
export function cinematicCopyWeights(progress) {
  return {
    outgoing: 1 - cinematicEase(progress * 2),
    incoming: cinematicEase(progress * 2 - 1),
  };
}
const smooth = cinematicEase;

/** Navigation presents the destination, rather than stopping midway through
 * its entrance with transparent/inert controls. Natural sections stay native. */
export function chapterNavigationTarget(chapter, stageHeight) {
  return chapter.top + (CHAPTERS.slice(3, 10).includes(chapter.id) ? edgeScreens * stageHeight : 0);
}

/** Internal presentation settles before the shared exit starts. This prevents
 * a rotating chapter and its outgoing blend from accelerating each other. */
export function chapterPhase(section, progress) {
  if (!CHAPTERS.slice(3, 10).includes(section)) return unit(progress);
  return unit((unit(progress) * sceneScreens - edgeScreens) / (sceneScreens - 2 * edgeScreens));
}

// Three existing feature cards exchange text at a fully transparent seam.
// Their two short detail changes use the same distance as the video rail moves.
export function featureTextOpacity(progress) {
  const phase = chapterPhase("features", progress);
  const distance = Math.min(Math.abs(phase - 1 / 3), Math.abs(phase - 2 / 3));
  return cinematicEase(distance * activeScreens / (detailScreens / 2));
}

export function socialTiming() {
  const hold = (activeScreens - 2 * detailScreens) / 3;
  const phase = distance => (edgeScreens + distance) / sceneScreens;
  return {
    transitions: [[phase(hold), phase(hold + detailScreens)], [phase(2 * hold + detailScreens), phase(2 * (hold + detailScreens))]],
    centers: [phase(hold / 2), 0.5, phase(activeScreens - hold / 2)],
  };
}
const lerp = (a, b, t) => (t === 0 ? a : t === 1 ? b : a + (b - a) * t);

export const DEFAULT_SCENE_FRAME = Object.freeze({ x: 0.5, y: 0.56, width: 0.8, height: 0.55 });

/** Text-only chapters still have a real fitted-camera frame. Blend to that
 * frame, not to a duplicated neighbor that would jump at the window edge. */
export function transitionSceneFrame(transition, frames) {
  const from = frames[transition.from] || DEFAULT_SCENE_FRAME;
  const to = frames[transition.to] || DEFAULT_SCENE_FRAME;
  const weight = smooth(transition.progress);
  return Object.fromEntries(Object.keys(DEFAULT_SCENE_FRAME).map(key => [
    key, lerp(from[key], to[key], weight),
  ]));
}

/** One measured common window at every cinematic join. Pricing stays in natural
 * flow: its incoming final edge portion is covered by the pricing surface; much of its
 * outgoing raccord is hidden behind that surface. The footer ends at its
 * real DOM boundary, so no cinematic tail is appended to the document. */
export function measureChapterTransitions(measurements, opening) {
  const distance = opening.stageHeight * transitionScreens;
  let previousEnd = -Infinity;
  return measurements.slice(2, -1).map((from, index) => {
    const to = measurements[index + 3];
    const fromOpening = from.id === "wearable";
    const end = to.top + (to.id === "footer" ? 0 : edgeScreens * opening.stageHeight);
    // On tall viewports natural pricing can be shorter than two joins. Its
    // opaque content must remain native: cap only this last raccord to real
    // available space rather than overlap poses or append an empty tail.
    const start = to.id === "footer" ? Math.max(end - distance, previousEnd) : end - distance;
    previousEnd = end;
    return { from, to, fromOpening, start, end };
  });
}

/** Cancel only the native stage's approach/release inside its visible blend.
 * The section's document geometry and native scroll distance never change. */
export function cinematicStageOffset(chapter, y, start, end) {
  const position = Math.max(start, Math.min(end, y));
  return position < chapter.top ? position - chapter.top
    : Math.max(0, position - chapter.top - chapter.travel);
}

/** Stateless sampling is identical for native wheel, touch, reverse and jumps. */
export function transitionAtScroll(windows, y) {
  const window = windows.find(({ start, end }) => y >= start && y <= end);
  if (!window) return null;
  const { from, to, start, end, fromOpening } = window;
  return {
    from: from.id, to: to.id, fromOpening,
    fromProgress: fromOpening ? 1 : unit((y - from.top) / from.travel),
    toProgress: unit((y - to.top) / to.travel),
    progress: unit((y - start) / Math.max(1, end - start)),
  };
}

/** Shape-preserving cubic slopes across the opening's calibrated camera poses.
 * Shared derivatives remove sample-to-sample velocity kinks; local extrema and
 * endpoints have zero slope, so fitting never overshoots an authored frame.
 */
export function interpolatePoseTrack(stops, poses, progress) {
  const p = unit(progress);
  const right = Math.max(1, stops.findIndex(stop => stop >= p));
  const left = right - 1;
  const span = stops[right] - stops[left];
  const t = unit((p - stops[left]) / span);
  const slope = (values, i) => {
    if (i === 0 || i === values.length - 1) return 0;
    const h0 = stops[i] - stops[i - 1], h1 = stops[i + 1] - stops[i];
    const d0 = (values[i] - values[i - 1]) / h0, d1 = (values[i + 1] - values[i]) / h1;
    if (d0 * d1 <= 0) return 0;
    const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / d0 + w1 / d1);
  };
  const valueAt = values => (2 * t ** 3 - 3 * t ** 2 + 1) * values[left]
    + (t ** 3 - 2 * t ** 2 + t) * span * slope(values, left)
    + (-2 * t ** 3 + 3 * t ** 2) * values[right]
    + (t ** 3 - t ** 2) * span * slope(values, right);
  return Object.fromEntries(Object.keys(poses[left]).map(key => {
    const value = poses[left][key];
    return [key, Array.isArray(value)
      ? value.map((_, i) => valueAt(poses.map(pose => pose[key][i])))
      : typeof value === "number" ? valueAt(poses.map(pose => pose[key]))
        : t < 1 ? value : poses[right][key]];
  }));
}

/**
 * Interpolate numeric pose values without changing either endpoint.
 * Discrete values retain the outgoing value until the incoming endpoint.
 * An unspecified dish opacity means a fully opaque dish, including at t=0/1.
 */
export function interpolatePose(a, b, progress) {
  const t = unit(progress);
  const from = { ...a, dishOpacity: a.dishOpacity ?? 1 };
  const to = { ...b, dishOpacity: b.dishOpacity ?? 1 };
  const pose = {};
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const left = from[key] ?? to[key];
    const right = to[key] ?? from[key];
    if (typeof left === "number" && typeof right === "number") {
      pose[key] = lerp(left, right, t);
    } else if (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length
    ) {
      pose[key] = left.map((value, i) =>
        typeof value === "number" && typeof right[i] === "number"
          ? lerp(value, right[i], t)
          : t < 1
            ? value
            : right[i],
      );
    } else {
      const value = t < 1 ? left : right;
      pose[key] = Array.isArray(value) ? [...value] : value;
    }
  }
  return pose;
}

/**
 * state.transition = { from, to, progress, fromProgress, toProgress,
 *                      fromOpening: false }
 *
 * The caller measures transition progress from scroll; this module keeps no
 * direction or elapsed-time state, so reversing scroll follows the same poses.
 * Opening choreography remains owned by baseComposition(state, mobile).
 */
export function continuousComposition(state, mobile, baseComposition) {
  const transition = state.transition;
  if (!transition) return baseComposition({ ...state, progress: smooth(chapterPhase(state.section, state.progress)) }, mobile);
  const from = baseComposition(
    {
      ...state,
      transition: null,
      section: transition.from,
      progress: smooth(chapterPhase(transition.from, transition.fromProgress ?? 1)),
      openingProgress:
        transition.from === "wearable" && transition.fromOpening ? 1 : null,
    },
    mobile,
  );
  const to = baseComposition(
    {
      ...state,
      transition: null,
      section: transition.to,
      progress: smooth(chapterPhase(transition.to, transition.toProgress ?? 0)),
      openingProgress: null,
    },
    mobile,
  );
  return interpolatePose(from, to, smooth(transition.progress));
}

function chapterCoordinate(section, progress) {
  const index = Math.max(0, CHAPTERS.indexOf(section));
  return Math.min(CHAPTERS.length - 1, index + smooth(chapterPhase(section, progress)) * 0.25);
}

/** A bounded fractional index usable by the room's twelve atmosphere poses. */
export function journeyCoordinate(state) {
  const transition = state.transition;
  if (transition) {
    const from =
      transition.from === "wearable" && transition.fromOpening
        ? 2
        : chapterCoordinate(transition.from, transition.fromProgress ?? 1);
    const to = chapterCoordinate(transition.to, transition.toProgress ?? 0);
    return lerp(from, to, smooth(transition.progress));
  }
  if (state.openingProgress != null) {
    const p = unit(state.openingProgress);
    return p < 0.5 ? smooth(p / 0.5) : 1 + smooth((p - 0.5) / 0.5);
  }
  return chapterCoordinate(state.section, state.progress);
}
