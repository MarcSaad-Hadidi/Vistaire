export const ERR_ABORTED = "net::ERR_ABORTED";
export const VERCEL_JWE_PATH = "/.well-known/vercel/jwe";

const PREFETCH_HEADER_NAMES = [
  "purpose",
  "sec-purpose",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "x-middleware-prefetch"
];

const PREFETCH_HEADER_SET = new Set(PREFETCH_HEADER_NAMES);

export const REQUEST_CLASSIFICATIONS = Object.freeze({
  BLOCKING: "blocking",
  PLATFORM_CANCELLATION: "platform-cancellation",
  HEALTHY_MEDIA_CANCELLATION: "healthy-media-cancellation",
  EXPLICIT_PREFETCH_CANCELLATION: "explicit-prefetch-cancellation",
  HTTP_ERROR: "http-error"
});

function normalizeHeaderValue(value) {
  return String(value ?? "").trim();
}

function isPrefetchToken(value) {
  return normalizeHeaderValue(value)
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .includes("prefetch");
}

function isTruthyPrefetchMarker(value) {
  return /^(?:1|true|prefetch)$/i.test(normalizeHeaderValue(value));
}

export function pickPrefetchHeaders(headers = {}) {
  const selected = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    const normalizedName = name.toLowerCase();
    if (PREFETCH_HEADER_SET.has(normalizedName)) {
      selected[normalizedName] = normalizeHeaderValue(value);
    }
  }
  return selected;
}

export function hasExplicitPrefetchMarker(headers = {}) {
  const selected = pickPrefetchHeaders(headers);
  return (
    isPrefetchToken(selected.purpose) ||
    isPrefetchToken(selected["sec-purpose"]) ||
    isTruthyPrefetchMarker(selected["next-router-prefetch"]) ||
    isTruthyPrefetchMarker(selected["next-router-segment-prefetch"]) ||
    isTruthyPrefetchMarker(selected["x-middleware-prefetch"])
  );
}

export function isMediaCurrentSrcCoherent(currentSrc, sources = [], baseUrl) {
  if (!sources.length) return true;
  if (!currentSrc) return false;
  try {
    const resolvedCurrentSrc = new URL(currentSrc, baseUrl).href;
    return sources.some((source) => new URL(source, baseUrl).href === resolvedCurrentSrc);
  } catch {
    return false;
  }
}

function sanitizePathname(pathname) {
  return pathname
    .split("/")
    .map((segment) =>
      segment.length >= 24 && /^[A-Za-z0-9._~-]+$/.test(segment) ? "[redacted]" : segment
    )
    .join("/");
}

function safeUrl(url) {
  try {
    const parsed = new URL(url);
    const safe = new URL(parsed.origin);
    safe.pathname = sanitizePathname(parsed.pathname);
    for (const name of parsed.searchParams.keys()) {
      safe.searchParams.set(name, "[redacted]");
    }
    return safe.toString();
  } catch {
    return String(url).replace(/([?&](?:secret|token|auth|cookie|password|passwd|key|nonce|bypass|code)=)[^&]*/gi, "$1[redacted]");
  }
}

function normalizeFrame(frame, isMainFrame, isNavigationRequest) {
  if (frame === "main" || frame === "secondary" || frame === "unknown") return frame;
  if (isMainFrame === true || isNavigationRequest === true) return "main";
  if (isMainFrame === false) return "secondary";
  return "unknown";
}

function baseDiagnostic(input, classification, ignored, reason) {
  let parsed;
  try {
    parsed = new URL(input.url);
  } catch {
    parsed = null;
  }
  const isNavigationRequest = input.isNavigationRequest === true;
  const frame = normalizeFrame(input.frame, input.isMainFrame, isNavigationRequest);
  const prefetchHeaders = pickPrefetchHeaders(input.prefetchHeaders);
  const pathname = parsed?.pathname ?? input.pathname ?? "<invalid-url>";
  return {
    url: safeUrl(input.url),
    pathname: sanitizePathname(pathname),
    method: String(input.method ?? "GET").toUpperCase(),
    resourceType: String(input.resourceType ?? "other"),
    isNavigationRequest,
    frame,
    isMainFrame: frame === "main",
    failureCode: input.failureCode ?? null,
    prefetchHeaders,
    classification,
    ignored,
    reason
  };
}

