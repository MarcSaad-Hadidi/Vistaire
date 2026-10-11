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
const detailScreens = 1;
const readingHoldScreens = 2;
const readingActiveScreens = 3 * readingHoldScreens + 2 * detailScreens;
const readingSceneScreens = readingActiveScreens + 2 * edgeScreens;
const aiHoldScreens = 2;
export const SCROLL_PACE = Object.freeze({ min: 0.25, max: 4, step: 0.05, default: 1 });

export function normalizeScrollPace(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return SCROLL_PACE.default;
  const bounded = Math.max(SCROLL_PACE.min, Math.min(SCROLL_PACE.max, number));
  return Number((Math.round(bounded / SCROLL_PACE.step) * SCROLL_PACE.step).toFixed(2));
}

export const CINEMATIC_TIMING = Object.freeze({
  sceneScreens, activeScreens, transitionScreens, edgeScreens, detailScreens,
  chapterHeightVh: (sceneScreens + 1) * 100,
  readingHoldScreens, readingActiveScreens, readingSceneScreens,
  readingChapterHeightVh: (readingSceneScreens + 1) * 100,
  aiHoldScreens,
  openingMotionScreens: transitionScreens * 2 + aiHoldScreens,
  phoneHoldScreens: 1.5,
  openingReleaseScreens: edgeScreens,
});

/** Preview pace scales authored travel, not the physical sticky viewport.
 * All internal phase ratios stay identical to the published default. */
export function scaledCinematicTiming(distanceFactor = 1) {
  if (!Number.isFinite(distanceFactor) || distanceFactor <= 0 || distanceFactor === 1)
    return CINEMATIC_TIMING;
  const edge = edgeScreens * distanceFactor;
  const scene = sceneScreens * distanceFactor;
  const transition = 1 + 2 * edge;
  return Object.freeze({
    sceneScreens: scene,
    activeScreens: activeScreens * distanceFactor,
    transitionScreens: transition,
    edgeScreens: edge,
    detailScreens: detailScreens * distanceFactor,
    chapterHeightVh: (1 + scene) * 100,
    readingHoldScreens: readingHoldScreens * distanceFactor,
    readingActiveScreens: readingActiveScreens * distanceFactor,
    readingSceneScreens: readingSceneScreens * distanceFactor,
    readingChapterHeightVh: (1 + readingSceneScreens * distanceFactor) * 100,
    aiHoldScreens: aiHoldScreens * distanceFactor,
    openingMotionScreens: transition * 2 + aiHoldScreens * distanceFactor,
    phoneHoldScreens: CINEMATIC_TIMING.phoneHoldScreens * distanceFactor,
    openingReleaseScreens: edge,
  });
}

/** The discovery scene is a real reading interval between the two camera legs.
 * Copy, focus and the renderer consume this same reversible progress. */
export function openingProgressAtScroll(opening, y) {
  const distance = y - opening.top;
  const leg = (opening.motionTravel - opening.aiHoldTravel) / 2;
  if (distance <= leg) return unit(distance / leg) / 2;
  if (distance <= leg + opening.aiHoldTravel) return 0.5;
  return 0.5 + unit((distance - leg - opening.aiHoldTravel) / leg) / 2;
}

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
export function chapterNavigationTarget(chapter, stageHeight, timing = CINEMATIC_TIMING) {
  return chapter.top + (CHAPTERS.slice(3, 10).includes(chapter.id) ? timing.edgeScreens * stageHeight : 0);
}

/** Internal presentation settles before the shared exit starts. This prevents
 * a rotating chapter and its outgoing blend from accelerating each other. */
export function chapterPhase(section, progress) {
  if (!CHAPTERS.slice(3, 10).includes(section)) return unit(progress);
  const reading = section === "features" || section === "social-content";
  return unit((unit(progress) * (reading ? readingSceneScreens : sceneScreens) - edgeScreens)
    / (reading ? readingActiveScreens : activeScreens));
}

export function readingTiming() {
  const hold = readingHoldScreens;
  const phase = distance => (edgeScreens + distance) / readingSceneScreens;
  return {
    transitions: [[phase(hold), phase(hold + detailScreens)], [phase(2 * hold + detailScreens), phase(2 * (hold + detailScreens))]],
    centers: [phase(hold / 2), 0.5, phase(readingActiveScreens - hold / 2)],
  };
}
const readingTransitions = readingTiming().transitions;

