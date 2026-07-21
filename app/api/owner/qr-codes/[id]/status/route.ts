import type { NextRequest } from "next/server";
import { handleQrLifecycleMutation } from "../lifecycleRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleQrLifecycleMutation(request, context.params);
}
