import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  buildDishPhotoPublicPath,
  buildDishPhotoStoragePath,
  mergeDishPhotoMetadata,
  validateDishPhotoFile
} from "@/lib/owner/dishPhotoUpload";
import { revalidateOwnerMenuMutationPaths } from "@/lib/owner/menuMutationRevalidation";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_BUCKET = "vistaire-media";
const DEFAULT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const HARD_PHOTO_MAX_BYTES = 25 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 512 * 1024;

function photoMaxBytes(): number {
  const parsed = Number(process.env.VISTAIRE_DISH_PHOTO_MAX_BYTES);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > HARD_PHOTO_MAX_BYTES) {
    return DEFAULT_PHOTO_MAX_BYTES;
  }
  return parsed;
}

function getMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const { restaurantId, dishId } = await params;
  const maxBytes = photoMaxBytes();
  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (!rawContentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json({ ok: false, error: "Taille upload requise." }, { status: 411 });
  }
  if (contentLength > maxBytes + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ ok: false, error: "Photo trop volumineuse." }, { status: 413 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.reason }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Formulaire invalide." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Photo requise." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const validated = validateDishPhotoFile(
    {
      name: file.name,
      type: file.type,
      size: file.size,
      bytes
    },
    maxBytes
  );
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: validated.status }
    );
  }

  const { data: dish, error: dishError } = await admin.client
    .from("menu_dishes")
    .select("id,restaurant_id,slug,name,metadata")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (dishError) {
    return NextResponse.json(
      { ok: false, error: "Plat impossible a verifier." },
      { status: 503 }
    );
  }
  if (!dish) {
    return NextResponse.json(
      { ok: false, error: "Plat introuvable pour ce restaurant." },
      { status: 404 }
    );
  }

  let storagePath: string;
  let imageUrl: string;
  try {
    storagePath = buildDishPhotoStoragePath({
      restaurantId,
      dishId,
      dishSlug: typeof dish.slug === "string" && dish.slug ? dish.slug : String(dish.name ?? ""),
      extension: validated.extension,
      sha256: validated.sha256
    });
    imageUrl = buildDishPhotoPublicPath(dishId);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Identifiants photo invalides." },
      { status: 400 }
    );
  }

  const uploaded = await admin.client.storage.from(MEDIA_BUCKET).upload(
    storagePath,
    validated.bytes,
    {
      contentType: validated.contentType,
      cacheControl: "31536000",
      upsert: true
    }
  );
  if (uploaded.error) {
    return NextResponse.json(
      { ok: false, error: "Upload Supabase Storage impossible." },
      { status: 503 }
    );
  }

  const metadata = mergeDishPhotoMetadata(getMetadata(dish.metadata), {
    storageBucket: MEDIA_BUCKET,
    storagePath,
    sha256: validated.sha256,
    contentType: validated.contentType,
    bytes: validated.bytes.byteLength
  });
  const updated = await admin.client
    .from("menu_dishes")
    .update({ image_url: imageUrl, metadata })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (updated.error || !updated.data) {
    await admin.client.storage.from(MEDIA_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { ok: false, error: "Photo uploadee mais plat impossible a mettre a jour." },
      { status: 503 }
    );
  }

  await revalidateOwnerMenuMutationPaths({
    client: admin.client,
    restaurantId,
    dishSlug: typeof dish.slug === "string" ? dish.slug : undefined
  });

  return NextResponse.json({
    ok: true,
    imageUrl,
    storagePath,
    dishUpdated: true
  });
}
