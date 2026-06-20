import { NextResponse, type NextRequest } from "next/server";
import { buildPreparedModelPublicGlbPath } from "@/lib/owner/preparedModelWorkflow";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_BUCKET = "vistaire-3d";

function getMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dishId: string }> }
) {
  const { dishId } = await params;
  try {
    buildPreparedModelPublicGlbPath(dishId);
  } catch {
    return NextResponse.json({ ok: false, error: "Modele introuvable." }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "Modele indisponible." }, { status: 503 });
  }

  const { data: dish, error } = await admin.client
    .from("menu_dishes")
    .select("id,is_available,metadata")
    .eq("id", dishId)
    .maybeSingle();
  if (error || !dish || dish.is_available === false) {
    return NextResponse.json({ ok: false, error: "Modele introuvable." }, { status: 404 });
  }

  const metadata = getMetadata(dish.metadata);
  const bucket = getString(metadata, "webModel3dStorageBucket") || MODEL_BUCKET;
  const storagePath = getString(metadata, "webModel3dStoragePath");
  if (
    !storagePath ||
    storagePath.includes("..") ||
    storagePath.includes("\\") ||
    !storagePath.endsWith(".glb")
  ) {
    return NextResponse.json({ ok: false, error: "Modele introuvable." }, { status: 404 });
  }

  const downloaded = await admin.client.storage.from(bucket).download(storagePath);
  if (downloaded.error || !downloaded.data) {
    return NextResponse.json({ ok: false, error: "Modele introuvable." }, { status: 404 });
  }

  return new NextResponse(await downloaded.data.arrayBuffer(), {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
    }
  });
}
