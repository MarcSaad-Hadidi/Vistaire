export const VISTAIRE_ROUTE_THEME_HEADER = "x-vistaire-route-theme";
export const SAUGE_NOIRE_ROUTE_THEME = "sauge-noire";
export const SAUGE_NOIRE_PAPER = "#faf4e9";

export function isSaugeNoirePath(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return (
    normalizedPath === "/menu/sauge-noire" ||
    normalizedPath.startsWith("/menu/sauge-noire/")
  );
}
