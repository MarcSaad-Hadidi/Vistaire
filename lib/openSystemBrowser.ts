import {
  getUserAgent,
  isIosDevice,
  isNativeSafariOnIos
} from "@/lib/arEnvironment";

/**
 * Tente d’ouvrir la page courante dans le navigateur le plus susceptible de supporter l’AR
 * (Safari système sur iOS, résolution d’intent sur Android).
 * À appeler après un échec AR — pas une garantie à 100 % (appareils, blocages).
 */
export function openSystemBrowserHandoffForAr(): boolean {
  if (typeof window === "undefined") return false;

  let pageUrl: URL;
  try {
    pageUrl = new URL(window.location.href);
  } catch {
    return false;
  }

  /* AR mobile table / caméra nécessite en pratique HTTPS en prod ; évite les hacks locaux incomplets */
  if (pageUrl.protocol !== "https:") {
    return false;
  }

  if (isIosDevice() && !isNativeSafariOnIos()) {
    return openIosSafariHandoff(pageUrl);
  }

  if (/Android/i.test(getUserAgent())) {
    return openAndroidBrowserIntent(pageUrl);
  }

  return false;
}

/** Schéma non documenté mais largement utilisé pour sortir de Chrome/Firefox iOS vers Safari. */
function openIosSafariHandoff(u: URL): boolean {
  const path = `${u.pathname}${u.search}${u.hash}`;
  const safariUrl = `x-safari-https://${u.host}${path}`;
  try {
    window.location.assign(safariUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Intent VIEW sans package : le système route souvent vers le navigateur par défaut
 * (ou un sélecteur). fallback_url garde la page si aucun handler.
 */
function openAndroidBrowserIntent(u: URL): boolean {
  const href = u.toString();
  const path = `${u.pathname}${u.search}${u.hash}`;
  const intent = `intent://${u.host}${path}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;launchFlags=0x10000000;S.browser_fallback_url=${encodeURIComponent(href)};end`;
  try {
    window.location.assign(intent);
    return true;
  } catch {
    return false;
  }
}
