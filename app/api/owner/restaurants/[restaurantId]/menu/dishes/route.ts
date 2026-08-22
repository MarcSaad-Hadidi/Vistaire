import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  createOwnerMenuDish,
  deleteOwnerMenuDish,
  updateOwnerMenuDish,
  type OwnerMenuPublicCommitCallback
} from "@/lib/owner/menuMutations";
import {
  invalidateCommittedPublicMutation,
  resolvePublicMutationIdentity,
  type PublicMutationIdentity
} from "@/lib/owner/menuMutationRevalidation";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function restaurantIdFromParams(params: { restaurantId: string }): string {
  return typeof params.restaurantId === "string" ? params.restaurantId.trim() : "";
}

function publicCommitCallback(
  identity: PublicMutationIdentity | null
): OwnerMenuPublicCommitCallback {
  return async ({ dishSlug }) => {
    const canonicalDishSlug = slugifyRestaurantSlug(dishSlug ?? "");
    await invalidateCommittedPublicMutation(
      identity && canonicalDishSlug
        ? { ...identity, dishSlug: canonicalDishSlug }
        : identity
    );
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const auth = await requireVistaireOwnerApi();
  if (!auth.ok) return auth.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin indisponible." },
      { status: 503 }
    );
  }

  const restaurantId = restaurantIdFromParams(await params);
  if (!restaurantId) {
    return NextResponse.json(
      { ok: false, error: "Restaurant requis." },
      { status: 400 }
    );
  }
  const capability = await requireOwnerRestaurantCapability(restaurantId, "canEditMenuContent");
  if (!capability.ok) {
    return NextResponse.json({ ok: false, error: capability.error }, { status: capability.status });
  }

  const publicIdentity = await resolvePublicMutationIdentity({
    client: admin.client,
    restaurantId
  });

  const result = await createOwnerMenuDish({
    client: admin.client,
    restaurantId,
    input: await readJsonBody(request),
    onPublicCommit: publicCommitCallback(publicIdentity)
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ ok: true, dish: result.record });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const auth = await requireVistaireOwnerApi();
  if (!auth.ok) return auth.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin indisponible." },
      { status: 503 }
    );
  }

  const restaurantId = restaurantIdFromParams(await params);
  if (!restaurantId) {
    return NextResponse.json(
      { ok: false, error: "Restaurant requis." },
      { status: 400 }
    );
  }
  const capability = await requireOwnerRestaurantCapability(restaurantId, "canEditMenuContent");
  if (!capability.ok) {
    return NextResponse.json({ ok: false, error: capability.error }, { status: capability.status });
  }

  const publicIdentity = await resolvePublicMutationIdentity({
    client: admin.client,
    restaurantId
  });

  const result = await deleteOwnerMenuDish({
    client: admin.client,
    restaurantId,
    input: await readJsonBody(request),
    onPublicCommit: publicCommitCallback(publicIdentity)
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    dish: result.record,
    mediaCleanup: (result.record as { mediaCleanup?: unknown }).mediaCleanup
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const auth = await requireVistaireOwnerApi();
  if (!auth.ok) return auth.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin indisponible." },
      { status: 503 }
    );
  }

  const restaurantId = restaurantIdFromParams(await params);
  if (!restaurantId) {
    return NextResponse.json(
      { ok: false, error: "Restaurant requis." },
      { status: 400 }
    );
  }
  const capability = await requireOwnerRestaurantCapability(restaurantId, "canEditMenuContent");
  if (!capability.ok) {
    return NextResponse.json({ ok: false, error: capability.error }, { status: capability.status });
  }

  const publicIdentity = await resolvePublicMutationIdentity({
    client: admin.client,
    restaurantId
  });

  const result = await updateOwnerMenuDish({
    client: admin.client,
    restaurantId,
    input: await readJsonBody(request),
    onPublicCommit: publicCommitCallback(publicIdentity)
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ ok: true, dish: result.record });
}
