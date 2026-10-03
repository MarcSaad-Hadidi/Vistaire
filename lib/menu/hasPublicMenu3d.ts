import { isSafe3dAssetUrl } from "../dish3dManifest.ts";
import type { PublicMenuDish } from "./publicMenuCore.ts";

const PUBLIC_MENU_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((entry) => entry.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export function hasPublicMenu3d(dish: PublicMenuDish): boolean {
  return (
    isSafe3dAssetUrl(
      dish.webModel3dUrl || dish.model3dUrl,
      PUBLIC_MENU_3D_CDN_ORIGINS,
      "web"
    ) ||
    isSafe3dAssetUrl(dish.arModel3dUrl, PUBLIC_MENU_3D_CDN_ORIGINS, "arLite")
  );
}

/** A dish can open AR when it has a public 3D model or an iOS Quick Look USDZ. */
export function hasPublicMenuAr(dish: PublicMenuDish): boolean {
  return (
    hasPublicMenu3d(dish) ||
    isSafe3dAssetUrl(dish.arUsdzUrl || dish.usdzUrl, PUBLIC_MENU_3D_CDN_ORIGINS, "iosUsdz")
  );
}
