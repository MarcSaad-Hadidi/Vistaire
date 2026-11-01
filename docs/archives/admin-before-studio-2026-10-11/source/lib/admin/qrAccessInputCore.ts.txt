const MAX_QR_ACCESS_INPUT_LENGTH = 2_048;
const MAX_QR_TOKEN_LENGTH = 800;
const QR_TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;
export const MAX_ADMIN_ACCESS_BODY_BYTES = 8_192;

function decodeCanonicalToken(value: string): string | null {
  let token: string;
  try {
    token = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (
    token.length === 0 ||
    token.length > MAX_QR_TOKEN_LENGTH ||
    !QR_TOKEN_PATTERN.test(token)
  ) {
    return null;
  }
  return token;
}

export function extractAdminQrToken(
  input: string,
  requestOrigin: string
): string | null {
  const value = input.trim();
  if (!value || value.length > MAX_QR_ACCESS_INPUT_LENGTH) return null;

  const looksLikePath = value.startsWith("/");
  const looksLikeUrl = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value);
  if (!looksLikePath && !looksLikeUrl) return decodeCanonicalToken(value);

  let url: URL;
  try {
    url = new URL(value, requestOrigin);
  } catch {
    return null;
  }
  if (url.origin !== requestOrigin || url.search || url.hash) return null;
  if (!url.pathname.startsWith("/q/")) return null;

  const encodedToken = url.pathname.slice(3);
  if (!encodedToken || encodedToken.includes("/")) return null;
  return decodeCanonicalToken(encodedToken);
}

export function isSameOriginAdminMutation(input: {
  origin: string | null;
  fetchSite: string | null;
  requestOrigin: string;
}): boolean {
  const origin = input.origin?.trim() ?? "";
  const fetchSite = input.fetchSite?.trim().toLowerCase();
  if (!origin) return false;
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  try {
    const expectedOrigin = new URL(input.requestOrigin).origin;
    const suppliedOrigin = new URL(origin);
    return suppliedOrigin.origin === origin && suppliedOrigin.origin === expectedOrigin;
  } catch {
    return false;
  }
}

function hasAllowedContentType(request: Request): boolean {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  return mediaType === "application/x-www-form-urlencoded";
}

function hasAllowedDeclaredLength(request: Request): boolean {
  const rawLength = request.headers.get("content-length");
  if (rawLength === null) return true;
  const normalized = rawLength.trim();
  if (!/^\d+$/.test(normalized)) return false;
  const contentLength = Number(normalized);
  return (
    Number.isSafeInteger(contentLength) &&
    contentLength <= MAX_ADMIN_ACCESS_BODY_BYTES
  );
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_ADMIN_ACCESS_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function parseAdminQrAccessRequest(
  request: Request,
  requestOrigin: string
): Promise<string | null> {
  if (
    !isSameOriginAdminMutation({
      origin: request.headers.get("origin"),
      fetchSite: request.headers.get("sec-fetch-site"),
      requestOrigin
    }) ||
    !hasAllowedContentType(request) ||
    !hasAllowedDeclaredLength(request)
  ) {
    return null;
  }

  const body = await readBoundedBody(request);
  if (body === null) return null;
  const form = new URLSearchParams(body);
  const fields = Array.from(form.keys());
  if (
    fields.length !== 1 ||
    fields[0] !== "qrAccess" ||
    form.getAll("qrAccess").length !== 1
  ) {
    return null;
  }
  return extractAdminQrToken(form.get("qrAccess") ?? "", requestOrigin);
}
