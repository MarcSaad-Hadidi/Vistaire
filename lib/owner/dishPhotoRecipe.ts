import recipe from "./dishPhotoRecipe.json" with { type: "json" };

export const DISH_PHOTO_RECIPE = recipe as {
  readonly id: "dish-photo-v2";
  readonly schemaVersion: 2;
  readonly format: "webp";
  readonly variants: Readonly<Record<"thumbnail" | "card" | "display", { readonly width: number; readonly quality: number }>>;
  readonly sharpPolicy: {
    readonly failOn: "warning";
    readonly limitInputPixels: number;
    readonly limitInputChannels: number;
    readonly pages: number;
    readonly timeoutSeconds: number;
    readonly maxWidth: number;
    readonly maxHeight: number;
  };
  readonly encoder: string;
};

export const DISH_PHOTO_DERIVATIVE_VARIANTS = [
  "thumbnail",
  "card",
  "display"
] as const;

export type DishPhotoDerivativeVariant =
  (typeof DISH_PHOTO_DERIVATIVE_VARIANTS)[number];

export function isDishPhotoDerivativeVariant(value: unknown): value is DishPhotoDerivativeVariant {
  return typeof value === "string" && (DISH_PHOTO_DERIVATIVE_VARIANTS as readonly string[]).includes(value);
}
