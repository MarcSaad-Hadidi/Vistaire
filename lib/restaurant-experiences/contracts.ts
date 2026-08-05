import type { Locale } from "@/lib/i18n";
import type { LandingMenuUiPreview } from "@/lib/landing/landingMenuUiPreview";
import type { UniqueMenuRendererKey } from "@/lib/menu/uniqueMenuRendererRegistry";
import type { PdfComparePreviewData } from "@/lib/pdfComparePreviewData";

export const RESTAURANT_EXPERIENCE_IDS = [
  "maison-elyse",
  "trouvable",
  "sauge-noire"
] as const;

export type RestaurantExperienceId =
  (typeof RESTAURANT_EXPERIENCE_IDS)[number];

export type RestaurantExperienceTab = {
  id: RestaurantExperienceId;
  name: "Maison Élyse" | "Trouvable" | "Sauge Noire";
};

export function isRestaurantExperienceId(
  value: string
): value is RestaurantExperienceId {
  return RESTAURANT_EXPERIENCE_IDS.includes(value as RestaurantExperienceId);
}

export type RestaurantMenuPreviewBase = {
  menuSlug: RestaurantExperienceId;
  restaurantId: string;
  menuId?: string;
  locale: Locale;
  publicMenuHref: `/menu/${string}`;
  comparison: PdfComparePreviewData;
  menuUi: LandingMenuUiPreview;
};

export type RestaurantMenuPreviewPayload =
  | (RestaurantMenuPreviewBase & {
      kind: "maison-elyse";
    })
  | (RestaurantMenuPreviewBase & {
      kind: "trouvable";
    })
  | (RestaurantMenuPreviewBase & {
      kind: "unique-registered";
      rendererKey: UniqueMenuRendererKey;
      rendererVersion: number;
    });

export function payloadMatchesExperience(
  payload: RestaurantMenuPreviewPayload,
  experienceId: RestaurantExperienceId
): boolean {
  if (payload.menuSlug !== experienceId) return false;

  if (experienceId === "maison-elyse") {
    return payload.kind === "maison-elyse";
  }
  if (experienceId === "trouvable") {
    return payload.kind === "trouvable";
  }
  return (
    payload.kind === "unique-registered" &&
    payload.rendererKey === "sauge-noire-book-v1" &&
    payload.rendererVersion === 1
  );
}
