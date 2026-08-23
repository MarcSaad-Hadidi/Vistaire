/**
 * Shared AR capability diagnosis.
 *
 * User-Agent identifies platform and known non-AR browsers.
 * It is not proof that ARCore / Scene Viewer / Quick Look will succeed.
 * Runtime signals (Scene Viewer fallback hash, activateAR reject, ar-status)
 * decide device/runtime failure after a Chrome Android attempt.
 */

export const MODEL_VIEWER_NO_AR_FALLBACK_HASH = "#model-viewer-no-ar-fallback";

export type ArClientSnapshot = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentDataPlatform?: string;
  userAgentDataBrands?: string[];
  brave?: boolean;
};

export type ArBrowserClass =
  | "ios-safari"
  | "ios-other"
  | "android-chrome"
  | "android-other"
  | "desktop";

export type ArRuntimeSignal =
  | "none"
  | "launching"
  | "active"
  | "scene-viewer-unavailable"
  | "activation-rejected"
  | "ar-status-failed";

export type ArExperiencePhase =
  | { kind: "idle" }
  | { kind: "cta"; platform: "ios" | "android" }
  | { kind: "handoff"; recommendedBrowser: "safari" | "chrome" }
  | { kind: "unsupported-device" }
  | { kind: "activation-failed" }
  | { kind: "asset-unavailable" }
  | { kind: "missing-usdz" }
  | { kind: "desktop-hint" };

export type ResolveArExperienceInput = {
  browser: ArBrowserClass;
  modelReady: boolean;
  hasArLite: boolean;
  hasUsdz: boolean;
  runtime: ArRuntimeSignal;
  canActivateAR?: boolean | null;
};

const IN_APP_BROWSER_RE =
  /Instagram|FBAN|FBAV|FBIOS|FB_IAB|Line\/|MicroMessenger|TikTok|Bytedance|Pinterest|Snapchat|LinkedInApp/i;
const IOS_EMBEDDED_RE =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|YaBrowser/i;
const ANDROID_NON_CHROME_RE =
  /EdgA|OPR\/|Opera|DuckDuckGo|YaBrowser|SamsungBrowser/i;

function combinedPlatform(input: ArClientSnapshot): string {
  return `${input.platform ?? ""} ${input.userAgentDataPlatform ?? ""}`;
}

function isIpadOsDesktopMode(input: ArClientSnapshot): boolean {
  return (
    (input.maxTouchPoints ?? 0) > 1 &&
    (/Macintosh|MacIntel/i.test(input.userAgent) ||
      /Macintosh|MacIntel/i.test(combinedPlatform(input)))
  );
}

function isIos(input: ArClientSnapshot): boolean {
  return (
    /iPad|iPhone|iPod/i.test(input.userAgent) ||
    /iPhone|iPad|iPod|iOS|iPadOS/i.test(input.userAgentDataPlatform ?? "") ||
    isIpadOsDesktopMode(input)
  );
}

function isAndroid(input: ArClientSnapshot): boolean {
  return (
    /Android/i.test(input.userAgent) ||
    /Android/i.test(input.userAgentDataPlatform ?? "")
  );
}

function isBrave(input: ArClientSnapshot): boolean {
  return Boolean(input.brave) || /Brave/i.test(input.userAgent);
}

function isIosInApp(input: ArClientSnapshot): boolean {
  return isIos(input) && IN_APP_BROWSER_RE.test(input.userAgent);
}

function isAndroidInApp(input: ArClientSnapshot): boolean {
  return isAndroid(input) && IN_APP_BROWSER_RE.test(input.userAgent);
}

function isAndroidFirefox(input: ArClientSnapshot): boolean {
  return isAndroid(input) && /Firefox\/|Fennec\//i.test(input.userAgent);
}

function isAndroidWebView(input: ArClientSnapshot): boolean {
  if (!isAndroid(input)) return false;
  // Classic Android WebView often omits `; wv` and instead ships
  // `Version/x.x Chrome/`, which cannot launch Scene Viewer.
  return /; wv\)|\bwv\b|Version\/[\d.]+.*Chrome\//i.test(input.userAgent);
}

