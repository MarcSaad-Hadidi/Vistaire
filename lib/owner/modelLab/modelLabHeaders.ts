export const MODEL_LAB_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff"
} as const;

export function modelLabJsonHeaders(): HeadersInit {
  return {
    ...MODEL_LAB_NO_STORE_HEADERS,
    "Content-Type": "application/json; charset=utf-8"
  };
}

export function withModelLabNoStore(response: Response): Response {
  for (const [key, value] of Object.entries(MODEL_LAB_NO_STORE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function safeAttachmentFileName(value: string): string {
  const base = value
    .split(/[\\/]+/)
    .filter(Boolean)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 120);

  const name = base && base.toLowerCase().endsWith(".glb") ? base : `${base || "model"}.glb`;
  return name || "model.glb";
}

export function modelLabBinaryHeaders(fileName: string, byteLength: number): HeadersInit {
  const safeFileName = safeAttachmentFileName(fileName);

  return {
    ...MODEL_LAB_NO_STORE_HEADERS,
    "Content-Type": "model/gltf-binary",
    "Content-Disposition": `attachment; filename="${safeFileName}"`,
    "Content-Length": String(byteLength)
  };
}
