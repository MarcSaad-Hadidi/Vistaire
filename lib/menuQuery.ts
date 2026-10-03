import type { Dish } from "@/lib/demoMenuData";

export function dishHasImmersiveAsset(
  dish: Pick<
    Dish,
    "model3dUrl" | "webModel3dUrl" | "arModel3dUrl" | "usdzUrl" | "arUsdzUrl"
  >
): boolean {
  return Boolean(
    dish.arModel3dUrl?.trim() ||
      dish.webModel3dUrl?.trim() ||
      dish.model3dUrl?.trim() ||
      dish.arUsdzUrl?.trim()
  );
}
