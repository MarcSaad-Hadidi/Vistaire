// Theme events only: no per-scroll DOM reads, observers, timers or render loop.
export function pricingLightTheme() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-vistaire-theme") === "light"
  );
}
export function subscribePricingTheme(callback) {
  if (typeof window === "undefined") return () => {};
  const sync = () => callback(pricingLightTheme());
  const storage = (event) => {
    if (event.key === "vistaire-public-theme" || event.key === null) sync();
  };
  window.addEventListener("vistaire-public-theme-change", sync);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("vistaire-public-theme-change", sync);
    window.removeEventListener("storage", storage);
  };
}

