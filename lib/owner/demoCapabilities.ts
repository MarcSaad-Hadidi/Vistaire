import "server-only";

import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import { getDemoRestaurantId } from "@/lib/analytics/insights";
import {
  capabilityDeniedMessage,
  resolveRestaurantOwnerCapabilities,
  type RestaurantOwnerCapabilities
} from "./demoCapabilitiesCore";

export {
  capabilityDeniedMessage,
  resolveRestaurantOwnerCapabilities,
  type RestaurantOwnerCapabilities
} from "./demoCapabilitiesCore";

export const MAISON_ELYSE_SLUG = "maison-elyse" as const;

export function getMaisonElyseIdentity() {
  return {
    id: getDemoRestaurantId(),
    slug: MAISON_ELYSE_SLUG
  };
}

type CapabilityResult =
  | {
      ok: true;
      restaurantId: string;
      slug: string;
      status: string;
      capabilities: RestaurantOwnerCapabilities;
    }
  | { ok: false; status: 400 | 404 | 503; error: string };

/** Resolve capabilities from the restaurant row loaded by the server. */
export async function resolveOwnerRestaurantCapabilities(
  restaurantId: string
): Promise<CapabilityResult> {
  const id = restaurantId.trim();
  if (!id) return { ok: false, status: 400, error: "Restaurant requis." };

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return { ok: false, status: 503, error: "Supabase admin indisponible." };
  }

  const { data, error } = await admin.client
    .from("restaurants")
    .select("id,slug,status")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 503, error: "Restaurant impossible à vérifier." };
  }
  if (!data || typeof data.id !== "string") {
    return { ok: false, status: 404, error: "Restaurant introuvable." };
  }

  const slug = typeof data.slug === "string" ? data.slug.trim() : "";
  const status = typeof data.status === "string" ? data.status.trim() : "";
  return {
    ok: true,
    restaurantId: data.id,
    slug,
    status,
    capabilities: resolveRestaurantOwnerCapabilities(
      { id: data.id, slug, status },
      getMaisonElyseIdentity()
    )
  };
}

export async function requireOwnerRestaurantCapability(
  restaurantId: string,
  capability: keyof RestaurantOwnerCapabilities
): Promise<
  | { ok: true; resolved: Extract<CapabilityResult, { ok: true }> }
  | { ok: false; status: 400 | 403 | 404 | 503; error: string }
> {
  const resolved = await resolveOwnerRestaurantCapabilities(restaurantId);
  if (!resolved.ok) return resolved;
  if (!resolved.capabilities[capability]) {
    return { ok: false, status: 403, error: capabilityDeniedMessage(capability) };
  }
  return { ok: true, resolved };
}
