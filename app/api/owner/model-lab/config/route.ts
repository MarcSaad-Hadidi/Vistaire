import { NextResponse } from "next/server";
import { requireVistaireOwnerApi } from "@/lib/auth/ownerApi";
import {
  modelLabJsonHeaders,
  withModelLabNoStore
} from "@/lib/owner/modelLab/modelLabHeaders";
import {
  modelLabConfigResponse,
  parseModelLabInspectionMaxBytes,
  parseModelLabOptimizationMaxBytes
} from "@/lib/owner/modelLab/modelLabLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: modelLabJsonHeaders() }
  );
}

export async function GET() {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return withModelLabNoStore(owner.response);

  const inspectionLimit = parseModelLabInspectionMaxBytes(process.env);
  if (!inspectionLimit.ok) return jsonError(inspectionLimit.error, 503);

  const optimizationLimit = parseModelLabOptimizationMaxBytes(process.env);
  if (!optimizationLimit.ok) return jsonError(optimizationLimit.error, 503);

  return NextResponse.json(
    {
      ok: true,
      config: modelLabConfigResponse({
        inspectionMaxBytes: inspectionLimit.maxBytes,
        optimizationMaxBytes: optimizationLimit.maxBytes
      })
    },
    { status: 200, headers: modelLabJsonHeaders() }
  );
}