function isNativeIosSafari(input: ArClientSnapshot): boolean {
  if (!isIos(input)) return false;
  if (IOS_EMBEDDED_RE.test(input.userAgent) || isBrave(input) || isIosInApp(input)) {
    return false;
  }
  return /Version\/[\d.]+/.test(input.userAgent) && /Safari/i.test(input.userAgent);
}

function hasGoogleChromeBrand(input: ArClientSnapshot): boolean {
  const brands = input.userAgentDataBrands ?? [];
  if (brands.some((brand) => /Edge|Edg|Opera|Samsung|Brave|Firefox/i.test(brand))) {
    return false;
  }
  return brands.some((brand) => /^Google Chrome$/i.test(brand.trim()));
}

function isAndroidChromeCandidate(input: ArClientSnapshot): boolean {
  if (!isAndroid(input)) return false;
  if (
    isAndroidInApp(input) ||
    isAndroidFirefox(input) ||
    isAndroidWebView(input) ||
    isBrave(input) ||
    ANDROID_NON_CHROME_RE.test(input.userAgent)
  ) {
    return false;
  }
  if (hasGoogleChromeBrand(input)) return true;
  // Reduced-UA still usually includes Chrome/. Platform alone is not proof.
  return /Chrome\//i.test(input.userAgent);
}

export function classifyArBrowser(input: ArClientSnapshot): ArBrowserClass {
  if (isIos(input)) {
    return isNativeIosSafari(input) ? "ios-safari" : "ios-other";
  }
  if (isAndroid(input)) {
    return isAndroidChromeCandidate(input) ? "android-chrome" : "android-other";
  }
  return "desktop";
}

export function isSceneViewerFallbackHash(hash: string): boolean {
  return hash === MODEL_VIEWER_NO_AR_FALLBACK_HASH;
}

export function resolveArExperience(
  input: ResolveArExperienceInput
): ArExperiencePhase {
  if (!input.modelReady) return { kind: "idle" };

  if (input.browser === "desktop") {
    return { kind: "desktop-hint" };
  }

  if (input.browser === "ios-other") {
    return input.hasUsdz
      ? { kind: "handoff", recommendedBrowser: "safari" }
      : { kind: "missing-usdz" };
  }

  if (input.browser === "ios-safari") {
    if (!input.hasUsdz) return { kind: "missing-usdz" };
    return { kind: "cta", platform: "ios" };
  }

  if (input.browser === "android-other") {
    return input.hasArLite
      ? { kind: "handoff", recommendedBrowser: "chrome" }
      : { kind: "asset-unavailable" };
  }

  if (input.runtime === "activation-rejected") {
    return { kind: "activation-failed" };
  }

  if (
    input.runtime === "scene-viewer-unavailable" ||
    input.runtime === "ar-status-failed"
  ) {
    return { kind: "unsupported-device" };
  }

  // canActivateAR starts false during model-viewer init. Callers must only
  // pass false after the viewer has settled; never use it to hide the CTA
  // on first paint. DishModelViewer does not bind this on purpose.
  if (input.canActivateAR === false) {
    return { kind: "unsupported-device" };
  }

  if (input.hasArLite) {
    return { kind: "cta", platform: "android" };
  }

  return { kind: "asset-unavailable" };
}

export function arFallbackUiMode(
  reason: string
): "none" | "browser" | "device" | "asset" {
  if (reason === "missing-ios-usdz") return "none";
  if (reason === "asset-unavailable") return "asset";
  if (reason === "ios-handoff" || reason === "android-handoff") {
    return "browser";
  }
  return "device";
}

export function readLiveArClientSnapshot(): ArClientSnapshot {
  if (typeof navigator === "undefined") {
    return { userAgent: "" };
  }
  const navigatorWithExtras = navigator as Navigator & {
    brave?: unknown;
    userAgentData?: {
      platform?: string;
      brands?: Array<{ brand?: string }>;
    };
  };
  const brands = navigatorWithExtras.userAgentData?.brands
    ?.map((entry) => entry.brand?.trim() ?? "")
    .filter(Boolean);
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    userAgentDataPlatform: navigatorWithExtras.userAgentData?.platform,
    userAgentDataBrands: brands,
    brave: Boolean(navigatorWithExtras.brave) || /Brave/i.test(navigator.userAgent)
  };
}
