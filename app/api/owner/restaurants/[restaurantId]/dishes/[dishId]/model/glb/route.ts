import { NextResponse, type NextRequest } from "next/server";
import { prepareOwnerGlbUpload } from "@/lib/owner/ownerGlbUploadRequest";
import { runRestaurantMeshyDishPipeline } from "@/lib/owner/restaurantMeshyPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  const upload = await prepareOwnerGlbUpload(request, params);
  if (!upload.ok) return upload.response;

  try {
    const result = await runRestaurantMeshyDishPipeline(upload.input);

    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        storagePath: result.manifestPath,
        manifestPath: result.manifestPath,
        manifestUrl: result.manifestUrl,
        model3dUrl: result.model3dUrl,
        webModel3dUrl: result.webModel3dUrl,
        arModel3dUrl: result.arModel3dUrl,
        arUsdzUrl: result.arUsdzUrl,
        webModel3dBytes: result.webModel3dBytes,
        arModel3dBytes: result.arModel3dBytes,
        arUsdzBytes: result.arUsdzBytes,
        job: { id: result.jobId },
        dishUpdated: true,
        cleanup: result.cleanup,
        warning: result.cleanup.errors[0]?.message
      },
      { status: 201 }
    );
  } catch (error) {
    if (await upload.settleAfterFailure()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Modele publie, mais finalisation 3D incomplete.",
          committed: true,
          dishUpdated: true
        },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : "Pipeline Meshy impossible.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Unknown") ? 422 : 503 }
    );
  }
}
