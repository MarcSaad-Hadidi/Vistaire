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
 * state.transition = { from, to, progress, fromProgress: 1, toProgress: 0,
 *                      fromOpening: false }
 *
 * The caller measures transition progress from scroll; this module keeps no
 * direction or elapsed-time state, so reversing scroll follows the same poses.
 * Opening choreography remains owned by baseComposition(state, mobile).
 */
export function continuousComposition(state, mobile, baseComposition) {
  const transition = state.transition;
  if (!transition) return baseComposition(state, mobile);
  const from = baseComposition(
    {
      ...state,
      transition: null,
      section: transition.from,
      progress: unit(transition.fromProgress ?? 1),
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
      progress: unit(transition.toProgress ?? 0),
      openingProgress: null,
    },
    mobile,
  );
  return interpolatePose(from, to, smooth(transition.progress));
}

function chapterCoordinate(section, progress) {
  const index = Math.max(0, CHAPTERS.indexOf(section));
  return Math.min(CHAPTERS.length - 1, index + unit(progress) * 0.25);
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
  if (state.openingProgress != null) return unit(state.openingProgress) * 2;
  return chapterCoordinate(state.section, state.progress);
}
