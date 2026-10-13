import { continuousComposition } from "./SceneDirector.js";

/** A zero-scale chapter has no visible orientation to travel toward. Keep the
 * subject's presented rotation during its reveal/hide, including user yaw and
 * flip. Translation and scale retain the shared C2 envelope, so the complete
 * world transform remains continuous when rotation resets at zero scale. */
export function sectionTransitionComposition(state, mobile, baseComposition) {
  if (!state.transition) return continuousComposition(state, mobile, baseComposition);

  // Reuse the two endpoint evaluations already needed for the authored blend.
  let from, to;
  const pose = continuousComposition(state, mobile, (sample, viewport) => {
    const endpoint = baseComposition(sample, viewport);
    if (!from) from = endpoint;
    else to = endpoint;
    return endpoint;
  });
  for (const name of ["dish", "support", "phone", "pdfPhone", "laptop"]) {
    const scale = `${name}Scale`;
    if (pose[scale] <= 0 || (from[scale] === 0) === (to[scale] === 0)) continue;
    const section = from[scale] === 0 ? state.transition.to : state.transition.from;
    const { x, y, width, height } = state.sceneFrames?.[section] || {};
    // A cropped/unknown frame cannot guarantee room for a different silhouette.
    // Use the stable endpoint frame, never a progress-dependent blended frame.
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0 ||
      x - width / 2 < 0 || x + width / 2 > 1 ||
      y - height / 2 < 0 || y + height / 2 > 1) continue;
    const visible = from[scale] === 0 ? to : from;
    pose[`${name}Rotation`] = [...visible[`${name}Rotation`]];
  }
  return pose;
}
