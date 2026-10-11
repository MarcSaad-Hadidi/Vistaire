/** Counts only server-selected events; no raw event/session payload reaches the browser. */
export type StudioDishStatistics = {
  views: number;
  three: number;
  ar: number;
  previousViews: number | null;
  changeRate: number | null;
};
export function buildStudioDishStatistics(
  dishes: { id: string; slug: string }[],
  current: Record<string, unknown>[],
  previous: Record<string, unknown>[],
  evidenceSupported: boolean,
  comparisonSupported: boolean,
): Record<string, StudioDishStatistics> {
  if (!evidenceSupported) return {};
  const result: Record<string, StudioDishStatistics> = {};
  const bySlug = new Map(dishes.map((dish) => [dish.slug, dish.id]));
  for (const dish of dishes)
    result[dish.id] = {
      views: 0,
      three: 0,
      ar: 0,
      previousViews: comparisonSupported ? 0 : null,
      changeRate: null,
    };
  for (const event of current) {
    const id =
      typeof event.dish_slug === "string"
        ? bySlug.get(event.dish_slug)
        : undefined;
    if (!id) continue;
    if (event.event_name === "dish_opened") result[id].views++;
    if (event.event_name === "dish_3d_clicked") result[id].three++;
    if (event.event_name === "dish_ar_clicked") result[id].ar++;
  }
  if (comparisonSupported)
    for (const event of previous) {
      const id =
        typeof event.dish_slug === "string"
          ? bySlug.get(event.dish_slug)
          : undefined;
      if (id && event.event_name === "dish_opened") result[id].previousViews!++;
    }
  for (const row of Object.values(result))
    row.changeRate = row.previousViews
      ? (row.views - row.previousViews) / row.previousViews
      : null;
  return result;
}
