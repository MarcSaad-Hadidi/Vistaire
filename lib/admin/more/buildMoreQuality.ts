import type {
  AdminMenuCompletionIssue,
  AdminMoreQualityModel,
  MoreQualityBuildInput,
  MoreQualityState
} from "./contracts.ts";
import { moreQualityCopy } from "./moreQualityCopy.ts";

const unmeasured = (): MoreQualityState => ({ kind: "unmeasured", reason: "source-not-connected" });
const unavailable = (reason: "read-failed" | "not-applicable"): MoreQualityState => ({ kind: "unavailable", reason });
const ratio = (completed: number, total: number): MoreQualityState => {
  if (total === 0) return unavailable("not-applicable");
  return completed === total ? { kind: "ready", completed, total } : { kind: "partial", completed, total };
};
const cleanProfile = (profile: MoreQualityBuildInput["profile"]) => Object.fromEntries(
  Object.entries(profile).filter(([, value]) => typeof value === "string" && value.trim())
) as MoreQualityBuildInput["profile"];

export function buildMoreQuality(input: MoreQualityBuildInput): AdminMoreQualityModel {
  const issues: AdminMenuCompletionIssue[] = [];
  const menuFailed = "readFailed" in input.menu;
  const qrFailed = "readFailed" in input.qr;
  const dishes = input.dishes.ok ? input.dishes.items : [];

  const publication = menuFailed
    ? unavailable("read-failed")
    : ratio(input.menu.status === "published" ? 1 : 0, 1);
  if (!menuFailed && input.menu.status !== "published") issues.push({ kind: "menu-unpublished" });

  const qr = qrFailed
    ? unavailable("read-failed")
    : ratio(input.qr.active, input.qr.total);
  if (!qrFailed && (input.qr.total === 0 || input.qr.active < input.qr.total)) issues.push({ kind: "qr-inactive" });

  let photos = unavailable("read-failed");
  let descriptions = unavailable("read-failed");
  let allergens = unavailable("read-failed");
  let immersiveAssets = unavailable("read-failed");
  let translations = unavailable("read-failed");

  if (input.dishes.ok) {
    if (dishes.length === 0) issues.push({ kind: "menu-empty" });
    photos = ratio(dishes.filter((dish) => dish.hasPhoto).length, dishes.length);
    descriptions = ratio(dishes.filter((dish) => dish.hasDescription).length, dishes.length);
    allergens = ratio(dishes.filter((dish) => dish.allergenStatus !== "unknown").length, dishes.length);
    immersiveAssets = ratio(dishes.filter((dish) => dish.hasImmersiveAsset).length, dishes.length);
    for (const dish of dishes) {
      if (!dish.hasPhoto) issues.push({ kind: "photo-missing", dishId: dish.id, dishName: dish.name });
      if (!dish.hasDescription) issues.push({ kind: "description-missing", dishId: dish.id, dishName: dish.name });
      if (dish.allergenStatus === "unknown") issues.push({ kind: "allergens-unknown", dishId: dish.id, dishName: dish.name });
    }

    if (!menuFailed && input.translations.ok) {
      const locales = [...new Set(input.menu.supportedLocales.filter(Boolean))];
      const translated = new Set(input.translations.rows
        .filter((row) => row.status === "up_to_date" || row.status === "source")
        .map((row) => `${row.dishId}\u0000${row.locale.toLowerCase()}`));
      let completed = 0;
      for (const dish of dishes) {
        for (const locale of locales) {
          const isSource = locale.toLowerCase() === input.menu.defaultLocale.toLowerCase();
          if (isSource || translated.has(`${dish.id}\u0000${locale.toLowerCase()}`)) completed += 1;
          else issues.push({ kind: "translation-missing", dishId: dish.id, dishName: dish.name, locale });
        }
      }
      translations = ratio(completed, dishes.length * locales.length);
    } else if (!input.translations.ok || menuFailed) {
      translations = unavailable("read-failed");
    }
  }

  const profile = cleanProfile(input.profile);
  for (const field of ["location", "cuisineType", "contactPhone", "contactEmail"] as const) {
    if (!profile[field]) issues.push({ kind: "profile-field-missing", field });
  }

  return Object.freeze({
    locale: input.locale,
    qr,
    publication,
    photos,
    descriptions,
    allergens,
    translations,
    immersiveAssets,
    mobilePerformance: unmeasured(),
    immersiveSuccess: unmeasured(),
    assetErrors: unmeasured(),
    profile,
    completionIssues: Object.freeze(issues),
    copy: moreQualityCopy(input.locale)
  });
}
