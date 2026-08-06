import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCanonicalUuid,
  isStorageSafeIdentifier
} from "@/lib/owner/storageSafeIdentifier";

export type PublicDishAssetKind = "photo" | "web-glb" | "ar-lite-glb" | "usdz";

type DishAssetAdmin =
  | { ok: true; client: SupabaseClient }
  | { ok: false; reason: string };

export type DishAssetVisibilityPolicy =
  | { kind: "public-available-only" }
  | { kind: "authorized-admin"; restaurantId: string };

type PublicDishAssetProfile = {
  bucket: "vistaire-media" | "vistaire-3d";
  bucketMetadataKey:
    | "photoStorageBucket"
    | "webModel3dStorageBucket"
    | "arModel3dStorageBucket"
    | "arUsdzStorageBucket";
  pathMetadataKey:
    | "photoStoragePath"
    | "webModel3dStoragePath"
    | "arModel3dStoragePath"
    | "arUsdzStoragePath";
  versionMetadataKey: "photoSha256" | "modelAssetVersion";
  pathSegments: readonly string[];
  extensions: readonly string[];
};

const PUBLIC_SIGNED_URL_TTL_SECONDS = 3600;
const ADMIN_SIGNED_URL_TTL_SECONDS = 600;

const ASSET_PROFILES: Record<PublicDishAssetKind, PublicDishAssetProfile> = {
  photo: {
    bucket: "vistaire-media",
    bucketMetadataKey: "photoStorageBucket",
    pathMetadataKey: "photoStoragePath",
    versionMetadataKey: "photoSha256",
    pathSegments: ["photos", "originals"],
    extensions: [".png", ".jpeg", ".jpg", ".webp", ".avif"]
  },
  "web-glb": {
    bucket: "vistaire-3d",
    bucketMetadataKey: "webModel3dStorageBucket",
    pathMetadataKey: "webModel3dStoragePath",
    versionMetadataKey: "modelAssetVersion",
    pathSegments: ["models", "web"],
    extensions: [".glb"]
  },
  "ar-lite-glb": {
    bucket: "vistaire-3d",
    bucketMetadataKey: "arModel3dStorageBucket",
    pathMetadataKey: "arModel3dStoragePath",
    versionMetadataKey: "modelAssetVersion",
    pathSegments: ["models", "ar-lite"],
    extensions: [".glb"]
  },
  usdz: {
    bucket: "vistaire-3d",
    bucketMetadataKey: "arUsdzStorageBucket",
    pathMetadataKey: "arUsdzStoragePath",
    versionMetadataKey: "modelAssetVersion",
    pathSegments: ["models", "ar-ios"],
    extensions: [".usdz"]
  }
};

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "private, no-store",
  "Vercel-CDN-Cache-Control": "private, no-store"
} as const;

