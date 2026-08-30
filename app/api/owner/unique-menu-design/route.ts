import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { isCanonicalUuid } from "@/lib/owner/storageSafeIdentifier";
import {
  getUniqueMenuDesignSnapshot,
  mutateUniqueMenuDesignLifecycle
} from "@/lib/owner/uniqueMenuDesignStore";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
import { isUniqueMenuDesignAction } from "@/lib/menu/uniqueMenuDesign";
import {
  invalidateCommittedPublicMutation,
  resolvePublicMutationIdentity
} from "@/lib/owner/menuMutationRevalidation";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readBody(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  return request
    .json()
    .then((body) =>
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null
    )
    .catch(() => null);
}

export async function GET(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const restaurantId =
    request.nextUrl.searchParams.get("restaurantId")?.trim() ?? "";
  if (!isCanonicalUuid(restaurantId)) {
    return NextResponse.json(
      { ok: false, error: "restaurantId invalide." },
      { status: 400 }
    );
  }

  const snapshot = await getUniqueMenuDesignSnapshot(restaurantId);
  if (!snapshot.ok) {
    return NextResponse.json(
      { ok: false, error: snapshot.error },
      { status: snapshot.status }
    );
  }

  return NextResponse.json({
    ok: true,
    restaurantId: snapshot.restaurantId,
    style: snapshot.style,
    uniqueDesign: snapshot.uniqueDesign,
    availableRenderers: snapshot.availableRenderers,
    draftStatus: snapshot.draftStatus,
    publishedStatus: snapshot.publishedStatus
  });
}

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const body = await readBody(request);
  if (!body) {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }

  const restaurantId =
    typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const expectedDesignId =
    typeof body.expectedDesignId === "string"
      ? body.expectedDesignId.trim()
      : typeof body.designId === "string"
        ? body.designId.trim()
        : "";
  const expectedVersion =
    typeof body.expectedVersion === "number"
      ? body.expectedVersion
      : typeof body.version === "number"
        ? body.version
        : null;
  const rendererKey =
    typeof body.rendererKey === "string" ? body.rendererKey.trim() : null;

  if (!isCanonicalUuid(restaurantId)) {
    return NextResponse.json(
      { ok: false, error: "restaurantId invalide." },
      { status: 400 }
    );
  }
  const capability = await requireOwnerRestaurantCapability(
    restaurantId,
    "canEditMenuSettings"
  );
  if (!capability.ok) {
    return NextResponse.json(
      { ok: false, error: capability.error },
      { status: capability.status }
    );
  }
  if (!isUniqueMenuDesignAction(action)) {
    return NextResponse.json(
      { ok: false, error: "Action unique non autorisee." },
      { status: 400 }
    );
  }
  const admin = getSupabaseAdminClient();
  const mutationIdentity = admin.ok
    ? await resolvePublicMutationIdentity({
        client: admin.client,
        restaurantId
      })
    : null;

  const result = await mutateUniqueMenuDesignLifecycle({
    restaurantId,
    action,
    expectedDesignId: expectedDesignId || null,
    expectedVersion,
    rendererKey,
    onPublicCommit: async () => {
      await invalidateCommittedPublicMutation(mutationIdentity);
    }
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    uniqueDesign: result.uniqueDesign,
    availableRenderers: result.availableRenderers,
    draftPersisted: result.draftPersisted,
    publishedPersisted: result.publishedPersisted
  });
}
