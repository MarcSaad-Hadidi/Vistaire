import type { Dish } from "@/lib/demoMenuData";
import { isAndroidDevice, isIosDevice } from "@/lib/arEnvironment";

type WarmableDish = Pick<Dish, "slug" | "model3dUrl" | "usdzUrl">;

export type DishAssetPlatform = "ios" | "android" | "desktop";
export type DishAssetWarmupPhase =
  | "menu-open"
  | "menu-intent"
  | "dish-open"
  | "viewer-intent"
  | "viewer-open"
  | "ar-visible";
export type DishAssetKind = "model3d" | "ar";
export type AssetWarmupStatus =
  | "idle"
  | "warming"
  | "ready"
  | "skipped"
  | "error";

export type AssetWarmupResult = {
  url: string;
  status: AssetWarmupStatus;
  reason?: string;
  promise?: Promise<void>;
};

type WarmupRecord = {
  url: string;
  kind: DishAssetKind;
  status: AssetWarmupStatus;
  reason?: string;
  promise?: Promise<void>;
};

type NetworkConnection = {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkConnection;
  mozConnection?: NetworkConnection;
  webkitConnection?: NetworkConnection;
};

const MAX_PARALLEL_HEAVY_ASSET_WARMUPS = 1;
const EARLY_AR_WARMUP_SIZE_LIMIT_BYTES = 100 * 1024 * 1024;

const DEMO_ASSET_SIZE_BYTES_BY_PATH: Record<string, number> = {
  "/models/demo/homard-bisque.glb": 29_010_112,
  "/models/demo/homard-bisque.usdz": 51_001_141,
  "/models/demo/maison-elyse-n1.glb": 86_380,
  "/models/demo/maison-elyse-n1.usdz": 208_984,
  "/models/demo/ravioles-chevre-miel.glb": 76_609_104,
  "/models/demo/ravioles-chevre-miel.usdz": 177_289_112,
  "/models/demo/souffle-chocolat.glb": 27_286_348,
  "/models/demo/souffle-chocolat.usdz": 47_193_888
};

const assetWarmups = new Map<string, WarmupRecord>();
const activeHeavyAssetWarmups = new Set<string>();
const preparedOrigins = new Set<string>();

let modelViewerRuntimeWarmupPromise: Promise<unknown> | null = null;

function cleanAssetUrl(url: string | null | undefined): string {
  return url?.trim() ?? "";
}

function toAbsoluteAssetUrl(url: string): string {
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.href).href;
}

function getAssetKey(url: string): string {
  return toAbsoluteAssetUrl(url);
}

function getConnection(): NetworkConnection | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

function getEffectiveType(): string {
  return getConnection()?.effectiveType?.toLowerCase() ?? "";
}

function getKnownAssetSizeBytes(url: string | undefined): number | null {
  if (!url) return null;
  const pathname = new URL(toAbsoluteAssetUrl(url)).pathname;
  return DEMO_ASSET_SIZE_BYTES_BY_PATH[pathname] ?? null;
}

function isPermanentWarmupBlock(): boolean {
  const connection = getConnection();
  if (connection?.saveData) return true;
  return /^(slow-2g|2g)$/i.test(connection?.effectiveType ?? "");
}

function getWarmupSkipReason(options: {
  kind: DishAssetKind;
  phase: DishAssetWarmupPhase;
  url?: string;
}): string | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "server";
  }

  if (isPermanentWarmupBlock()) return "constrained-network";

  const effectiveType = getEffectiveType();
  if (
    options.kind === "ar" &&
    effectiveType === "3g" &&
    (options.phase === "menu-intent" || options.phase === "dish-open")
  ) {
    return "defer-ar-on-3g";
  }

  const knownSizeBytes = getKnownAssetSizeBytes(options.url);
  if (
    options.kind === "ar" &&
    knownSizeBytes !== null &&
    knownSizeBytes > EARLY_AR_WARMUP_SIZE_LIMIT_BYTES &&
    (options.phase === "menu-intent" || options.phase === "dish-open")
  ) {
    return "defer-large-ar-until-viewer";
  }

  const key = options.url ? getAssetKey(options.url) : "";
  if (key && activeHeavyAssetWarmups.has(key)) return null;
  if (activeHeavyAssetWarmups.size >= MAX_PARALLEL_HEAVY_ASSET_WARMUPS) {
    return "heavy-warmup-busy";
  }

  return null;
}

