import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";

function getString(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function revalidateOwnerMenuMutationPaths(args: {
  client: SupabaseClient;
  restaurantId: string;
  dishSlug?: string;
}) {
  const restaurant = await args.client
    .from("restaurants")
    .select("slug,name")
    .eq("id", args.restaurantId)
    .maybeSingle();
  if (restaurant.error || !restaurant.data) return;

  const restaurantSlug =
    getString(restaurant.data, "slug") ||
    slugifyRestaurantSlug(getString(restaurant.data, "name"));
  if (!restaurantSlug) return;

  revalidatePath(`/menu/${restaurantSlug}`);
  const dishSlug = slugifyRestaurantSlug(args.dishSlug ?? "");
  if (dishSlug) {
    revalidatePath(`/menu/${restaurantSlug}/dishes/${dishSlug}`);
  }
}
