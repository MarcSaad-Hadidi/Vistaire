import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import { runRestaurantMeshyDishPipeline } from "@/lib/owner/restaurantMeshyPipeline";
import {
  parseSourceUploadLimit,
  validateSourceGlbFile
} from "@/lib/owner/threeDSourceUploadModel";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

type DishRow = {
  id: string;
  restaurant_id: string;
  menu_id: string | null;
  slug: string | null;
  name: string | null;
  metadata: unknown;
};

function getString(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const uploadLimit = parseSourceUploadLimit(process.env);
  if (!uploadLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "Upload GLB mal configure." },
      { status: 503 }
    );
  }

  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (!rawContentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json({ ok: false, error: "Taille upload requise." }, { status: 411 });
  }
  if (contentLength > uploadLimit.maxBytes + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ ok: false, error: "GLB trop volumineux." }, { status: 413 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.reason }, { status: 503 });
  }

  const { restaurantId, dishId } = await params;
  const { data: dish, error: dishError } = await admin.client
    .from("menu_dishes")
    .select("id,restaurant_id,menu_id,slug,name,metadata")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle<DishRow>();

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Formulaire invalide." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "GLB requis." }, { status: 400 });
  }
  if (file.size > uploadLimit.maxBytes) {
    return NextResponse.json({ ok: false, error: "GLB trop volumineux." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const validated = validateSourceGlbFile(
    {
      name: file.name,
      type: file.type,
      size: file.size,
      bytes
    },
    uploadLimit.maxBytes
  );
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: validated.status }
    );
  }

  const restaurant = await admin.client
    .from("restaurants")
    .select("slug")
    .eq("id", restaurantId)
    .maybeSingle();
  const menu = dish.menu_id
    ? await admin.client
        .from("menus")
        .select("slug")
        .eq("id", dish.menu_id)
        .eq("restaurant_id", restaurantId)
        .maybeSingle()
    : { data: null };

  const restaurantSlug = slugifyRestaurantSlug(getString(restaurant.data, "slug") || restaurantId);
  const menuSlug = slugifyRestaurantSlug(getString(menu.data, "slug") || "principal");
  const dishSlug = slugifyRestaurantSlug(dish.slug || dish.name || dishId);

  try {
    const result = await runRestaurantMeshyDishPipeline({
      adminClient: admin.client,
      owner: {
        userId: owner.userId,
        email: owner.emailAddresses[0] ?? null
      },
      restaurantId,
      restaurantSlug,
      menuSlug,
      dishId,
      dishSlug,
      existingMetadata: dish.metadata,
      sourceBytes: validated.bytes,
      originalName: validated.originalName
    });

    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        storagePath: result.manifestPath,
        manifestPath: result.manifestPath,
        manifestUrl: result.manifestUrl,
        model3dUrl: result.model3dUrl,
        webModel3dUrl: result.webModel3dUrl,
        arModel3dUrl: result.arModel3dUrl,
        arUsdzUrl: result.arUsdzUrl,
        job: { id: result.jobId },
        dishUpdated: true
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline Meshy impossible.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Unknown") ? 422 : 503 }
    );
  }
}
