import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import { revalidatePublicMenuCache } from "@/lib/menu/publicMenuCache";

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

  // Keep the inter-request public menu cache in sync with the path cache. The
  // route-handler invalidation expires tags immediately for read-your-writes;
  // no user/session state is included in these tags.
  await revalidatePublicMenuCache({
    slug: restaurantSlug,
    restaurantId: args.restaurantId
  });

  revalidatePath(`/menu/${restaurantSlug}`);
  const dishSlug = slugifyRestaurantSlug(args.dishSlug ?? "");
  if (dishSlug) {
    revalidatePath(`/menu/${restaurantSlug}/dishes/${dishSlug}`);
  }
}
