/** Move toward a target with a fixed lens, preserving the authored view ray. */
export function cameraDollyPose(position, look, ratio, minimumDistance = 0.1) {
  const direction = position.map((v, i) => v - look[i]);
  const baselineDistance = Math.hypot(...direction);
  const distance = Math.max(
    minimumDistance,
    baselineDistance / Math.max(0.01, ratio),
  );
  const factor = baselineDistance > 0 ? distance / baselineDistance : 0;
  return {
    camera: look.map((v, i) => v + direction[i] * factor),
    look: [...look],
    distance,
    baselineDistance,
  };
}
