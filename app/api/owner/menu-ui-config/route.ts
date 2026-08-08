import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { validateMenuUiConfig } from "@/lib/menu/menuUiConfig";
import {
  duplicatePublishedMenuUiConfigToDraft,
  getOwnerMenuUiConfig,
  getOwnerMenuUiConfigHistory,
  publishMenuUiConfig,
  rollbackPublishedMenuUiConfig,
  saveDraftMenuUiConfig
} from "@/lib/owner/menuUiConfigStore";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function restaurantIdFromRequest(request: NextRequest): string {
  return request.nextUrl.searchParams.get("restaurantId")?.trim() ?? "";
}

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function persistenceUnavailable(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 503 });
}

export async function GET(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const restaurantId = restaurantIdFromRequest(request);
  if (request.nextUrl.searchParams.get("history") === "1") {
    const history = await getOwnerMenuUiConfigHistory(restaurantId);
    return NextResponse.json({
      ok: true,
      history: history.records,
      error: history.error
    });
  }

  const loaded = await getOwnerMenuUiConfig(restaurantId);

  return NextResponse.json({
    ok: true,
    config: loaded.record.config,
    status: loaded.record.status,
    persisted: loaded.record.persisted,
    dataSource: loaded.record.dataSource,
    updatedAt: loaded.record.updatedAt,
    error: loaded.error
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
  const action = typeof body.action === "string" ? body.action : "save";
  const result =
    action === "rollback"
      ? await rollbackPublishedMenuUiConfig({
          restaurantId,
          targetConfigId:
            typeof body.targetConfigId === "string"
              ? body.targetConfigId.trim()
              : undefined
        })
      : action === "revert-to-published"
        ? await duplicatePublishedMenuUiConfigToDraft({ restaurantId })
        : await (() => {
            const validated = validateMenuUiConfig(body.config);
            if (!validated.ok) return Promise.resolve({ ok: false as const, status: 400, error: validated.error });
            return action === "publish"
              ? publishMenuUiConfig({ restaurantId, config: validated.value })
              : saveDraftMenuUiConfig({ restaurantId, config: validated.value });
          })();

  if (!result.ok) {
    if (result.status === 503) return persistenceUnavailable(result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    config: result.record.config,
    status: result.record.status,
    persisted: result.record.persisted,
    dataSource: result.record.dataSource,
    updatedAt: result.record.updatedAt
  });
}

export async function PATCH(request: NextRequest) {
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
  const validated = validateMenuUiConfig(body.config);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const saved = await saveDraftMenuUiConfig({
    restaurantId,
    config: validated.value
  });
  if (!saved.ok) {
    if (saved.status === 503) return persistenceUnavailable(saved.error);
    return NextResponse.json({ ok: false, error: saved.error }, { status: saved.status });
  }

  return NextResponse.json({
    ok: true,
    config: saved.record.config,
    status: saved.record.status,
    persisted: saved.record.persisted,
    dataSource: saved.record.dataSource,
    updatedAt: saved.record.updatedAt
  });
}
