import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Upload USDZ direct desactive. Lancez le worker local.",
      usdzSourceStored: false,
      uploaded: false
    },
    { status: 410 }
  );
}
