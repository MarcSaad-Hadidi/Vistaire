import { studioEventDishId } from "./studioTemporalData.ts";
/** Counts only server-selected events; no raw event/session payload reaches the browser. */
export type StudioDishStatistics = {
  views: number;
  three: number;
  ar: number;
  previousViews: number | null;
  previousThree?: number | null;
  previousAr?: number | null;
  changeRate: number | null;
};
export function buildStudioDishStatistics(
  dishes: { id: string; slug: string; createdAt?: string | null }[],
  current: Record<string, unknown>[],
  previous: Record<string, unknown>[],
  evidenceSupported: boolean,
  comparisonSupported: boolean,
): Record<string, StudioDishStatistics> {
  if (!evidenceSupported) return {};
  const result: Record<string, StudioDishStatistics> = {};
  const previousDishEvidence = comparisonSupported && previous.some(event => ["dish_opened", "dish_3d_clicked", "dish_ar_clicked"].includes(String(event.event_name)));
  for (const dish of dishes)
    result[dish.id] = {
      views: 0,
      three: 0,
      ar: 0,
      previousViews: previousDishEvidence ? 0 : null,
      previousThree: previousDishEvidence ? 0 : null,
      previousAr: previousDishEvidence ? 0 : null,
      changeRate: null,
    };
  for (const event of current) {
    const id = studioEventDishId(event, dishes);
    if (!id) continue;
    if (event.event_name === "dish_opened") result[id].views++;
    if (event.event_name === "dish_3d_clicked") result[id].three++;
    if (event.event_name === "dish_ar_clicked") result[id].ar++;
  }
  if (previousDishEvidence)
    for (const event of previous) {
      const id = studioEventDishId(event, dishes);
      if (id && event.event_name === "dish_opened") result[id].previousViews!++;
      if (id && event.event_name === "dish_3d_clicked") result[id].previousThree!++;
      if (id && event.event_name === "dish_ar_clicked") result[id].previousAr!++;
    }
  for (const row of Object.values(result))
    row.changeRate = row.previousViews
      ? (row.views - row.previousViews) / row.previousViews
      : null;
  return result;
}
