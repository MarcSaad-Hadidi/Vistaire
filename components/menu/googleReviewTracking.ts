"use client";

import {
  trackMenuEvent,
  trackPublicMenuEvent
} from "@/lib/analytics/client";
import type { PublicMenu } from "@/lib/menu/publicMenuCore";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TrackGoogleReviewClickInput = {
  dishSlug?: string;
  menuId?: string;
  restaurantId: string;
  source: PublicMenu["source"];
};

export function trackGoogleReviewClick({
  dishSlug,
  menuId,
  restaurantId,
  source
}: TrackGoogleReviewClickInput): void {
  if (!UUID_PATTERN.test(restaurantId)) return;

  const input = {
    eventName: "cta_clicked" as const,
    ctaName: "google_review",
    dishSlug,
    metadata: { destination: "google_review" }
  };
  if (source === "supabase") {
    trackPublicMenuEvent({ restaurantId, menuId, source }, input);
    return;
  }
  trackMenuEvent({ ...input, restaurantId, menuId, source: "demo" });
}
