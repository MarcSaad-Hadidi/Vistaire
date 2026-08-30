import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

import {
  DISH_PHOTO_DERIVATIVE_VARIANTS,
  type DishPhotoDerivativeMetadata,
  type DishPhotoDerivativeVariant
} from "./dishPhotoUpload.ts";
import { DISH_PHOTO_RECIPE } from "./dishPhotoRecipe.ts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export async function generateDishPhotoDerivatives(
  bytes: Buffer,
  sourceSha256: string
): Promise<
  Partial<
    Record<
      DishPhotoDerivativeVariant,
      { bytes: Buffer; metadata: DishPhotoDerivativeMetadata }
    >
  >
> {
  if (!SHA256_PATTERN.test(sourceSha256)) {
    throw new Error("Identifiant photo invalide.");
  }

  const derivatives: Partial<
    Record<
      DishPhotoDerivativeVariant,
      { bytes: Buffer; metadata: DishPhotoDerivativeMetadata }
    >
  > = {};
  const source = sharp(bytes, {
    failOn: DISH_PHOTO_RECIPE.sharpPolicy.failOn,
    limitInputPixels: DISH_PHOTO_RECIPE.sharpPolicy.limitInputPixels,
    limitInputChannels: DISH_PHOTO_RECIPE.sharpPolicy.limitInputChannels,
    pages: DISH_PHOTO_RECIPE.sharpPolicy.pages
  }).rotate();
  for (const variant of DISH_PHOTO_DERIVATIVE_VARIANTS) {
    const config = DISH_PHOTO_RECIPE.variants[variant];
    const result = await source
      .clone()
      .resize({ width: config.width, height: config.width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: config.quality, effort: 4 })
      .timeout({ seconds: DISH_PHOTO_RECIPE.sharpPolicy.timeoutSeconds })
      .toBuffer({ resolveWithObject: true });
    const derivativeBytes = result.data;
    const outputSha256 = createHash("sha256").update(derivativeBytes).digest("hex");
    derivatives[variant] = {
      bytes: derivativeBytes,
      metadata: {
        storagePath: "",
        schemaVersion: DISH_PHOTO_RECIPE.schemaVersion,
        recipeId: DISH_PHOTO_RECIPE.id,
        variant,
        sha256: outputSha256,
        outputSha256,
        contentType: "image/webp",
        format: "webp",
        width: Number(result.info.width ?? 0),
        height: Number(result.info.height ?? 0),
        bytes: derivativeBytes.byteLength,
        sourceSha256: sourceSha256.toLowerCase(),
        generatedAt: new Date().toISOString(),
        encoder: DISH_PHOTO_RECIPE.encoder
      }
    };
  }
  return derivatives;
}
