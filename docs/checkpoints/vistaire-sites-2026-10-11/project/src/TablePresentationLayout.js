// Presentation decorations never appear, including when a subject changes or
// leaves the table. Keep the return callback for the existing scene API.
export const TABLE_PRESENTATION_PLACEMENTS = Object.freeze({
  placeSetting: [-1.95, 0.01, -0.7],
});

export function arrangePresentationTable(table) {
  table.accessories.lamp.visible = false;
  table.accessories.glass.visible = false;
  table.accessories.placeSetting.visible = false;
  return () => {};
}
