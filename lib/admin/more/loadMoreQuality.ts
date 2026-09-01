import type {
  AdminMoreQualityLoadInput,
  AdminMoreQualityLoadResult,
  MoreQualityDish,
  MoreQualityTranslation
} from "./contracts.ts";
import { buildMoreQuality } from "./buildMoreQuality.ts";
import { normalizePublicMenuSettings } from "../../menu/publicMenuSettings.ts";

type ReadError = { ok: false; code?: "configuration" | "query" | "scope-integrity"; retryable?: boolean };
type ProfileRead = ReadError | { ok: true; profile: { restaurantId: string; name: string; slug: string; location?: string; cuisineType?: string; contactPhone?: string; contactEmail?: string } | null };
type MenuRead = ReadError | { ok: true; menu: { restaurantId: string; menuId: string; status: string; settingsJson: unknown } | null };
type QrRead = ReadError | { ok: true; rows: readonly { restaurantId: string; id: string; status: string }[] };
type DishRead = ReadError | { ok: true; rows: readonly (MoreQualityDish & { restaurantId: string; menuId: string })[] };
type TranslationRead = ReadError | { ok: true; rows: readonly (MoreQualityTranslation & { restaurantId: string; menuId: string })[] };

export type MoreQualityDependencies = Readonly<{
  readProfile: (input: { restaurantId: string }) => Promise<ProfileRead>;
  readMenu: (input: { restaurantId: string; menuId: string }) => Promise<MenuRead>;
  readQr: (input: { restaurantId: string; qrId: string | null }) => Promise<QrRead>;
  readDishes: (input: { restaurantId: string; menuId: string }) => Promise<DishRead>;
  readTranslations: (input: { restaurantId: string; menuId: string }) => Promise<TranslationRead>;
}>;

type LoadError = Extract<AdminMoreQualityLoadResult, { ok: false }>["error"];
const failed = (error: LoadError): AdminMoreQualityLoadResult => ({ ok: false, error });

export async function loadMoreQualityDataWithDependencies(
  input: AdminMoreQualityLoadInput,
  dependencies: MoreQualityDependencies
): Promise<AdminMoreQualityLoadResult> {
  const { access, bundle } = input;
  if (bundle.scope.source !== "production" || bundle.scope.restaurantId !== access.restaurantId || !bundle.scope.menuId) {
    return failed({ code: "scope-integrity", retryable: false });
  }
  const restaurantId = access.restaurantId;
  const menuId = bundle.scope.menuId;
  const [profileRead, menuRead, qrRead, dishRead, translationRead] = await Promise.all([
    dependencies.readProfile({ restaurantId }),
    dependencies.readMenu({ restaurantId, menuId }),
    dependencies.readQr({ restaurantId, qrId: access.qrId }),
    dependencies.readDishes({ restaurantId, menuId }),
    dependencies.readTranslations({ restaurantId, menuId })
  ]);

  if (!profileRead.ok) return failed({ code: profileRead.code ?? "query", retryable: profileRead.retryable ?? true });
  if (!profileRead.profile || profileRead.profile.restaurantId !== restaurantId || !profileRead.profile.name.trim()) {
    return failed({ code: "scope-integrity", retryable: false });
  }
  const scoped = <T extends { restaurantId: string; menuId?: string }>(rows: readonly T[]) => rows.every((row) =>
    row.restaurantId === restaurantId && (row.menuId === undefined || row.menuId === menuId)
  );
  if ((menuRead.ok && menuRead.menu && (menuRead.menu.restaurantId !== restaurantId || menuRead.menu.menuId !== menuId)) ||
      (qrRead.ok && !scoped(qrRead.rows)) || (dishRead.ok && !scoped(dishRead.rows)) ||
      (translationRead.ok && !scoped(translationRead.rows))) {
    return failed({ code: "scope-integrity", retryable: false });
  }

  const menu = menuRead.ok && menuRead.menu
    ? (() => {
        const settings = normalizePublicMenuSettings(menuRead.menu.settingsJson);
        return { status: menuRead.menu.status, defaultLocale: settings.defaultLocale, supportedLocales: settings.supportedLocales };
      })()
    : { readFailed: true as const };
  const qrRows = qrRead.ok ? qrRead.rows : [];
  const activeQrRows = qrRows.filter((row) => row.status === "active" && (!access.qrId || row.id === access.qrId));
  const qr = qrRead.ok
    ? { active: activeQrRows.length, total: qrRows.length }
    : { readFailed: true as const };
  const slug = profileRead.profile.slug.trim();
  const publicMenuPath = slug ? `/menu/${encodeURIComponent(slug)}` : undefined;

  return {
    ok: true,
    model: buildMoreQuality({
      locale: input.locale ?? "fr",
      profile: {
        name: profileRead.profile.name.trim(),
        ...(profileRead.profile.location?.trim() ? { location: profileRead.profile.location.trim() } : {}),
        ...(profileRead.profile.cuisineType?.trim() ? { cuisineType: profileRead.profile.cuisineType.trim() } : {}),
        ...(profileRead.profile.contactPhone?.trim() ? { contactPhone: profileRead.profile.contactPhone.trim() } : {}),
        ...(profileRead.profile.contactEmail?.trim() ? { contactEmail: profileRead.profile.contactEmail.trim() } : {}),
        ...(publicMenuPath ? { publicMenuPath } : {})
      },
      menu,
      qr,
      dishes: dishRead.ok ? { ok: true, items: dishRead.rows } : { ok: false, reason: "read-failed" },
      translations: translationRead.ok ? { ok: true, rows: translationRead.rows } : { ok: false, reason: "read-failed" }
    })
  };
}

export async function loadMoreQualityData(input: AdminMoreQualityLoadInput): Promise<AdminMoreQualityLoadResult> {
  const repository = await import("./repository.ts");
  return loadMoreQualityDataWithDependencies(input, repository);
}