export function shouldPreloadHeavyAsset(options: {
  kind?: DishAssetKind;
  phase?: DishAssetWarmupPhase;
  url?: string;
} = {}): boolean {
  return (
    getWarmupSkipReason({
      kind: options.kind ?? "model3d",
      phase: options.phase ?? "menu-intent",
      url: options.url
    }) === null
  );
}

export function getDish3dAsset(dish: Pick<Dish, "model3dUrl">): string {
  return cleanAssetUrl(dish.model3dUrl);
}

export function getDishArPlatform(): DishAssetPlatform {
  if (isIosDevice()) return "ios";
  if (isAndroidDevice()) return "android";
  return "desktop";
}

export function getDishArAsset(
  dish: Pick<Dish, "model3dUrl" | "usdzUrl">,
  platform: DishAssetPlatform = getDishArPlatform()
): string {
  if (platform === "ios") return cleanAssetUrl(dish.usdzUrl);
  if (platform === "android") return cleanAssetUrl(dish.model3dUrl);
  return "";
}

function getContentType(url: string): string {
  const path = new URL(toAbsoluteAssetUrl(url)).pathname.toLowerCase();
  if (path.endsWith(".usdz")) return "model/vnd.usdz+zip";
  if (path.endsWith(".glb")) return "model/gltf-binary";
  return "";
}

function createPreloadLink(
  url: string,
  kind: DishAssetKind,
  phase: DishAssetWarmupPhase,
  priority: "high" | "low"
): Promise<void> {
  const absoluteUrl = toAbsoluteAssetUrl(url);
  const key = getAssetKey(url);
  const rel =
    kind === "ar" && (phase === "menu-intent" || phase === "dish-open")
      ? "prefetch"
      : "preload";

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = rel;
    link.as = "fetch";
    link.href = absoluteUrl;
    link.crossOrigin = "anonymous";
    link.setAttribute("data-vistaire-asset-warmup", kind);
    link.setAttribute("fetchpriority", priority);

    const type = getContentType(url);
    if (type) link.type = type;

    const finish = (status: AssetWarmupStatus, reason?: string) => {
      activeHeavyAssetWarmups.delete(key);
      assetWarmups.set(key, {
        url,
        kind,
        status,
        reason
      });
    };

    link.onload = () => {
      finish("ready");
      resolve();
    };

    link.onerror = () => {
      finish("error", "preload-error");
      reject(new Error(`Unable to warm ${url}`));
    };

    activeHeavyAssetWarmups.add(key);
    document.head.appendChild(link);
  });
}

function warmAsset(options: {
  url: string;
  kind: DishAssetKind;
  phase: DishAssetWarmupPhase;
  priority?: "high" | "low";
}): AssetWarmupResult {
  const url = cleanAssetUrl(options.url);
  if (!url) return { url: "", status: "skipped", reason: "missing-url" };

  const key = getAssetKey(url);
  const existing = assetWarmups.get(key);
  if (existing?.status === "ready" || existing?.status === "warming") {
    return {
      url,
      status: existing.status,
      reason: existing.reason,
      promise: existing.promise
    };
  }

  const skipReason = getWarmupSkipReason({
    kind: options.kind,
    phase: options.phase,
    url
  });
  if (skipReason) return { url, status: "skipped", reason: skipReason };

  const promise = createPreloadLink(
    url,
    options.kind,
    options.phase,
    options.priority ?? (options.kind === "model3d" ? "high" : "low")
  );

  assetWarmups.set(key, {
    url,
    kind: options.kind,
    status: "warming",
    promise
  });

  promise.catch(() => {
    // The status is already tracked. Avoid surfacing preload failures as
    // unhandled promise rejections in the customer experience.
  });

  return { url, status: "warming", promise };
}

export function getDishAssetWarmupState(
  url: string | null | undefined
): AssetWarmupResult {
  const cleanUrl = cleanAssetUrl(url);
  if (!cleanUrl) return { url: "", status: "idle" };
  const record = assetWarmups.get(getAssetKey(cleanUrl));
  if (!record) return { url: cleanUrl, status: "idle" };
  return {
    url: cleanUrl,
    status: record.status,
    reason: record.reason,
    promise: record.promise
  };
}

