import * as THREE from "three";

// Scene coordinates, independent of the original table's orientation.
export const TABLE_PRESENTATION_PLACEMENTS = Object.freeze({
  placeSetting: [-1.95, 0.01, -0.7],
});

export function arrangePresentationTable(table) {
  // These donor decorations float away from the table during product poses.
  // Omit them from this presentation so they cannot cross the animated models.
  table.accessories.lamp.visible = false;
  table.accessories.glass.visible = false;
  const point = new THREE.Vector3();
  table.group.updateWorldMatrix(true, true);
  for (const [id, placement] of Object.entries(TABLE_PRESENTATION_PLACEMENTS)) {
    point.fromArray(placement);
    point.y += table.metadata.surfaceY;
    table.accessories[id].position.copy(table.group.worldToLocal(point));
  }
  table.group.updateWorldMatrix(true, true);
  const settingBounds = new THREE.Box3();
  const subjectBounds = new THREE.Box3();

  // A food scan already contains its own plate. Remove the empty donor setting
  // only while it would intersect an animated product, including transitions.
  return (subjects) => {
    settingBounds.setFromObject(table.accessories.placeSetting);
    settingBounds.expandByScalar(0.06);
    const clear = subjects.every((subject) => {
      if (!subject?.visible || !subject.children.length) return true;
      subject.updateWorldMatrix(true, true);
      subjectBounds.setFromObject(subject);
      return !settingBounds.intersectsBox(subjectBounds);
    });
    table.accessories.placeSetting.visible = clear;
  };
}
