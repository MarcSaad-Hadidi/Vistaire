/** Compare the exact rendered TRS contribution of the four direct Scene roots.
 * Only a root whose THREE scale components are exactly zero on both sides has
 * no rotational contribution. Raw input poses remain untouched in the report.
 * No camera, position, scale, visible quaternion or pixel tolerance is changed.
 * @param {Record<string, string>} left
 * @param {Record<string, string>} right
 */
export function zeroScaleEquivalentPoses(left, right) {
  const a = { pose: { ...left }, zeroScaleMatrices: {} };
  const b = { pose: { ...right }, zeroScaleMatrices: {} };
  const zero = value => typeof value === 'string' && value.split(',').length === 3 &&
    value.split(',').every(component => component.trim() !== '' && Number(component) === 0);
  for (const subject of ['dish', 'phone', 'support', 'laptop']) {
    if (!zero(left[`${subject}Scale`]) || !zero(right[`${subject}Scale`])) continue;
    for (const value of [a, b]) {
      const position = value.pose[`${subject}Position`]?.split(',').map(Number);
      if (position?.length !== 3 || !position.every(Number.isFinite)) continue;
      // Matrix4.compose(position, quaternion, [0,0,0]) has zero linear
      // columns for bounded Scene quaternions. Keep extreme finite values
      // exact too, because intermediate multiplication could overflow.
      const quaternion = value.pose[`${subject}Quaternion`]?.split(',').map(Number);
      if (quaternion?.length !== 4 || !quaternion.every(component => Number.isFinite(component) && Math.abs(component) <= 1)) continue;
      value.zeroScaleMatrices[subject] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...position, 1];
      delete value.pose[`${subject}Quaternion`];
    }
  }
  return [a, b];
}