function blocking(input, reason, classification = REQUEST_CLASSIFICATIONS.BLOCKING) {
  return baseDiagnostic(input, classification, false, reason);
}

export function classifyFailedRequest(input) {
  let parsed;
  try {
    parsed = new URL(input.url);
  } catch {
    return blocking(input, "request URL is invalid");
  }

  const expectedOrigin = input.expectedOrigin;
  if (parsed.origin !== expectedOrigin) {
    return blocking(input, "request left the validated Preview origin");
  }

  if (input.responseStatus != null && Number(input.responseStatus) >= 400) {
    return blocking(input, `HTTP ${input.responseStatus} response is blocking`);
  }

  if (input.failureCode !== ERR_ABORTED) {
    return blocking(input, "failure code is not the exact benign cancellation code");
  }

  if (input.isNavigationRequest === true) {
    return blocking(input, "main/document navigation cancellation is always blocking");
  }

  if (input.resourceType === "media") {
    if (input.mediaState?.healthy === true && input.mediaState.allowCancellation === true) {
      return baseDiagnostic(
        input,
        REQUEST_CLASSIFICATIONS.HEALTHY_MEDIA_CANCELLATION,
        true,
        "same-origin media cancellation is benign because critical media is DOM-healthy"
      );
    }
    return blocking(
      input,
      input.mediaState?.reason ?? "media cancellation requires healthy critical-media DOM state"
    );
  }

  if (input.resourceType === "script" || input.resourceType === "stylesheet") {
    return blocking(input, "critical script or stylesheet cancellation is always blocking");
  }

  if (parsed.pathname.startsWith("/.well-known/")) {
    if (parsed.pathname === VERCEL_JWE_PATH) {
      return baseDiagnostic(
        input,
        REQUEST_CLASSIFICATIONS.PLATFORM_CANCELLATION,
        true,
        "exact Vercel JWE endpoint cancellation on the validated origin"
      );
    }
    return blocking(input, "only the exact Vercel JWE pathname has a platform cancellation exemption");
  }

  if (hasExplicitPrefetchMarker(input.prefetchHeaders)) {
    return baseDiagnostic(
      input,
      REQUEST_CLASSIFICATIONS.EXPLICIT_PREFETCH_CANCELLATION,
      true,
      "explicit prefetch header evidence identifies a speculative cancellation"
    );
  }

  return blocking(input, "same-origin request cancellation has no explicit benign classification");
}

export function classifyFailedResponse(input) {
  let parsed;
  try {
    parsed = new URL(input.url);
  } catch {
    return blocking(input, "response URL is invalid");
  }
  if (input.expectedOrigin && parsed.origin !== input.expectedOrigin) {
    return blocking(input, "response left the validated Preview origin");
  }
  const status = Number(input.status);
  if (!Number.isFinite(status) || status < 400) {
    return blocking(input, "response is not an HTTP 4xx/5xx failure");
  }
  return baseDiagnostic(
    input,
    REQUEST_CLASSIFICATIONS.HTTP_ERROR,
    false,
    `HTTP ${status} response is blocking`
  );
}

export function classifyRuntimeSignal({ kind, message }) {
  const signal = kind === "pageerror" ? "pageerror" : "console error";
  return {
    kind: signal,
    message: String(message ?? ""),
    classification: REQUEST_CLASSIFICATIONS.BLOCKING,
    ignored: false,
    reason: `${signal} is always blocking`
  };
}

export function sanitizeDiagnosticText(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s)"']+/gi, (url) => safeUrl(url))
    .replace(
      /(["']?(?:authorization|cookie|set-cookie|secret|token|password|passwd|bypass|nonce|signature|sig|jwt|access[_-]?token)["']?\s*[:=]\s*["']?)([^"'\s,;}]+)(["']?)/gi,
      "$1[redacted]$3"
    )
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]");
}

export function sanitizeDiagnosticUrl(value) {
  return safeUrl(value);
}
