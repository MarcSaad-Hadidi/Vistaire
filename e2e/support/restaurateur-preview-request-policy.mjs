const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FRAMEWORK_HEADER_NAMES = new Set([
  "next-action",
  "next-router-state-tree",
  "rsc"
]);
const PRIVATE_PATH = /^\/(?:admin|owner|api\/(?:admin|owner))(?:\/|$)/i;
const ANALYTICS_PATH = /^\/api\/analytics\/events(?:\/|$)/i;
const SUPABASE_PATH = /^\/(?:auth|realtime|rest)\/v1(?:\/|$)|^\/rpc(?:\/|$)/i;
const MODEL_ASSET = /(?:^|\/)(?:model\/)?(?:glb|usdz)(?:\/|$)|\.(?:glb|usdz)$/i;
const VIDEO_ASSET = /\.(?:m4v|mov|mp4|webm)$/i;
const ABORTABLE_NEXT_RESOURCE = /^\/_next\/(?:image(?:\/|$)|static\/)/i;

export function shouldIgnoreRestaurateurPreviewRequestFailure(input) {
  if (input.errorText !== "net::ERR_ABORTED") return false;
  const baseOrigin = new URL(input.baseOrigin).origin;
  const url = new URL(input.url, baseOrigin);
  return url.origin === baseOrigin && ABORTABLE_NEXT_RESOURCE.test(url.pathname);
}

function safePathname(url, privateEndpoint, supabaseRequest) {
  const pathname = url.pathname;
  if (supabaseRequest) {
    const prefix = pathname.match(/^\/(?:auth|realtime|rest)\/v1|^\/rpc/i)?.[0];
    return `${prefix ?? "/supabase"}/[redacted]`;
  }
  if (privateEndpoint) {
    if (/^\/api\/admin(?:\/|$)/i.test(pathname)) return "/api/admin/[redacted]";
    if (/^\/api\/owner(?:\/|$)/i.test(pathname)) return "/api/owner/[redacted]";
    if (/^\/admin(?:\/|$)/i.test(pathname)) return "/admin/[redacted]";
    if (/^\/owner(?:\/|$)/i.test(pathname)) return "/owner/[redacted]";
  }
  return pathname;
}

export function classifyRestaurateurPreviewRequest(input) {
  const baseOrigin = new URL(input.baseOrigin).origin;
  const url = new URL(input.url, baseOrigin);
  const method = String(input.method ?? "GET").toUpperCase();
  const headerNames = new Set(
    Object.keys(input.headers ?? {}).map((name) => name.toLowerCase())
  );
  const frameworkInternal =
    WRITE_METHODS.has(method) &&
    [...FRAMEWORK_HEADER_NAMES].some((name) => headerNames.has(name));
  const supabaseRequest =
    /(?:^|\.)supabase\.(?:co|com)$/i.test(url.hostname) ||
    SUPABASE_PATH.test(url.pathname) ||
    headerNames.has("x-supabase-api-version");
  const privateEndpoint = PRIVATE_PATH.test(url.pathname) || supabaseRequest;
  const write = WRITE_METHODS.has(method);
  const productMutation =
    write && (privateEndpoint || ANALYTICS_PATH.test(url.pathname));

  return {
    pathname: safePathname(url, privateEndpoint, supabaseRequest),
    frameworkInternal,
    privateEndpoint,
    productMutation,
    unexpectedWrite: write,
    modelAsset: MODEL_ASSET.test(url.pathname),
    videoAsset: VIDEO_ASSET.test(url.pathname)
  };
}
