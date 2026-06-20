import { createHash } from "node:crypto";

type DishPhotoFile = {
  name: string;
  type: string;
  size: number;
  bytes: ArrayBuffer | ArrayBufferView;
};

type DishPhotoValidationResult =
  | {
      ok: true;
      extension: "jpg" | "png" | "webp";
      contentType: "image/jpeg" | "image/png" | "image/webp";
      bytes: Buffer;
      sha256: string;
    }
  | {
      ok: false;
      status: 400 | 413;
      error: string;
    };

type DishPhotoMetadataInfo = {
  storageBucket: string;
  storagePath: string;
  sha256: string;
  contentType: string;
  bytes: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

const MIME_TO_EXTENSION = new Map<
  string,
  { extension: "jpg" | "png" | "webp"; contentType: "image/jpeg" | "image/png" | "image/webp" }
>([
  ["image/jpeg", { extension: "jpg", contentType: "image/jpeg" }],
  ["image/png", { extension: "png", contentType: "image/png" }],
  ["image/webp", { extension: "webp", contentType: "image/webp" }]
]);

function toBuffer(bytes: ArrayBuffer | ArrayBufferView): Buffer {
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function hasMatchingSignature(contentType: string, bytes: Buffer): boolean {
  if (contentType === "image/jpeg") {
    return (
      bytes.byteLength >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (contentType === "image/png") {
    return bytes.byteLength >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }
  if (contentType === "image/webp") {
    return (
      bytes.byteLength >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export function validateDishPhotoFile(
  file: DishPhotoFile,
  maxBytes: number
): DishPhotoValidationResult {
  if (/[\\/]/.test(file.name) || file.name.includes("..")) {
    return {
      ok: false,
      status: 400,
      error: "Le nom de fichier photo ne doit pas contenir de chemin."
    };
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, status: 400, error: "Photo vide." };
  }
  if (size > maxBytes) {
    return { ok: false, status: 413, error: "Photo trop volumineuse." };
  }

  const contentType = (file.type || "").split(";")[0].trim().toLowerCase();
  const mime = MIME_TO_EXTENSION.get(contentType);
  if (!mime) {
    return {
      ok: false,
      status: 400,
      error: "Seules les images JPEG, PNG ou WebP sont acceptees."
    };
  }

  const bytes = toBuffer(file.bytes);
  if (bytes.byteLength !== size || bytes.byteLength > maxBytes) {
    return {
      ok: false,
      status: 400,
      error: "La taille de la photo ne correspond pas au fichier envoye."
    };
  }
  if (!hasMatchingSignature(mime.contentType, bytes)) {
    return {
      ok: false,
      status: 400,
      error: "Le contenu du fichier ne correspond pas a une image acceptee."
    };
  }

  return {
    ok: true,
    ...mime,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

export function buildDishPhotoStoragePath(args: {
  restaurantId: string;
  dishId: string;
  dishSlug: string;
  extension: "jpg" | "png" | "webp";
  sha256: string;
}): string {
  if (
    !UUID_PATTERN.test(args.restaurantId) ||
    !UUID_PATTERN.test(args.dishId) ||
    !SHA256_PATTERN.test(args.sha256)
  ) {
    throw new Error("Identifiants photo invalides.");
  }
  const slug = slugify(args.dishSlug) || args.dishId;
  return [
    "restaurants",
    args.restaurantId,
    "photos",
    "originals",
    `${slug}-${args.sha256.toLowerCase().slice(0, 12)}.${args.extension}`
  ].join("/");
}

export function buildDishPhotoPublicPath(dishId: string): string {
  if (!UUID_PATTERN.test(dishId)) {
    throw new Error("Identifiant plat invalide.");
  }
  return `/api/public/menu-dishes/${dishId}/photo`;
}

export function mergeDishPhotoMetadata(
  existing: unknown,
  info: DishPhotoMetadataInfo
): Record<string, unknown> {
  const metadata =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};

  return {
    ...metadata,
    photoStatus: "ready",
    photoStorageBucket: info.storageBucket,
    photoStoragePath: info.storagePath,
    photoSha256: info.sha256.toLowerCase(),
    photoContentType: info.contentType,
    photoBytes: info.bytes
  };
}