/** The three cards and videos share holds, changes and selection ownership.
 * Text changes only at zero opacity; the rail is eased exactly once. */
export function readingPresentation(progress) {
  let position = 0, opacity = 1;
  for (const [start, end] of readingTransitions) {
    const phase = unit((progress - start) / (end - start));
    position += cinematicEase(phase);
    if (progress >= start && progress <= end) {
      const weights = cinematicCopyWeights(phase);
      opacity = weights.outgoing + weights.incoming;
    }
  }
  return { position, index: Math.min(2, Math.round(position)), opacity };
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
export function measureChapterTransitions(measurements, opening, timing = CINEMATIC_TIMING) {
  const distance = opening.stageHeight * timing.transitionScreens;
  let previousEnd = -Infinity;
  return measurements.slice(2, -1).map((from, index) => {
    const to = measurements[index + 3];
    const fromOpening = from.id === "wearable";
    const authoredEnd = to.top + (to.id === "footer" ? 0 : timing.edgeScreens * opening.stageHeight);
    const footer = measurements.at(-1);
    const end = to.id === "open-weight"
      ? Math.min(authoredEnd, (to.top + footer.top) / 2) : authoredEnd;
    // Natural pricing can be shorter than two slow preview joins. Reserve
    // space for its exit without moving the authored product departure or
    // adding scroll distance to the real pricing/footer content.
    const start = to.id === "footer" ? Math.max(end - distance, previousEnd) : authoredEnd - distance;
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

/** A preview pace change keeps the visible narrative sample. Natural content
 * takes priority as soon as it enters the viewport, including negative offsets. */
export function remapJourneyScroll(y, before, after) {
  const pricing = before.measurements.find(m => m.id === "open-weight");
  if (pricing && y + before.viewportHeight > pricing.top) {
    const footer = before.measurements.find(m => m.id === "footer");
    const anchor = footer && y >= footer.top ? footer : pricing;
    return after.measurements.find(m => m.id === anchor.id).top + y - anchor.top;
  }
  const productEntered = before.transitions.find(w => w.to.id === "product").end;
  if (y >= productEntered) {
    // Pricing can enter the live viewport before its cinematic join at fast
    // preview rates. Use the same fully-entered product anchor in both layouts.
    const nextEntered = after.transitions.find(w => w.to.id === "product").end;
    const oldVisible = pricing.top - before.viewportHeight;
    const newVisible = after.measurements.find(m => m.id === "open-weight").top - after.viewportHeight;
    return nextEntered + (y - productEntered) / (oldVisible - productEntered) * (newVisible - nextEntered);
  }
  const blend = transitionAtScroll(before.transitions, y);
  if (blend) {
    const next = after.transitions.find(w => w.from.id === blend.from && w.to.id === blend.to);
    return next.start + (next.end - next.start) * blend.progress;
  }
  const oldOpening = before.opening, newOpening = after.opening;
  if (y <= oldOpening.top + oldOpening.motionTravel) {
    const stops = opening => {
      const leg = (opening.motionTravel - opening.aiHoldTravel) / 2;
      return [opening.top, opening.top + leg, opening.top + leg + opening.aiHoldTravel, opening.top + opening.motionTravel];
    };
    const oldStops = stops(oldOpening), newStops = stops(newOpening);
    const segment = y <= oldStops[1] ? 0 : y <= oldStops[2] ? 1 : 2;
    const fraction = (y - oldStops[segment]) / (oldStops[segment + 1] - oldStops[segment]);
    return newStops[segment] + fraction * (newStops[segment + 1] - newStops[segment]);
  }
  if (y < before.transitions[0].start) {
    const fraction = (y - oldOpening.top - oldOpening.motionTravel)
      / (before.transitions[0].start - oldOpening.top - oldOpening.motionTravel);
    return newOpening.top + newOpening.motionTravel
      + fraction * (after.transitions[0].start - newOpening.top - newOpening.motionTravel);
  }
  const chapter = before.measurements.filter(m => y >= m.top).at(-1);
  const next = after.measurements.find(m => m.id === chapter.id);
  return next.top + (y - chapter.top) / chapter.travel * next.travel;
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
