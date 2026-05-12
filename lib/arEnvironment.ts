/**
 * Détection légère pour messages AR / fallback (pas de promesse de support réel).
 */

export function getUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent;
}

function getNavigator(): Navigator | null {
  if (typeof navigator === "undefined") return null;
  return navigator;
}

function isIpadOsDesktopMode(): boolean {
  const nav = getNavigator();
  if (!nav) return false;
  return nav.platform === "MacIntel" && nav.maxTouchPoints > 1;
}

export function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(getUserAgent()) || isIpadOsDesktopMode();
}

export function isAndroidDevice(): boolean {
  return /Android/i.test(getUserAgent());
}

/**
 * Safari « natif » iOS — pas Chrome/Firefox/Edge/Brave/Opera dans leur shell WebKit,
 * où l’AR Quick Look est souvent indisponible.
 */
export function isNativeSafariOnIos(): boolean {
  const ua = getUserAgent();
  if (!isIosDevice()) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|Brave|DuckDuckGo|YaBrowser/i.test(ua)) {
    return false;
  }
  if (isIosInAppBrowser()) return false;
  return /Version\/[\d.]+/.test(ua) && /Safari/i.test(ua);
}

/** Alias sémantique (Safari iOS natif). */
export function isSafariOnIos(): boolean {
  return isNativeSafariOnIos();
}

/** Navigateurs iOS autres que Safari (WKWebView / restrictions AR fréquentes). */
export function isIosEmbeddedBrowser(): boolean {
  const ua = getUserAgent();
  if (!isIosDevice()) return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|YaBrowser/i.test(ua);
}

export function isBraveUserAgent(): boolean {
  const nav = getNavigator() as (Navigator & { brave?: unknown }) | null;
  return /Brave/i.test(getUserAgent()) || Boolean(nav?.brave);
}

export function isIosInAppBrowser(): boolean {
  const ua = getUserAgent();
  if (!isIosDevice()) return false;
  return /Instagram|FBAN|FBAV|FBIOS|FB_IAB|Line\/|MicroMessenger|TikTok|Bytedance|Pinterest|Snapchat|LinkedInApp/i.test(
    ua
  );
}

export function canUseIosQuickLookDirectly(): boolean {
  return isNativeSafariOnIos();
}

export function shouldShowArBrowserHandoff(): boolean {
  if (!isIosDevice()) return false;
  return !canUseIosQuickLookDirectly();
}

export function isAndroidInAppBrowser(): boolean {
  const ua = getUserAgent();
  if (!isAndroidDevice()) return false;
  return /Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|TikTok|Bytedance|Pinterest|Snapchat|LinkedInApp/i.test(
    ua
  );
}

export function isAndroidFirefox(): boolean {
  return isAndroidDevice() && /Firefox\/|Fennec\//i.test(getUserAgent());
}

export function isAndroidLikelySceneViewerCapable(): boolean {
  const ua = getUserAgent();
  if (!isAndroidDevice()) return false;
  if (isAndroidInAppBrowser() || isAndroidFirefox()) return false;
  if (/EdgA|OPR\/|Opera|DuckDuckGo|YaBrowser|SamsungBrowser/i.test(ua)) {
    return false;
  }
  if (isBraveUserAgent()) return false;
  return /Chrome\//i.test(ua);
}

export type ArUnavailableVariant =
  | "default"
  | "androidBrowser"
  | "iosBrave"
  | "iosEmbedded"
  | "iosHandoff"
  | "modelLoad";

const AR_UNAVAILABLE_TEXT =
  "Votre navigateur ne permet pas d’ouvrir ce plat en réalité augmentée. Vous pouvez le visualiser en 3D ici.";
const ANDROID_BROWSER_AR_TEXT =
  "Votre navigateur ne permet pas la réalité augmentée ici. Vous pouvez quand même faire tourner le plat en 3D.";
const IOS_BRAVE_AR_TEXT =
  "Ce navigateur ne permet pas encore l’ouverture AR de ce plat. Pour l’expérience complète sur iPhone, ouvrez cette page dans Safari, ou visualisez le plat en 3D ici.";
const IOS_EMBEDDED_AR_TEXT =
  "Ce navigateur sur iPhone ne permet pas toujours l’AR directement. Pour l’expérience complète, ouvrez cette page dans Safari, ou explorez le plat en 3D ici.";
const IOS_HANDOFF_AR_TEXT =
  "Pour placer le plat devant vous, ouvrez cette fiche dans Safari sur iPhone.";
const MODEL_LOAD_BLOCKED_TEXT =
  "La vue immersive n’a pas pu être chargée pour le moment.";

export function getArUnavailableMessage(variant: ArUnavailableVariant): string {
  switch (variant) {
    case "androidBrowser":
      return ANDROID_BROWSER_AR_TEXT;
    case "iosBrave":
      return IOS_BRAVE_AR_TEXT;
    case "iosEmbedded":
      return IOS_EMBEDDED_AR_TEXT;
    case "iosHandoff":
      return IOS_HANDOFF_AR_TEXT;
    case "modelLoad":
      return MODEL_LOAD_BLOCKED_TEXT;
    default:
      return AR_UNAVAILABLE_TEXT;
  }
}
