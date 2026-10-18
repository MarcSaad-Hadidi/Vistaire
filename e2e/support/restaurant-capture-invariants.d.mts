type RenderedPoseInvariant = {
  pose: Record<string, string>;
  zeroScaleMatrices: Record<string, number[]>;
};
export function zeroScaleEquivalentPoses(
  left: Record<string, string>, right: Record<string, string>,
): [RenderedPoseInvariant, RenderedPoseInvariant];
