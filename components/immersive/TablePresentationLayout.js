export function arrangePresentationTable(table) {
  // Keep the foreground tabletop empty: fixed plates, cutlery and decorative
  // props must never reappear between animated dish, phone or support poses.
  // The original room asset and the separately showcased dish are unchanged.
  for (const id of ["placeSetting", "lamp", "glass"]) {
    table.accessories[id].visible = false;
  }
}
