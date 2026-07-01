import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import { runRestaurantMeshyDishPipeline } from "@/lib/owner/restaurantMeshyPipeline";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL_BUCKET = "vistaire-3d";

type PublishBody = {
  sourceStoragePath?: unknown;
};

type DishRow = {
  id: string;
  restaurant_id: string;
  menu_id: string | null;
  slug: string | null;
  name: string | null;
  metadata: unknown;
};

function getMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function revalidatePublicDishModelPaths(restaurantSlug: string, dishSlug: string): void {
  if (!restaurantSlug) return;
  revalidatePath(`/menu/${restaurantSlug}`);
  if (dishSlug) revalidatePath(`/menu/${restaurantSlug}/dishes/${dishSlug}`);
}

function safeStoragePath(value: unknown, prefix: string): string {
  const path = typeof value === "string" ? value.trim() : "";
  if (
    !path ||
    path.includes("..") ||
    path.includes("\\") ||
    !path.startsWith(prefix) ||
    !path.toLowerCase().endsWith(".glb")
  ) {
    return "";
  }
  return path;
}

async function downloadStorageBytes(
  storage: SupabaseClient["storage"],
  path: string
): Promise<Buffer | null> {
  const downloaded = await storage.from(MODEL_BUCKET).download(path);
  if (downloaded.error || !downloaded.data) return null;
  return Buffer.from(await downloaded.data.arrayBuffer());
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.reason }, { status: 503 });
  }

  const { restaurantId, dishId } = await params;
  let body: PublishBody = {};
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    body = {};
  }

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

  const metadata = getMetadata(dish.metadata);
  const sourceStoragePath = safeStoragePath(
    body.sourceStoragePath || metadata.preparedGlbStoragePath,
    `restaurants/${restaurantId}/models/staging/`
  );
  if (!sourceStoragePath) {
    return NextResponse.json(
      { ok: false, error: "GLB staging introuvable pour ce plat." },
      { status: 409 }
    );
  }

  const sourceBytes = await downloadStorageBytes(admin.client.storage, sourceStoragePath);
  if (!sourceBytes) {
    return NextResponse.json(
      { ok: false, error: "GLB staging introuvable dans Storage." },
      { status: 404 }
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
      sourceBytes,
      originalName: `${dishSlug}.glb`
    });

    revalidatePublicDishModelPaths(restaurantSlug, dishSlug);

    return NextResponse.json({
      ok: true,
      status: result.status,
      storagePath: result.manifestPath,
      manifestPath: result.manifestPath,
      manifestUrl: result.manifestUrl,
      model3dUrl: result.model3dUrl,
      webModel3dUrl: result.webModel3dUrl,
      arModel3dUrl: result.arModel3dUrl,
      arUsdzUrl: result.arUsdzUrl,
      webModel3dBytes: result.webModel3dBytes,
      arModel3dBytes: result.arModel3dBytes,
      arUsdzBytes: result.arUsdzBytes,
      job: { id: result.jobId },
      dishUpdated: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline Meshy impossible.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Unknown") ? 422 : 503 }
    );
  }
}
