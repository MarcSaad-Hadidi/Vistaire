import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

import {
  DISH_PHOTO_DERIVATIVE_VARIANTS,
  type DishPhotoDerivativeMetadata,
  type DishPhotoDerivativeVariant
} from "./dishPhotoUpload.ts";

const DISH_PHOTO_DERIVATIVE_CONFIG: Record<
  DishPhotoDerivativeVariant,
  { width: number; quality: number }
> = {
  thumbnail: { width: 320, quality: 82 },
  display: { width: 1440, quality: 86 }
};

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
  for (const variant of DISH_PHOTO_DERIVATIVE_VARIANTS) {
    const config = DISH_PHOTO_DERIVATIVE_CONFIG[variant];
    const derivativeBytes = await sharp(bytes, { failOn: "error" })
      .rotate()
      .resize({
        width: config.width,
        height: config.width,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: config.quality, effort: 4 })
      .toBuffer();
    derivatives[variant] = {
      bytes: derivativeBytes,
      metadata: {
        storagePath: "",
        sha256: createHash("sha256").update(derivativeBytes).digest("hex"),
        contentType: "image/webp",
        bytes: derivativeBytes.byteLength,
        sourceSha256: sourceSha256.toLowerCase()
      }
    };
  }
  return derivatives;
}
