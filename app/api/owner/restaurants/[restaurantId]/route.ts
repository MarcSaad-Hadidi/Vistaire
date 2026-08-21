import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  createRestaurantLifecyclePublicCommitHook,
  deleteRestaurantRecord
} from "@/lib/owner/restaurantStatus";
import { invalidateCommittedPublicMutation } from "@/lib/owner/menuMutationRevalidation";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RestaurantDeleteAdmin = Parameters<typeof deleteRestaurantRecord>[2]["admin"];

const invalidateRestaurantLifecyclePublicCommit =
  createRestaurantLifecyclePublicCommitHook(invalidateCommittedPublicMutation);

function getRestaurantDeleteAdmin(): RestaurantDeleteAdmin {
  return getSupabaseAdminClient() as RestaurantDeleteAdmin;
}

function deletePayload(body: unknown) {
  const candidate =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  return {
    confirmation:
      typeof candidate.confirmation === "string"
        ? candidate.confirmation
        : typeof candidate.confirmName === "string"
          ? candidate.confirmName
          : "",
    confirmed: candidate.confirmed === true,
    confirmName: typeof candidate.confirmName === "string" ? candidate.confirmName : "",
    deleteStorage: candidate.deleteStorage === true
  };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const { restaurantId } = await params;
  if (!restaurantId) {
    return NextResponse.json({ ok: false, error: "Restaurant requis." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }

  const deleted = await deleteRestaurantRecord(restaurantId, deletePayload(body), {
    admin: getRestaurantDeleteAdmin(),
    env: process.env,
    onPublicCommit: invalidateRestaurantLifecyclePublicCommit
  });

  if (!deleted.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: deleted.error,
        restaurantDeleted: deleted.restaurantDeleted,
        deleted: deleted.deleted,
        details: deleted.details,
        storage: deleted.storage,
        warnings: deleted.warnings
      },
      { status: deleted.status }
    );
  }

  return NextResponse.json({
    ok: true,
    restaurantId: deleted.restaurantId,
    restaurantDeleted: deleted.restaurantDeleted,
    deleted: deleted.deleted,
    skipped: deleted.skipped,
    storage: deleted.storage,
    warnings: deleted.warnings
  });
}
