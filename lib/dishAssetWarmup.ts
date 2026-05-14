import type { Dish } from "@/lib/demoMenuData";

const preparedOrigins = new Set<string>();
const warmedAssetUrls = new Set<string>();
const inFlightAssetUrls = new Set<string>();
const queuedAssetUrls = new Set<string>();
const assetWarmupQueue: AssetWarmupRequest[] = [];
const attemptedAssetAt = new Map<string, number>();

const ASSET_WARMUP_TIMEOUT_MS = 4_000;
const ASSET_WARMUP_RETRY_COOLDOWN_MS = 30_000;
const SMALL_ASSET_WARMUP_MAX_BYTES = 1024 * 1024;

const demoAssetByteSizes = new Map<string, number>([
  ["/models/demo/ravioles-chevre-miel.glb", 76_609_104],
  ["/models/demo/ravioles-chevre-miel.usdz", 70_375_208],
  ["/models/demo/homard-bisque.glb", 29_010_112],
  ["/models/demo/homard-bisque.usdz", 26_352_806],
  ["/models/demo/ar-lite/homard-bisque-ar-lite.glb", 12_032_888],
  ["/models/demo/ar-lite/homard-bisque-ar-lite.usdz", 10_365_689],
  ["/models/demo/souffle-chocolat.glb", 27_286_348],
  ["/models/demo/souffle-chocolat.usdz", 24_873_890],
  ["/models/demo/maison-elyse-n1.glb", 86_380],
  ["/models/demo/maison-elyse-n1.usdz", 208_984]
]);

type AssetKind = "glb" | "usdz";

type AssetWarmupRequest = {
  url: string;
  kind: AssetKind;
};

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

export function shouldWarmHeavyAsset(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;

  if (connection?.saveData) return false;
  if (/^(slow-2g|2g)$/i.test(connection?.effectiveType ?? "")) return false;
  return true;
}

function isLikelyIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function normalizeAssetUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || typeof window === "undefined") return null;

  try {
    const parsed = new URL(trimmed, window.location.href);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}

function getDemoAssetByteSize(normalizedUrl: string): number | null {
  try {
    const parsed = new URL(normalizedUrl);
    return demoAssetByteSizes.get(parsed.pathname) ?? null;
  } catch {
    return null;
  }
}

function canWarmAssetFromMenuCard(normalizedUrl: string): boolean {
  const byteSize = getDemoAssetByteSize(normalizedUrl);
  return Boolean(byteSize && byteSize <= SMALL_ASSET_WARMUP_MAX_BYTES);
}

export function hasWarmedAsset(url: string): boolean {
  const normalizedUrl = normalizeAssetUrl(url);
  return Boolean(normalizedUrl && warmedAssetUrls.has(normalizedUrl));
}

function runNextWarmup(): void {
  if (inFlightAssetUrls.size > 0) return;

  const request = assetWarmupQueue.shift();
  if (!request) return;

  const { url: normalizedUrl } = request;
  queuedAssetUrls.delete(normalizedUrl);
  if (warmedAssetUrls.has(normalizedUrl)) {
    runNextWarmup();
    return;
  }
  if (isCoolingDown(normalizedUrl)) {
    runNextWarmup();
    return;
  }

  inFlightAssetUrls.add(normalizedUrl);
  attemptedAssetAt.set(normalizedUrl, Date.now());
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ASSET_WARMUP_TIMEOUT_MS);

  try {
    fetch(normalizedUrl, {
      cache: "force-cache",
      credentials: "same-origin",
      signal: controller.signal
    })
      .then(async (response) => {
        if (await consumeAssetResponse(response)) {
          warmedAssetUrls.add(normalizedUrl);
        }
      })
      .catch(() => {
        // Warm-up is opportunistic; asset loading paths own user-visible failures.
      })
      .finally(() => {
        window.clearTimeout(timeout);
        inFlightAssetUrls.delete(normalizedUrl);
        window.setTimeout(runNextWarmup, 0);
      });
  } catch {
    window.clearTimeout(timeout);
    inFlightAssetUrls.delete(normalizedUrl);
    window.setTimeout(runNextWarmup, 0);
  }
}

function isCoolingDown(normalizedUrl: string): boolean {
  const lastAttempt = attemptedAssetAt.get(normalizedUrl);
  return Boolean(
    lastAttempt && Date.now() - lastAttempt < ASSET_WARMUP_RETRY_COOLDOWN_MS
  );
}

async function consumeAssetResponse(response: Response): Promise<boolean> {
  if (!response.ok) return false;
  if (!response.body || typeof response.body.getReader !== "function") return true;

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) return true;
    }
  } finally {
    reader.releaseLock();
  }
}

export function warmAsset(url: string, kind: AssetKind): void {
  if (typeof window === "undefined" || !shouldWarmHeavyAsset()) return;

  const normalizedUrl = normalizeAssetUrl(url);
  if (!normalizedUrl) return;
  if (
    warmedAssetUrls.has(normalizedUrl) ||
    inFlightAssetUrls.has(normalizedUrl) ||
    queuedAssetUrls.has(normalizedUrl) ||
    isCoolingDown(normalizedUrl)
  ) {
    return;
  }

  queuedAssetUrls.add(normalizedUrl);
  assetWarmupQueue.push({ url: normalizedUrl, kind });
  runNextWarmup();
}

type WarmableDish = Pick<
  Dish,
  "model3dUrl" | "webModel3dUrl" | "arModel3dUrl" | "usdzUrl" | "arUsdzUrl"
>;

function getWarmupOrder(dish: WarmableDish): AssetWarmupRequest[] {
  const glbUrl =
    dish.arModel3dUrl?.trim() ||
    dish.webModel3dUrl?.trim() ||
    dish.model3dUrl?.trim();
  const usdzUrl = dish.arUsdzUrl?.trim() || dish.usdzUrl?.trim();
  const requests: AssetWarmupRequest[] = [];

  if (isLikelyIos()) {
    if (usdzUrl) requests.push({ url: usdzUrl, kind: "usdz" });
    if (glbUrl) requests.push({ url: glbUrl, kind: "glb" });
    return requests;
  }

  if (glbUrl) requests.push({ url: glbUrl, kind: "glb" });
  if (usdzUrl) requests.push({ url: usdzUrl, kind: "usdz" });
  return requests;
}

export function warmDishAssets(dish: WarmableDish): void {
  if (typeof window === "undefined" || !shouldWarmHeavyAsset()) return;

  const requests = getWarmupOrder(dish);
  const requestedUrls = new Set(
    requests
      .map((request) => normalizeAssetUrl(request.url))
      .filter((url): url is string => Boolean(url))
  );

  for (let i = assetWarmupQueue.length - 1; i >= 0; i -= 1) {
    if (!requestedUrls.has(assetWarmupQueue[i].url)) {
      queuedAssetUrls.delete(assetWarmupQueue[i].url);
      assetWarmupQueue.splice(i, 1);
    }
  }

  for (const request of requests) {
    warmAsset(request.url, request.kind);
  }
}

export const warmDishModelAssets = warmDishAssets;

export function prepareDishAssetIntent(dish: WarmableDish): void {
  if (typeof window === "undefined" || !shouldWarmHeavyAsset()) return;

  prepareDemoAssetOrigin();

  const requests = getWarmupOrder(dish).filter((request) => {
    const normalizedUrl = normalizeAssetUrl(request.url);
    return Boolean(normalizedUrl && canWarmAssetFromMenuCard(normalizedUrl));
  });

  for (const request of requests) {
    warmAsset(request.url, request.kind);
  }
}
