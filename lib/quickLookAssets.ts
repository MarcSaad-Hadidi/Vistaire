import type { Dish } from "@/lib/demoMenuData";

type QuickLookDish = Pick<Dish, "arUsdzUrl">;

export function resolveActiveQuickLookUsdzUrl(dish: QuickLookDish): string {
  const url = dish.arUsdzUrl?.trim() ?? "";
  if (!url) return "";
  if (/[?#]/.test(url)) return "";
  if (!url.startsWith("/models/demo/ar-lite/")) return "";
  if (!url.endsWith(".usdz")) return "";
  return url;
}

export function hasActiveQuickLookUsdzUrl(dish: QuickLookDish): boolean {
  return Boolean(resolveActiveQuickLookUsdzUrl(dish));
}
