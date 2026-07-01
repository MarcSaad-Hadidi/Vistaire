import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  serializePublicMenuSettings,
  validatePublicMenuSettingsInput
} from "@/lib/menu/publicMenuSettings";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseMenuSettingsError = {
  code?: string;
  message?: string;
};

type SupabaseMenuSettingsClient = {
  from(table: "menus"): {
    update(row: Record<string, unknown>): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          select(columns: string): {
            single(): PromiseLike<{
              data: Record<string, unknown> | null;
              error: SupabaseMenuSettingsError | null;
            }>;
          };
        };
      };
    };
  };
};

function settingsInputFromBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const candidate = body as Record<string, unknown>;
  return candidate.publicMenuSettings ?? candidate.settings ?? candidate.settings_json ?? body;
}

export async function PATCH(
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

  const validated = validatePublicMenuSettingsInput(settingsInputFromBody(body));
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const settings = serializePublicMenuSettings(validated.value);
  const adminResult = getSupabaseAdminClient();
  if (!adminResult.ok) {
    return NextResponse.json(
      { ok: false, error: adminResult.reason },
      { status: 503 }
    );
  }

  const admin = adminResult.client as unknown as SupabaseMenuSettingsClient;
  const { data, error } = await admin
    .from("menus")
    .update({ settings_json: settings })
    .eq("restaurant_id", restaurantId)
    .eq("is_primary", true)
    .select("id,settings_json")
    .single();

  if (error || !data) {
    const missingColumn = error?.code === "42703" || /settings_json/i.test(error?.message ?? "");
    return NextResponse.json(
      {
        ok: false,
        error: missingColumn
          ? "La colonne menus.settings_json n'est pas disponible."
          : "Menu principal introuvable pour ce restaurant."
      },
      { status: missingColumn ? 503 : 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    restaurantId,
    menuId: data.id,
    settings
  });
}
