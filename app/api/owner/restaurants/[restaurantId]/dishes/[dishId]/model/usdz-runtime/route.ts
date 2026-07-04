import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import {
  DEFAULT_USDZ_OPTIMIZATION_PROFILE,
  isUsdzOptimizationProfile,
  parseUsdzRuntimeMaxBytes,
  parseUsdzSourceUploadLimit,
  validateUsdzFile
} from "@/lib/owner/usdzRuntimeModel";
import { runUsdzRuntimePipeline } from "@/lib/owner/usdzRuntimePipeline";
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

function revalidatePublicDishModelPaths(restaurantSlug: string, dishSlug: string): void {
  if (!restaurantSlug) return;
  revalidatePath(`/menu/${restaurantSlug}`);
  if (dishSlug) revalidatePath(`/menu/${restaurantSlug}/dishes/${dishSlug}`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const sourceLimit = parseUsdzSourceUploadLimit(process.env);
  const runtimeLimit = parseUsdzRuntimeMaxBytes(process.env);
  if (!sourceLimit.ok || !runtimeLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "Optimiseur USDZ mal configure." },
      { status: 503 }
    );
  }

  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (!rawContentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json({ ok: false, error: "Taille upload requise." }, { status: 411 });
  }
  if (contentLength > sourceLimit.maxBytes + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ ok: false, error: "USDZ source trop volumineux." }, { status: 413 });
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
    return NextResponse.json({ ok: false, error: "Plat impossible a verifier." }, { status: 503 });
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
    return NextResponse.json({ ok: false, error: "USDZ requis." }, { status: 400 });
  }
  if (file.size > sourceLimit.maxBytes) {
    return NextResponse.json({ ok: false, error: "USDZ source trop volumineux." }, { status: 413 });
  }

  const rawProfile = formData.get("profile");
  const profile =
    typeof rawProfile === "string" && isUsdzOptimizationProfile(rawProfile)
      ? rawProfile
      : DEFAULT_USDZ_OPTIMIZATION_PROFILE;

  const bytes = Buffer.from(await file.arrayBuffer());
  const validated = validateUsdzFile(
    { name: file.name, type: file.type, size: file.size, bytes },
    sourceLimit.maxBytes
  );
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: validated.status });
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
    const result = await runUsdzRuntimePipeline({
      adminClient: admin.client,
      owner: { userId: owner.userId, email: owner.emailAddresses[0] ?? null },
      restaurantId,
      restaurantSlug,
      menuSlug,
      dishId,
      dishSlug,
      existingMetadata: dish.metadata,
      sourceBytes: validated.bytes,
      originalName: validated.originalName,
      profile,
      maxRuntimeBytes: runtimeLimit.maxBytes
    });

    revalidatePublicDishModelPaths(restaurantSlug, dishSlug);

    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        version: result.version,
        arUsdzUrl: result.arUsdzUrl,
        usdzRuntimeBytes: result.usdzRuntimeBytes,
        usdzSourceBytes: result.usdzSourceBytes,
        usdzSourceStored: false,
        reductionPercent: result.reductionPercent,
        profile: result.profile,
        geometryOptimization: result.geometryOptimization,
        quickLookQaStatus: "not-tested",
        warnings: result.warnings,
        fails: result.fails,
        job: { id: result.jobId },
        dishUpdated: true
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Optimisation USDZ impossible.";
    return NextResponse.json(
      { ok: false, error: message, usdzSourceStored: false, uploaded: false },
      { status: 503 }
    );
  }
}
