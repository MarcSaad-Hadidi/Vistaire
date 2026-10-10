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
const smooth = (value) => {
  const t = unit(value);
  return t * t * (3 - 2 * t);
};
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

/** Reuse measured sticky travel; spend existing tail/head space on the blend.
 * The opening's 1.5-screen phone hold is never borrowed. Pricing and the final
 * footer must arrive at their DOM boundary, before the room is covered/finished.
 */
export function measureChapterTransitions(measurements, opening) {
  return measurements.slice(2, -1).map((from, index) => {
    const to = measurements[index + 3];
    const fromOpening = from.id === "wearable";
    const release = fromOpening ? opening.top + opening.travel : from.top + from.travel;
    const tail = fromOpening ? 0 : Math.min(from.travel * 0.25, opening.stageHeight * 0.65);
    const head = ["open-weight", "footer"].includes(to.id)
      ? 0 : Math.min(to.travel * 0.2, opening.stageHeight * 0.45);
    return { from, to, fromOpening, start: release - tail, end: to.top + head };
  });
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
  if (!transition) return baseComposition({ ...state, progress: smooth(state.progress) }, mobile);
  const from = baseComposition(
    {
      ...state,
      transition: null,
      section: transition.from,
      progress: smooth(transition.fromProgress ?? 1),
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
      progress: smooth(transition.toProgress ?? 0),
      openingProgress: null,
    },
    mobile,
  );
  return interpolatePose(from, to, smooth(transition.progress));
}

function chapterCoordinate(section, progress) {
  const index = Math.max(0, CHAPTERS.indexOf(section));
  return Math.min(CHAPTERS.length - 1, index + smooth(progress) * 0.25);
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
    return p < 0.56 ? smooth(p / 0.56) : 1 + smooth((p - 0.56) / 0.44);
  }
  return chapterCoordinate(state.section, state.progress);
}
