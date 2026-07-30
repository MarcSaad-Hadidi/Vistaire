import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCanonicalUuid } from "@/lib/owner/storageSafeIdentifier";

export type PublicDishAssetKind = "photo" | "web-glb" | "ar-lite-glb" | "usdz";

type PublicDishAssetAdmin =
  | { ok: true; client: SupabaseClient }
  | { ok: false; reason: string };

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
  pathSegments: readonly string[];
  extensions: readonly string[];
};

const SIGNED_URL_TTL_SECONDS = 3600;

const ASSET_PROFILES: Record<PublicDishAssetKind, PublicDishAssetProfile> = {
  photo: {
    bucket: "vistaire-media",
    bucketMetadataKey: "photoStorageBucket",
    pathMetadataKey: "photoStoragePath",
    pathSegments: ["photos", "originals"],
    extensions: [".png", ".jpeg", ".jpg", ".webp", ".avif"]
  },
  "web-glb": {
    bucket: "vistaire-3d",
    bucketMetadataKey: "webModel3dStorageBucket",
    pathMetadataKey: "webModel3dStoragePath",
    pathSegments: ["models", "web"],
    extensions: [".glb"]
  },
  "ar-lite-glb": {
    bucket: "vistaire-3d",
    bucketMetadataKey: "arModel3dStorageBucket",
    pathMetadataKey: "arModel3dStoragePath",
    pathSegments: ["models", "ar-lite"],
    extensions: [".glb"]
  },
  usdz: {
    bucket: "vistaire-3d",
    bucketMetadataKey: "arUsdzStorageBucket",
    pathMetadataKey: "arUsdzStoragePath",
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

function jsonError(message: string, status: 404 | 503): Response {
  return Response.json({ ok: false, error: message }, { status });
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

export async function redirectPublicDishAsset(args: {
  admin: PublicDishAssetAdmin;
  dishId: string;
  kind: PublicDishAssetKind;
  requestedAssetVersion?: string;
  supabaseUrl: string | undefined;
  notFoundMessage: string;
  unavailableMessage: string;
}): Promise<Response> {
  if (!isCanonicalUuid(args.dishId)) {
    return jsonError(args.notFoundMessage, 404);
  }
  if (!args.admin.ok) {
    return jsonError(args.unavailableMessage, 503);
  }

  let dishResult;
  try {
    dishResult = await args.admin.client
      .from("menu_dishes")
      .select("id,restaurant_id,is_available,metadata")
      .eq("id", args.dishId)
      .maybeSingle();
  } catch {
    return jsonError(args.unavailableMessage, 503);
  }

  const dish = dishResult.data as Record<string, unknown> | null;
  if (dishResult.error || !dish || dish.is_available === false) {
    return jsonError(args.notFoundMessage, 404);
  }

  const metadata = metadataRecord(dish.metadata);
  const requestedVersion = args.requestedAssetVersion?.trim() ?? "";
  if (requestedVersion && requestedVersion !== metadataString(metadata, "modelAssetVersion")) {
    return jsonError(args.notFoundMessage, 404);
  }

  const restaurantId =
    typeof dish.restaurant_id === "string" ? dish.restaurant_id.trim() : "";
  const profile = ASSET_PROFILES[args.kind];
  const bucket = metadataString(metadata, profile.bucketMetadataKey) || profile.bucket;
  const storagePath = metadataString(metadata, profile.pathMetadataKey);
  if (
    !restaurantId ||
    !isAllowedPublicDishAssetLocation({
      kind: args.kind,
      bucket,
      storagePath,
      restaurantId
    })
  ) {
    return jsonError(args.notFoundMessage, 404);
  }

  const storage = args.admin.client.storage.from(bucket);
  try {
    const objectInfo = await storage.info(storagePath);
    if (objectInfo.error || !objectInfo.data) {
      return jsonError(args.notFoundMessage, 404);
    }

    const signed = await storage.createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
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
      return jsonError(args.unavailableMessage, 503);
    }

    return new Response(null, {
      status: 307,
      headers: {
        Location: signedUrl,
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "private, no-store",
        "Vercel-CDN-Cache-Control": "private, no-store"
      }
    });
  } catch {
    return jsonError(args.unavailableMessage, 503);
  }
}
