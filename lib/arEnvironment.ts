/**
 * Détection légère pour messages AR / fallback (pas de promesse de support réel).
 */

export function getUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent;
}

export function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(getUserAgent());
}

/** Safari WebKit sur iOS (pas Chrome/Firefox/Edge embarqués). */
export function isSafariOnIos(): boolean {
  const ua = getUserAgent();
  if (!isIosDevice()) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return false;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

/** Navigateurs iOS autres que Safari (WKWebView / restrictions AR fréquentes). */
export function isIosEmbeddedBrowser(): boolean {
  const ua = getUserAgent();
  if (!isIosDevice()) return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

export function isBraveUserAgent(): boolean {
  return /Brave/i.test(getUserAgent());
}

export type ArUnavailableVariant =
  | "default"
  | "iosBrave"
  | "iosEmbedded"
  | "modelLoad";

const AR_UNAVAILABLE_TEXT =
  "Votre navigateur ne permet pas d\u2019ouvrir ce plat en r\u00e9alit\u00e9 augment\u00e9e. Vous pouvez le visualiser en 3D ici.";
const IOS_BRAVE_AR_TEXT =
  "Ce navigateur ne permet pas encore l\u2019ouverture AR de ce plat. Pour l\u2019exp\u00e9rience compl\u00e8te sur iPhone, ouvrez cette page dans Safari, ou visualisez le plat en 3D ici.";
const IOS_EMBEDDED_AR_TEXT =
  "Ce navigateur sur iPhone ne permet pas toujours l\u2019AR directement. Pour l\u2019exp\u00e9rience compl\u00e8te, ouvrez cette page dans Safari, ou explorez le plat en 3D ici.";
const MODEL_LOAD_BLOCKED_TEXT =
  "Le mod\u00e8le ne se charge pas (connexion ou bloqueur). D\u00e9sactivez les protections strictes pour ce site ou r\u00e9essayez dans un instant.";

export function getArUnavailableMessage(variant: ArUnavailableVariant): string {
  switch (variant) {
    case "iosBrave":
      return IOS_BRAVE_AR_TEXT;
    case "iosEmbedded":
      return IOS_EMBEDDED_AR_TEXT;
    case "modelLoad":
      return MODEL_LOAD_BLOCKED_TEXT;
    default:
      return AR_UNAVAILABLE_TEXT;
  }
}