export function trackAssetWarmupState(
  url: string | null | undefined,
  status: Exclude<AssetWarmupStatus, "idle" | "skipped">,
  kind: DishAssetKind = "model3d"
): void {
  const cleanUrl = cleanAssetUrl(url);
  if (!cleanUrl) return;

  const key = getAssetKey(cleanUrl);
  const existing = assetWarmups.get(key);
  if (existing?.status === "ready" && status === "warming") return;

  if (status === "warming") {
    activeHeavyAssetWarmups.add(key);
  } else {
    activeHeavyAssetWarmups.delete(key);
  }

  assetWarmups.set(key, {
    url: cleanUrl,
    kind: existing?.kind ?? kind,
    status,
    reason: status === "error" ? "runtime-error" : undefined,
    promise: status === "warming" ? existing?.promise : undefined
  });
}

export function releaseAssetWarmupState(
  url: string | null | undefined,
  kind: DishAssetKind = "model3d"
): void {
  const cleanUrl = cleanAssetUrl(url);
  if (!cleanUrl) return;

  const key = getAssetKey(cleanUrl);
  const existing = assetWarmups.get(key);

  if (
    !existing ||
    existing.kind !== kind ||
    existing.status !== "warming" ||
    existing.promise
  ) {
    return;
  }

  activeHeavyAssetWarmups.delete(key);
  assetWarmups.delete(key);
}

export function warmDish3dAsset(
  dish: Pick<Dish, "model3dUrl">,
  options: {
    phase?: DishAssetWarmupPhase;
    priority?: "high" | "low";
  } = {}
): AssetWarmupResult {
  return warmAsset({
    url: getDish3dAsset(dish),
    kind: "model3d",
    phase: options.phase ?? "menu-intent",
    priority: options.priority ?? "high"
  });
}

export function warmDishArAsset(
  dish: Pick<Dish, "model3dUrl" | "usdzUrl">,
  options: {
    phase?: DishAssetWarmupPhase;
    platform?: DishAssetPlatform;
    priority?: "high" | "low";
  } = {}
): AssetWarmupResult {
  return warmAsset({
    url: getDishArAsset(dish, options.platform),
    kind: "ar",
    phase: options.phase ?? "ar-visible",
    priority: options.priority ?? "low"
  });
}

export function warmModelViewerRuntime(): Promise<unknown> | null {
  if (isPermanentWarmupBlock()) return null;
  modelViewerRuntimeWarmupPromise ??= import("@google/model-viewer");
  return modelViewerRuntimeWarmupPromise;
}

export function warmDishAssets(
  dish: WarmableDish,
  options: {
    phase?: DishAssetWarmupPhase;
    includeAr?: boolean;
    platform?: DishAssetPlatform;
  } = {}
): { model: AssetWarmupResult; ar?: AssetWarmupResult } {
  const phase = options.phase ?? "menu-intent";

  const runtimeWarmup = warmModelViewerRuntime();
  if (runtimeWarmup) {
    void runtimeWarmup.catch(() => undefined);
  }

  const model = warmDish3dAsset(dish, { phase });
  if (options.includeAr === false) return { model };

  const arUrl = getDishArAsset(dish, options.platform);
  const modelUrl = getDish3dAsset(dish);
  if (!arUrl) return { model };

  if (arUrl === modelUrl) {
    return { model, ar: getDishAssetWarmupState(modelUrl) };
  }

  if (model.status === "warming" && model.promise) {
    void model.promise.then(
      () => {
        warmDishArAsset(dish, {
          phase,
          platform: options.platform,
          priority: "low"
        });
      },
      () => undefined
    );
    return { model, ar: getDishAssetWarmupState(arUrl) };
  }

  return {
    model,
    ar: warmDishArAsset(dish, {
      phase,
      platform: options.platform,
      priority: "low"
    })
  };
}

export function prepareDemoAssetOrigin(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const origin = new URL("/models/demo/", window.location.href).origin;
  if (origin === window.location.origin || preparedOrigins.has(origin)) return;

  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = origin;
  link.crossOrigin = "anonymous";
  link.setAttribute("data-vistaire-asset-origin", "demo-models");
  preparedOrigins.add(origin);
  document.head.appendChild(link);
}
