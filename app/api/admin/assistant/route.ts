import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gone() {
  return NextResponse.json(
    { ok: false, error: "This endpoint has been removed." },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}

export const POST = gone;
export const GET = gone;
