import { NextResponse, type NextRequest } from "next/server";
import {
  assertUsdzRuntimeJobClaimsMatchRoute,
  verifyUsdzRuntimeJobToken
} from "@/lib/owner/usdzRuntimeJsonFlow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON requis." }, { status: 400 });
  }
  const input = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const jobToken = typeof input.jobToken === "string" ? input.jobToken : "";
  const verified = verifyUsdzRuntimeJobToken(jobToken);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error, usdzSourceStored: false }, { status: 403 });
  }
  try {
    assertUsdzRuntimeJobClaimsMatchRoute(verified.claims, await params);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "jobToken USDZ invalide.",
        usdzSourceStored: false
      },
      { status: 403 }
    );
  }
  return NextResponse.json({
    ok: true,
    jobId: verified.claims.jobId,
    status: "failed",
    usdzSourceStored: false
  });
}
