import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  createOwnerMenuDish,
  deleteOwnerMenuDish,
  updateOwnerMenuDish
} from "@/lib/owner/menuMutations";
import { revalidateOwnerMenuMutationPaths } from "@/lib/owner/menuMutationRevalidation";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

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

  const result = await createOwnerMenuDish({
    client: admin.client,
    restaurantId,
    input: await readJsonBody(request)
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  await revalidateOwnerMenuMutationPaths({
    client: admin.client,
    restaurantId,
    dishSlug: typeof result.record.slug === "string" ? result.record.slug : undefined
  });

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

  const result = await deleteOwnerMenuDish({
    client: admin.client,
    restaurantId,
    input: await readJsonBody(request)
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  await revalidateOwnerMenuMutationPaths({
    client: admin.client,
    restaurantId,
    dishSlug: typeof result.record.slug === "string" ? result.record.slug : undefined
  });

  return NextResponse.json({ ok: true, dish: result.record });
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

  const result = await updateOwnerMenuDish({
    client: admin.client,
    restaurantId,
    input: await readJsonBody(request)
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  await revalidateOwnerMenuMutationPaths({
    client: admin.client,
    restaurantId,
    dishSlug: typeof result.record.slug === "string" ? result.record.slug : undefined
  });

  return NextResponse.json({ ok: true, dish: result.record });
}
