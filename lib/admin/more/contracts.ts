import type { AdminRestaurantAccessResult } from "../accessCore.ts";
import type { AdminEvidenceBundle } from "../data/evidenceRegistry.ts";

export type MoreQualityState =
  | { kind: "ready"; completed: number; total: number }
  | { kind: "partial"; completed: number; total: number }
  | { kind: "unmeasured"; reason: "source-not-connected" }
  | { kind: "unavailable"; reason: "read-failed" | "not-applicable" };

export type AdminMoreRestaurantProfile = Readonly<{
  name: string;
  location?: string;
  cuisineType?: string;
  contactPhone?: string;
  contactEmail?: string;
  publicMenuPath?: string;
}>;

export type AdminMenuCompletionIssue = Readonly<{
  kind:
    | "menu-empty"
    | "menu-unpublished"
    | "qr-inactive"
    | "profile-field-missing"
    | "photo-missing"
    | "description-missing"
    | "allergens-unknown"
    | "translation-missing";
  dishName?: string;
  dishId?: string;
  field?: "location" | "cuisineType" | "contactPhone" | "contactEmail";
  locale?: string;
}>;

export type AdminMoreQualityCopy = Readonly<{
  title: string;
  description: string;
  statusTitle: string;
  qrTitle: string;
  contentTitle: string;
  experienceTitle: string;
  profileTitle: string;
  issuesTitle: string;
  supportTitle: string;
  supportBody: string;
  supportAction: string;
  noIssues: string;
  states: Readonly<{
    ready: string;
    partial: string;
    unmeasured: string;
    unavailable: string;
    notApplicable: string;
    sourceNotConnected: string;
  }>;
  labels: Readonly<Record<
    "qr" | "publication" | "photos" | "descriptions" | "allergens" | "translations" |
    "immersiveAssets" | "mobilePerformance" | "immersiveSuccess" | "assetErrors",
    string
  >>;
}>;

export type AdminMoreQualityModel = Readonly<{
  locale: "fr" | "en";
  qr: MoreQualityState;
  publication: MoreQualityState;
  photos: MoreQualityState;
  descriptions: MoreQualityState;
  allergens: MoreQualityState;
  translations: MoreQualityState;
  immersiveAssets: MoreQualityState;
  mobilePerformance: MoreQualityState;
  immersiveSuccess: MoreQualityState;
  assetErrors: MoreQualityState;
  profile: AdminMoreRestaurantProfile;
  completionIssues: readonly AdminMenuCompletionIssue[];
  copy: AdminMoreQualityCopy;
}>;

export type MoreQualityDish = Readonly<{
  id: string;
  name: string;
  hasPhoto: boolean;
  hasDescription: boolean;
  allergenStatus: "declared" | "unknown";
  hasImmersiveAsset: boolean;
}>;

export type MoreQualityTranslation = Readonly<{
  dishId: string;
  locale: string;
  status: string;
}>;

export type MoreQualityBuildInput = Readonly<{
  locale: "fr" | "en";
  profile: AdminMoreRestaurantProfile;
  menu:
    | { status: string; defaultLocale: string; supportedLocales: readonly string[] }
    | { readFailed: true };
  qr: { active: number; total: number } | { readFailed: true };
  dishes: { ok: true; items: readonly MoreQualityDish[] } | { ok: false; reason: "read-failed" };
  translations: { ok: true; rows: readonly MoreQualityTranslation[] } | { ok: false; reason: "read-failed" };
}>;

export type GrantedAdminAccess = Extract<AdminRestaurantAccessResult, { ok: true }>;

export type AdminMoreQualityLoadInput = Readonly<{
  access: GrantedAdminAccess;
  bundle: AdminEvidenceBundle;
  locale?: "fr" | "en";
}>;

export type AdminMoreQualityLoadResult =
  | { ok: true; model: AdminMoreQualityModel }
  | { ok: false; error: { code: "configuration" | "query" | "scope-integrity"; retryable: boolean } };
