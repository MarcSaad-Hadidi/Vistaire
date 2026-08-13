import { isCanonicalUuid } from "@/lib/owner/storageSafeIdentifier";
import type { DishPhotoDerivativeVariant } from "@/lib/owner/dishPhotoUpload";

const PHOTO_SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const LOCAL_ORIGIN = "https://admin-photo.vistaire.invalid";

export function buildAdminDishPhotoPath(
  dishId: string,
  options?: {
    assetVersion?: string;
    variant?: DishPhotoDerivativeVariant;
  }
): string {
  if (!isCanonicalUuid(dishId)) {
    throw new Error("Identifiant plat invalide.");
  }

  const basePath = `/admin/api/menu-dishes/${dishId}/photo`;
  const assetVersion = options?.assetVersion?.trim() ?? "";
  if (!assetVersion) {
    if (options?.variant) throw new Error("Version photo requise pour un derive.");
    return basePath;
  }
  if (!PHOTO_SHA256_PATTERN.test(assetVersion)) {
    throw new Error("Version photo invalide.");
  }
  const params = new URLSearchParams({ v: assetVersion.toLowerCase() });
  if (options?.variant) {
    if (options.variant !== "thumbnail" && options.variant !== "display") {
      throw new Error("Variante photo invalide.");
    }
    params.set("variant", options.variant);
  }
  return `${basePath}?${params.toString()}`;
}

/**
 * Keeps public menu contracts intact while making admin-only photo policy
 * explicit at the UI boundary. Non-canonical/external sources retain the
 * established behavior and still get the thumbnail error fallback.
 */
export function buildAdminDishPhotoUrl(
  source: string | null | undefined
): string {
  const value = source?.trim() ?? "";
  if (!value) return "";

  try {
    const parsed = new URL(value, LOCAL_ORIGIN);
    if (parsed.origin !== LOCAL_ORIGIN) return value;

    const match = /^\/api\/public\/menu-dishes\/([^/]+)\/photo$/.exec(
      parsed.pathname
    );
    if (!match || !isCanonicalUuid(match[1])) return value;

    parsed.pathname = `/admin/api/menu-dishes/${match[1]}/photo`;
    if (parsed.searchParams.get("v") && !parsed.searchParams.get("variant")) {
      parsed.searchParams.set("variant", "thumbnail");
    }
    parsed.hash = "";
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "";
  }
}

export function isAdminDishPhotoUrl(source: string): boolean {
  return /^\/admin\/api\/menu-dishes\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/photo(?:\?|$)/i.test(
    source
  );
}
