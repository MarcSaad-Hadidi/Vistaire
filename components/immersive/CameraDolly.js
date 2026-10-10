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

/** Minimum distance along an unchanged view ray that fits every world-space
 * corner inside the actual focus/scissor rectangle. Includes lens, aspect,
 * calibrated view offset and near-plane depth; never changes the food scale. */
export function minimumDollyDistance(points, position, look, frame) {
  const normalize = v => { const length = Math.hypot(...v) || 1; return v.map(n => n / length); };
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const direction = normalize(position.map((v, i) => v - look[i]));
  const right = normalize([direction[2], 0, -direction[0]]);
  const up = [direction[1] * right[2], direction[2] * right[0] - direction[0] * right[2], -direction[1] * right[0]];
  const tangent = Math.tan(frame.fov * Math.PI / 360);
  const width = frame.width * 0.94, height = frame.height * 0.94;
  let distance = frame.near * 2;
  for (const point of points) {
    const relative = point.map((v, i) => v - look[i]);
    const x = dot(relative, right), y = dot(relative, up), z = dot(relative, direction);
    const horizontal = Math.max(0.001, width + Math.sign(x) * 2 * (frame.shiftX || 0));
    const vertical = Math.max(0.001, height + Math.sign(y) * 2 * (frame.shiftY || 0));
    distance = Math.max(distance, z + Math.max(
      frame.near * 2, Math.abs(x) / (tangent * frame.aspect * horizontal), Math.abs(y) / (tangent * vertical),
    ));
  }
  return distance;
}
