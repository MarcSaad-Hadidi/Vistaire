import { isSafe3dAssetUrl, PUBLIC_3D_CDN_ORIGINS } from "../dish3dManifest.ts";
import type { PublicMenuDish } from "./publicMenuCore.ts";

type PublicMenu3dFields = Pick<
  PublicMenuDish,
  "webModel3dUrl" | "model3dUrl" | "arModel3dUrl"
>;

export function hasPublicMenu3d(dish: PublicMenu3dFields): boolean {
  return (
    isSafe3dAssetUrl(
      dish.webModel3dUrl || dish.model3dUrl,
      PUBLIC_3D_CDN_ORIGINS,
      "web"
    ) ||
    isSafe3dAssetUrl(dish.arModel3dUrl, PUBLIC_3D_CDN_ORIGINS, "arLite")
  );
}

/** A dish can open AR when it has a public 3D model or an iOS Quick Look USDZ. */
export function hasPublicMenuAr(dish: PublicMenuDish): boolean {
  return (
    hasPublicMenu3d(dish) ||
    isSafe3dAssetUrl(dish.arUsdzUrl || dish.usdzUrl, PUBLIC_3D_CDN_ORIGINS, "iosUsdz")
  );
}
