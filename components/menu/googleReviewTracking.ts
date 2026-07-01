"use client";

import { trackMenuEvent } from "@/lib/analytics/client";
import type { PublicMenu } from "@/lib/menu/publicMenuCore";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TrackGoogleReviewClickInput = {
  dishSlug?: string;
  restaurantId: string;
  source: PublicMenu["source"];
};

export function trackGoogleReviewClick({
  dishSlug,
  restaurantId,
  source
}: TrackGoogleReviewClickInput): void {
  if (!UUID_PATTERN.test(restaurantId)) return;

  trackMenuEvent({
    eventName: "cta_clicked",
    restaurantId,
    source: source === "supabase" ? "production" : "demo",
    ctaName: "google_review",
    dishSlug,
    metadata: {
      destination: "google_review"
    }
  });
}
