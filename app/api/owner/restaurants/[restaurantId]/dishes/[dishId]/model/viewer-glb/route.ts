import { NextResponse, type NextRequest } from "next/server";
import { prepareOwnerGlbUpload } from "@/lib/owner/ownerGlbUploadRequest";
import { runViewerGlbUpload } from "@/lib/owner/viewerGlbUpload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  const upload = await prepareOwnerGlbUpload(request, params);
  if (!upload.ok) return upload.response;

  try {
    const result = await runViewerGlbUpload(upload.input);

    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        modelStatus: result.modelStatus,
        version: result.version,
        webModel3dUrl: result.webModel3dUrl,
        viewerGlbBytes: result.viewerGlbBytes,
        job: { id: result.jobId },
        usdzTriggered: false,
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
          error: "GLB viewer publie, mais finalisation 3D incomplete.",
          committed: true,
          dishUpdated: true
        },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : "Upload GLB viewer impossible.";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