export function publicDishAssetJsonError(
  message: string,
  status: 404 | 503
): Response {
  return Response.json(
    { ok: false, error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

function boundedDuration(startedAt: number): number {
  return Math.min(Math.max(performance.now() - startedAt, 0), 9_999.9);
}

function formatServerTiming(durations: {
  db: number;
  storageInfo: number;
  storageSign: number;
}): string {
  return [
    `db;dur=${durations.db.toFixed(1)}`,
    `storage-info;dur=${durations.storageInfo.toFixed(1)}`,
    `storage-sign;dur=${durations.storageSign.toFixed(1)}`
  ].join(", ");
}

function hasSafePathSyntax(storagePath: string): boolean {
  if (
    !storagePath ||
    storagePath.startsWith("/") ||
    storagePath.includes("\\") ||
    storagePath.includes("?") ||
    storagePath.includes("#") ||
    storagePath.includes("%") ||
    /^[a-z][a-z0-9+.-]*:/i.test(storagePath)
  ) {
    return false;
  }

  const segments = storagePath.split("/");
  return segments.every(
    (segment) =>
      Boolean(segment) &&
      segment !== "." &&
      segment !== ".." &&
      !segment.includes("..") &&
      /^[a-z0-9][a-z0-9._-]*$/i.test(segment)
  );
}

export function isAllowedPublicDishAssetLocation(args: {
  kind: PublicDishAssetKind;
  bucket: string;
  storagePath: string;
  restaurantId: string;
}): boolean {
  const profile = ASSET_PROFILES[args.kind];
  if (args.bucket !== profile.bucket || !hasSafePathSyntax(args.storagePath)) {
    return false;
  }

  const pathSegments = args.storagePath.split("/");
  const expectedPrefix = ["restaurants", args.restaurantId, ...profile.pathSegments];
  if (pathSegments.length !== expectedPrefix.length + 1) {
    return false;
  }
  if (expectedPrefix.some((segment, index) => pathSegments[index] !== segment)) {
    return false;
  }

  const filename = pathSegments.at(-1)?.toLowerCase() ?? "";
  return profile.extensions.some((extension) => filename.endsWith(extension));
}

export const isAllowedDishAssetLocation = isAllowedPublicDishAssetLocation;

function configuredSupabaseOrigin(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    const parsed = new URL(supabaseUrl);
    const isLocalHttp =
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    if (
      (parsed.protocol !== "https:" && !isLocalHttp) ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isExpectedSignedStorageUrl(args: {
  signedUrl: string;
  supabaseUrl: string | undefined;
  bucket: string;
  storagePath: string;
}): boolean {
  const expectedOrigin = configuredSupabaseOrigin(args.supabaseUrl);
  if (!expectedOrigin) return false;

  try {
    const parsed = new URL(args.signedUrl);
    const expectedPath = `/storage/v1/object/sign/${args.bucket}/${args.storagePath}`;
    return (
      parsed.origin === expectedOrigin &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === expectedPath &&
      !parsed.hash &&
      Boolean(parsed.searchParams.get("token"))
    );
  } catch {
    return false;
  }
}

async function redirectDishAsset(args: {
  admin: DishAssetAdmin;
  dishId: string;
  kind: PublicDishAssetKind;
  requestedAssetVersion?: string;
  supabaseUrl: string | undefined;
  notFoundMessage: string;
  unavailableMessage: string;
  assetVisibilityPolicy: DishAssetVisibilityPolicy;
}): Promise<Response> {
  if (!isCanonicalUuid(args.dishId)) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }
  if (!args.admin.ok) {
    return publicDishAssetJsonError(args.unavailableMessage, 503);
  }

  let dishResult;
  const dbStartedAt = performance.now();
  try {
    const dishQuery = args.admin.client
      .from("menu_dishes")
      .select("id,restaurant_id,is_available,metadata")
      .eq("id", args.dishId);
    if (args.assetVisibilityPolicy.kind === "authorized-admin") {
      dishQuery.eq("restaurant_id", args.assetVisibilityPolicy.restaurantId);
    }
    dishResult = await dishQuery.maybeSingle();
  } catch {
    return publicDishAssetJsonError(args.unavailableMessage, 503);
  }
  const dbDuration = boundedDuration(dbStartedAt);

  const dish = dishResult.data as Record<string, unknown> | null;
  if (dishResult.error) {
    return publicDishAssetJsonError(
      args.assetVisibilityPolicy.kind === "authorized-admin"
        ? args.unavailableMessage
        : args.notFoundMessage,
      args.assetVisibilityPolicy.kind === "authorized-admin" ? 503 : 404
    );
  }
  if (!dish) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }

  const dishRestaurantId =
    typeof dish.restaurant_id === "string" ? dish.restaurant_id.trim() : "";
  if (
    args.assetVisibilityPolicy.kind === "public-available-only" &&
    dish.is_available === false
  ) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }
  if (
    args.assetVisibilityPolicy.kind === "authorized-admin" &&
    (!isStorageSafeIdentifier(args.assetVisibilityPolicy.restaurantId) ||
      dishRestaurantId !== args.assetVisibilityPolicy.restaurantId)
  ) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }

  const metadata = metadataRecord(dish.metadata);
  const rawRequestedVersion = args.requestedAssetVersion?.trim() ?? "";
  const requestedVersion =
    args.kind === "photo" ? rawRequestedVersion.toLowerCase() : rawRequestedVersion;
  const profile = ASSET_PROFILES[args.kind];
  const activeVersion = metadataString(metadata, profile.versionMetadataKey);
  if (
    (args.kind === "photo" && Boolean(activeVersion) !== Boolean(requestedVersion)) ||
    (requestedVersion && requestedVersion !== activeVersion)
  ) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }

  const restaurantId = dishRestaurantId;
  const bucket = metadataString(metadata, profile.bucketMetadataKey) || profile.bucket;
  const storagePath = metadataString(metadata, profile.pathMetadataKey);
  if (
    !restaurantId ||
    !isAllowedDishAssetLocation({
      kind: args.kind,
      bucket,
      storagePath,
      restaurantId
    })
  ) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }

  const storage = args.admin.client.storage.from(bucket);
  try {
    const storageInfoStartedAt = performance.now();
    const objectInfo = await storage.info(storagePath);
    const storageInfoDuration = boundedDuration(storageInfoStartedAt);
    if (objectInfo.error) {
      const status =
        typeof objectInfo.error === "object" && objectInfo.error
          ? Number((objectInfo.error as { status?: unknown }).status)
          : Number.NaN;
      return publicDishAssetJsonError(
        status === 404 ? args.notFoundMessage : args.unavailableMessage,
        status === 404 ? 404 : 503
      );
    }
    if (!objectInfo.data) {
      return publicDishAssetJsonError(args.notFoundMessage, 404);
    }

    const storageSignStartedAt = performance.now();
    const signed = await storage.createSignedUrl(
      storagePath,
      args.assetVisibilityPolicy.kind === "authorized-admin"
        ? ADMIN_SIGNED_URL_TTL_SECONDS
        : PUBLIC_SIGNED_URL_TTL_SECONDS
    );
    const storageSignDuration = boundedDuration(storageSignStartedAt);
    const signedUrl = signed.data?.signedUrl;
    if (
      signed.error ||
      !signedUrl ||
      !isExpectedSignedStorageUrl({
        signedUrl,
        supabaseUrl: args.supabaseUrl,
        bucket,
        storagePath
      })
    ) {
      return publicDishAssetJsonError(args.unavailableMessage, 503);
    }

    const isVersioned = Boolean(requestedVersion);
    const isAuthorizedAdmin =
      args.assetVisibilityPolicy.kind === "authorized-admin";
    const headers: Record<string, string> = {
      Location: signedUrl,
      "Cache-Control": isAuthorizedAdmin
        ? "private, no-store"
        : isVersioned
        ? "public, max-age=120, must-revalidate"
        : "private, no-store",
      "CDN-Cache-Control": isAuthorizedAdmin
        ? "private, no-store"
        : isVersioned
        ? "public, s-maxage=2700"
        : "private, no-store",
      "Vercel-CDN-Cache-Control": isAuthorizedAdmin
        ? "private, no-store"
        : isVersioned
        ? "public, s-maxage=2700"
        : "private, no-store"
    };
    if (process.env.VERCEL_ENV === "preview") {
      headers["Server-Timing"] = formatServerTiming({
        db: dbDuration,
        storageInfo: storageInfoDuration,
        storageSign: storageSignDuration
      });
    }

    return new Response(null, {
      status: 307,
      headers
    });
  } catch {
    return publicDishAssetJsonError(args.unavailableMessage, 503);
  }
}

export async function redirectPublicDishAsset(args: {
  admin: DishAssetAdmin;
  dishId: string;
  kind: PublicDishAssetKind;
  requestedAssetVersion?: string;
  supabaseUrl: string | undefined;
  notFoundMessage: string;
  unavailableMessage: string;
}): Promise<Response> {
  return redirectDishAsset({
    ...args,
    assetVisibilityPolicy: { kind: "public-available-only" }
  });
}

export async function redirectAuthorizedAdminDishAsset(args: {
  admin: DishAssetAdmin;
  dishId: string;
  kind: PublicDishAssetKind;
  requestedAssetVersion?: string;
  supabaseUrl: string | undefined;
  restaurantId: string;
  notFoundMessage: string;
  unavailableMessage: string;
}): Promise<Response> {
  return redirectDishAsset({
    ...args,
    assetVisibilityPolicy: {
      kind: "authorized-admin",
      restaurantId: args.restaurantId
    }
  });
}
