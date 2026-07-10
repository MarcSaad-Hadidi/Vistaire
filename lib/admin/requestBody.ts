export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too-large" | "invalid" };

function declaredBodyLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number
): Promise<BoundedJsonResult> {
  const contentLength = declaredBodyLength(request);
  if (contentLength !== null && contentLength > maxBytes) {
    return { ok: false, reason: "too-large" };
  }
  if (!request.body) return { ok: false, reason: "invalid" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (totalBytes + value.byteLength > maxBytes) {
        await reader.cancel("body exceeds byte limit");
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } catch {
    return { ok: false, reason: "invalid" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
