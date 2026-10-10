export type PublicTheme = "dark" | "light";
export const PUBLIC_THEME_KEY = "vistaire-public-theme";
export const PUBLIC_THEME_EVENT = "vistaire-public-theme-change";
// Runs in <head> before page content paints. The attribute has no effect outside
// explicitly scoped marketing roots, including when navigating to a restaurant.
export const PUBLIC_THEME_BOOTSTRAP = `(()=>{let theme="dark";try{if(localStorage.getItem("vistaire-public-theme")==="light")theme="light"}catch{}document.documentElement.setAttribute("data-vistaire-theme",theme)})()`;

export function getPublicTheme(): PublicTheme {
  return document.documentElement.getAttribute("data-vistaire-theme") === "light" ? "light" : "dark";
}

export function setPublicTheme(theme: PublicTheme) {
  document.documentElement.setAttribute("data-vistaire-theme", theme);
  try { localStorage.setItem(PUBLIC_THEME_KEY, theme); } catch { /* Private browsing can deny storage. */ }
  window.dispatchEvent(new Event(PUBLIC_THEME_EVENT));
}

export function subscribePublicTheme(callback: () => void) {
  const syncStorage = (event: StorageEvent) => {
    if (event.key !== PUBLIC_THEME_KEY && event.key !== null) return;
    document.documentElement.setAttribute("data-vistaire-theme", event.newValue === "light" ? "light" : "dark");
    callback();
  };
  window.addEventListener(PUBLIC_THEME_EVENT, callback);
  window.addEventListener("storage", syncStorage);
  return () => {
    window.removeEventListener(PUBLIC_THEME_EVENT, callback);
    window.removeEventListener("storage", syncStorage);
  };
}
