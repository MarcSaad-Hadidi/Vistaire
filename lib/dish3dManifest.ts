import type { Dish } from "@/lib/demoMenuData";

export type ImmersiveDevice = "desktop" | "ios" | "android" | "unknown";
export type ImmersiveBrowser =
  | "chrome"
  | "safari"
  | "firefox"
  | "webview"
  | "in-app"
  | "unknown";
export type ImmersiveUserIntent = "none" | "view3d" | "ar";
export type ImmersiveVariantKind =
  | "none"
  | "poster"
  | "web"
  | "mobile"
  | "arLite"
  | "iosUsdz";

export type Dish3dVariant = {
  url: string;
  bytes?: number;
  sha256?: string;
  width?: number;
  height?: number;
  triangleCount?: number;
  vertexCount?: number;
  materialCount?: number;
  textureCount?: number;
  maxTextureSize?: number;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  arPlacement?: "floor" | "wall";
  arScale?: "fixed" | "auto";
  productionQuickLook?: boolean;
};

export type Dish3dManifest = {
  schemaVersion: 2;
  kind: "vistaire.dish-3d-manifest";
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  activeVersion: string;
  status: "draft" | "review" | "approved" | "published" | "archived";
  validationStatus: "unvalidated" | "passed" | "warning" | "failed";
  variants: Partial<Record<"poster" | "web" | "mobile" | "arLite" | "iosUsdz", Dish3dVariant>>;
  quality?: {
    manualVisualApprovalRequired?: boolean;
    manualVisualApproved?: boolean;
  };
  visualQuality?: {
    status?: "passed" | "warning" | "failed" | "unvalidated";
    manualReview?: {
      required?: boolean;
      status?: "approved" | "pending" | "rejected";
    };
  };
};

export type ImmersiveVariantSelection = {
  kind: ImmersiveVariantKind;
  url: string;
  shouldLoadModel: boolean;
  requiresConfirmation: boolean;
  reason: string;
  message: string;
};

type DemoDish3dFields = Pick<
  Dish,
  | "slug"
  | "model3dUrl"
  | "webModel3dUrl"
  | "arModel3dUrl"
  | "arUsdzUrl"
  | "image"
>;

type SelectImmersiveVariantInput = {
  manifest: Dish3dManifest | null | undefined;
  device: ImmersiveDevice;
  browser: ImmersiveBrowser;
  viewport?: { width?: number; height?: number };
  connection?: { effectiveType?: string; saveData?: boolean };
  userIntent: ImmersiveUserIntent;
  prefersReducedMotion?: boolean;
  allowedExternalOrigins?: string[];
};

const DEMO_RESTAURANT_SLUG = "maison-elyse";
const DEMO_MENU_SLUG = "demo";
const DEMO_ACTIVE_VERSION = "legacy-demo";

type VariantKey = "poster" | "web" | "mobile" | "arLite" | "iosUsdz";

const PUBLIC_MODEL_ROUTE_PATTERN =
  /^\/api\/public\/menu-dishes\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/model\/(glb|usdz)(?:\?(variant=ar-lite)(?:&v=[a-z0-9][a-z0-9._-]{3,96})?|\?v=[a-z0-9][a-z0-9._-]{3,96})?$/i;

