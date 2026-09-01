export function privateReportResponse(
  body: BodyInit | Uint8Array | null,
  options: Readonly<{
    status: number;
    contentType: string;
    headers?: Readonly<Record<string, string>>;
  }>
): Response {
  const headers = new Headers(options.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Cookie");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Type", options.contentType);
  const responseBody = body instanceof Uint8Array
    ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
    : body;
  return new Response(responseBody, { status: options.status, headers });
}

export function privateReportError(status: 400 | 401 | 503, code: "invalid-request" | "unauthorized" | "unavailable"): Response {
  return privateReportResponse(JSON.stringify({ error: code }), {
    status,
    contentType: "application/json; charset=utf-8"
  });
}
