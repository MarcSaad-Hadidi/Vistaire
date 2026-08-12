import { availabilityCopy } from "./availabilityCopy.ts";
import type { AvailabilitySchedulingCapability } from "../../../lib/admin/availability/contracts.ts";

type Dish = Readonly<{ id: string; name: string; category: string; available: boolean }>;
type Item = Readonly<{ id: string; dishName: string; at: string; status?: string }>;

export function buildAvailabilityViewModel(input: { locale: "fr" | "en"; timezone: string; dishes: readonly Dish[]; capability: AvailabilitySchedulingCapability; history: readonly Item[]; schedules: readonly Item[] }) {
  const available = input.dishes.filter((dish) => dish.available).length;
  return { locale: input.locale, timezone: input.timezone, capability: input.capability, dishes: input.dishes, history: input.history, schedules: input.schedules, summary: { total: input.dishes.length, available, unavailable: input.dishes.length - available }, copy: availabilityCopy[input.locale] } as const;
}