function cleanUrl(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function hasSafeLocalPublicModelRoute(url: string, role: VariantKey | "asset"): boolean {
  const match = PUBLIC_MODEL_ROUTE_PATTERN.exec(url);
  if (!match || url.includes("\\") || url.includes("..") || url.includes("#")) return false;
  const format = match[1];
  const isArLite = match[2] === "variant=ar-lite";
  if (format === "usdz" && isArLite) return false;
  if (role === "iosUsdz") return format === "usdz" && !isArLite;
  if (role === "arLite") return format === "glb" && isArLite;
  if (role === "web" || role === "mobile") return format === "glb" && !isArLite;
  return true;
}

function hasSafeLocalAssetUrl(url: string, role: VariantKey | "asset"): boolean {
  if (hasSafeLocalPublicModelRoute(url, role)) return true;

  if (
    !(
      url.startsWith("/") &&
      !url.startsWith("//") &&
      !url.includes("\\") &&
      !url.includes("..") &&
      !/[?#]/.test(url)
    )
  ) {
    return false;
  }

  if (role === "poster") {
    return (
      /\.(?:png|jpe?g|webp|avif|svg)$/i.test(url) &&
      (url.startsWith("/images/demo/") || url.startsWith("/models/restaurants/"))
    );
  }

  if (role === "iosUsdz") {
    return (
      url.endsWith(".usdz") &&
      (url.startsWith("/models/demo/ar-lite/") ||
        url.startsWith("/models/restaurants/"))
    );
  }

  if (role === "arLite") {
    return (
      url.endsWith(".glb") &&
      (url.startsWith("/models/demo/ar-lite/") ||
        url.startsWith("/models/restaurants/"))
    );
  }

  if (role === "web" || role === "mobile") {
    return (
      url.endsWith(".glb") &&
      (url.startsWith("/models/demo/") || url.startsWith("/models/restaurants/"))
    );
  }

  return (
    url.startsWith("/models/demo/") ||
    url.startsWith("/models/restaurants/") ||
    url.startsWith("/images/demo/")
  );
}

function hasAllowedExternalAssetUrl(
  url: string,
  allowedOrigins: string[],
  role: VariantKey | "asset"
): boolean {
  if (allowedOrigins.length === 0) return false;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const extensionOk =
      role === "poster"
        ? /\.(?:png|jpe?g|webp|avif|svg)$/.test(pathname)
        : role === "iosUsdz"
          ? pathname.endsWith(".usdz")
          : role === "asset"
            ? /\.(?:glb|usdz|png|jpe?g|webp|avif|svg)$/.test(pathname)
            : pathname.endsWith(".glb");
    return (
      parsed.protocol === "https:" &&
      !parsed.search &&
      !parsed.hash &&
      allowedOrigins.includes(parsed.origin) &&
      extensionOk
    );
  } catch {
    return false;
  }
}

export function isSafe3dAssetUrl(
  url: string,
  allowedExternalOrigins: string[] = [],
  role: VariantKey | "asset" = "asset"
): boolean {
  if (!url) return false;
  return (
    hasSafeLocalAssetUrl(url, role) ||
    hasAllowedExternalAssetUrl(url, allowedExternalOrigins, role)
  );
}

function safeVariant(
  variant: Dish3dVariant | undefined,
  allowedExternalOrigins: string[],
  role: VariantKey
): Dish3dVariant | null {
  if (!variant?.url) return null;
  return isSafe3dAssetUrl(variant.url, allowedExternalOrigins, role) ? variant : null;
}

function isManifestRuntimeEligible(
  manifest: Dish3dManifest | null | undefined
): manifest is Dish3dManifest {
  if (!manifest) return false;
  const manualVisualRequired = manifest.quality?.manualVisualApprovalRequired === true;
  const manualVisualApproved = manifest.quality?.manualVisualApproved === true;
  const visualReviewRequired = manifest.visualQuality?.manualReview?.required === true;
  const visualReviewApproved = manifest.visualQuality?.manualReview?.status === "approved";
  if (manualVisualRequired && !manualVisualApproved) return false;
  if (visualReviewRequired && !visualReviewApproved) return false;
  if (manifest.visualQuality?.status === "failed") return false;
  return (
    manifest.kind === "vistaire.dish-3d-manifest" &&
    manifest.schemaVersion === 2 &&
    (manifest.status === "approved" || manifest.status === "published") &&
    manifest.validationStatus === "passed"
  );
}

function isSlowOrMeteredConnection(connection?: SelectImmersiveVariantInput["connection"]): boolean {
  if (connection?.saveData) return true;
  return /^(slow-2g|2g|3g)$/i.test(connection?.effectiveType ?? "");
}

function selection(
  kind: ImmersiveVariantKind,
  variant: Dish3dVariant | null,
  extra: Partial<ImmersiveVariantSelection> = {}
): ImmersiveVariantSelection {
  return {
    kind,
    url: variant?.url ?? "",
    shouldLoadModel: kind === "web" || kind === "mobile" || kind === "arLite",
    requiresConfirmation: false,
    reason: kind,
    message: "",
    ...extra
  };
}

function firstAvailable(
  manifest: Dish3dManifest,
  keys: Array<"mobile" | "web" | "arLite">,
  allowedExternalOrigins: string[]
): Dish3dVariant | null {
  for (const key of keys) {
    const variant = safeVariant(manifest.variants[key], allowedExternalOrigins, key);
    if (variant) return variant;
  }
  return null;
}

export function buildDemoDish3dManifest(dish: DemoDish3dFields): Dish3dManifest {
  const webUrl = cleanUrl(dish.webModel3dUrl) || cleanUrl(dish.model3dUrl);
  const arLiteUrl = cleanUrl(dish.arModel3dUrl);
  const mobileUrl = arLiteUrl || webUrl;
  const iosUsdzUrl = cleanUrl(dish.arUsdzUrl);
  const posterUrl = cleanUrl(dish.image);
  const variants: Dish3dManifest["variants"] = {};

  if (posterUrl) variants.poster = { url: posterUrl };
  if (webUrl) variants.web = { url: webUrl };
  if (mobileUrl) variants.mobile = { url: mobileUrl };
  if (arLiteUrl) {
    variants.arLite = {
      url: arLiteUrl,
      arPlacement: "floor",
      arScale: "fixed",
      extensionsRequired: []
    };
  }
  if (iosUsdzUrl) {
    variants.iosUsdz = {
      url: iosUsdzUrl,
      productionQuickLook: true
    };
  }

  const hasModel = Boolean(webUrl || mobileUrl || arLiteUrl || iosUsdzUrl);

  return {
    schemaVersion: 2,
    kind: "vistaire.dish-3d-manifest",
    restaurantSlug: DEMO_RESTAURANT_SLUG,
    menuSlug: DEMO_MENU_SLUG,
    dishSlug: dish.slug,
    activeVersion: DEMO_ACTIVE_VERSION,
    status: hasModel ? "approved" : "draft",
    validationStatus: hasModel ? "passed" : "unvalidated",
    variants,
    quality: {
      manualVisualApprovalRequired: false,
      manualVisualApproved: true
    }
  };
}

export function selectImmersiveVariant({
  manifest,
  device,
  browser,
  connection,
  userIntent,
  allowedExternalOrigins = []
}: SelectImmersiveVariantInput): ImmersiveVariantSelection {
  if (!isManifestRuntimeEligible(manifest)) {
    return selection("none", null, {
      shouldLoadModel: false,
      reason: "manifest-not-runtime-eligible",
      message: "Ce plat sera bientot disponible en 3D."
    });
  }
  const runtimeManifest = manifest;

  const poster = safeVariant(runtimeManifest.variants.poster, allowedExternalOrigins, "poster");
  if (userIntent === "none") {
    return selection("poster", poster, {
      shouldLoadModel: false,
      reason: "waiting-for-user-intent"
    });
  }

  if (isSlowOrMeteredConnection(connection)) {
    return selection("poster", poster, {
      shouldLoadModel: false,
      requiresConfirmation: true,
      reason: "slow-or-metered-network",
      message: "Reseau lent detecte : charger la vue 3D ?"
    });
  }

  if (userIntent === "ar") {
    if (device === "ios") {
      const iosUsdz = safeVariant(
        runtimeManifest.variants.iosUsdz,
        allowedExternalOrigins,
        "iosUsdz"
      );
      if (browser === "safari" && iosUsdz) {
        return selection("iosUsdz", iosUsdz, {
          shouldLoadModel: false,
          reason: "ios-safari-quick-look"
        });
      }

      const fallback = firstAvailable(runtimeManifest, ["mobile", "web"], allowedExternalOrigins);
      return selection("mobile", fallback, {
        reason: iosUsdz ? "ios-non-safari-fallback" : "ios-usdz-missing",
        message: iosUsdz
          ? "Ouvrir dans Safari pour la realite augmentee. La 3D reste disponible ici."
          : "La 3D reste disponible ici."
      });
    }

    if (device === "android") {
      const arLite = safeVariant(runtimeManifest.variants.arLite, allowedExternalOrigins, "arLite");
      if (browser === "chrome" && arLite) {
        return selection("arLite", arLite, {
          reason: "android-scene-viewer-ar-lite"
        });
      }

      const fallback = firstAvailable(runtimeManifest, ["mobile", "web"], allowedExternalOrigins);
      return selection("mobile", fallback, {
        reason: arLite ? "android-browser-fallback" : "android-ar-lite-missing",
        message: "La 3D reste disponible ici."
      });
    }
  }

  if (device === "desktop") {
    const web = safeVariant(runtimeManifest.variants.web, allowedExternalOrigins, "web");
    if (!web && cleanUrl(runtimeManifest.variants.web?.url)) {
      return selection("none", null, {
        shouldLoadModel: false,
        reason: "unsafe-web-variant-url"
      });
    }
    return selection("web", web, {
      reason: "desktop-web"
    });
  }

  const mobile = firstAvailable(runtimeManifest, ["mobile", "web"], allowedExternalOrigins);
  if (
    !mobile &&
    cleanUrl(runtimeManifest.variants.mobile?.url || runtimeManifest.variants.web?.url)
  ) {
    return selection("none", null, {
      shouldLoadModel: false,
      reason: "unsafe-mobile-variant-url"
    });
  }

  return selection("mobile", mobile, {
    reason: "mobile-preview"
  });
}
