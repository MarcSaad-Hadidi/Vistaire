import assert from "node:assert/strict";
import test from "node:test";
import {
  ERR_ABORTED,
  REQUEST_CLASSIFICATIONS,
  classifyFailedRequest,
  classifyFailedResponse,
  classifyRuntimeSignal,
  hasExplicitPrefetchMarker,
  isMediaCurrentSrcCoherent,
  sanitizeDiagnosticText,
  sanitizeDiagnosticUrl
} from "../e2e/support/preview-request-policy.mjs";

const expectedOrigin = "https://vistaire-preview.capoships-projects.vercel.app";

function failedRequest(overrides = {}) {
  return {
    url: `${expectedOrigin}/api/example`,
    expectedOrigin,
    method: "GET",
    resourceType: "fetch",
    isNavigationRequest: false,
    isMainFrame: false,
    frame: "main",
    failureCode: ERR_ABORTED,
    prefetchHeaders: {},
    ...overrides
  };
}

test("exact Vercel JWE cancellation is a benign platform cancellation", () => {
  const result = classifyFailedRequest(
    failedRequest({
      url: `${expectedOrigin}/.well-known/vercel/jwe`,
      frame: "main",
      isMainFrame: true
    })
  );
  assert.equal(result.classification, REQUEST_CLASSIFICATIONS.PLATFORM_CANCELLATION);
  assert.equal(result.ignored, true);
  assert.match(result.reason, /exact Vercel JWE/);
});

test("a different .well-known pathname remains blocking", () => {
  const result = classifyFailedRequest(
    failedRequest({ url: `${expectedOrigin}/.well-known/other` })
  );
  assert.equal(result.classification, REQUEST_CLASSIFICATIONS.BLOCKING);
  assert.equal(result.ignored, false);
});

test("a non-aborted failure on the JWE remains visible", () => {
  const result = classifyFailedRequest(
    failedRequest({
      url: `${expectedOrigin}/.well-known/vercel/jwe`,
      failureCode: "net::ERR_FAILED"
    })
  );
  assert.equal(result.ignored, false);
  assert.match(result.reason, /exact benign cancellation code/);
});

test("an aborted media request is accepted only with healthy critical-media DOM state", () => {
  const result = classifyFailedRequest(
    failedRequest({
      url: `${expectedOrigin}/videos/Vistaire2.mp4`,
      resourceType: "media",
      mediaState: { healthy: true, allowCancellation: true }
    })
  );
  assert.equal(result.classification, REQUEST_CLASSIFICATIONS.HEALTHY_MEDIA_CANCELLATION);
  assert.equal(result.ignored, true);
});

test("media cancellation requires explicit DOM-backed cancellation permission", () => {
  const result = classifyFailedRequest(
    failedRequest({
      url: `${expectedOrigin}/videos/Vistaire2.mp4`,
      resourceType: "media",
      mediaState: { healthy: true }
    })
  );
  assert.equal(result.ignored, false);
  assert.match(result.reason, /healthy critical-media DOM state/);
});

test("a media error keeps an aborted media request blocking", () => {
  const result = classifyFailedRequest(
    failedRequest({
      url: `${expectedOrigin}/videos/Vistaire2.mp4`,
      resourceType: "media",
      mediaState: { healthy: false, reason: "critical media exposes a MediaError" }
    })
  );
  assert.equal(result.ignored, false);
  assert.match(result.reason, /MediaError/);
});

test("critical media that never reaches current data keeps an aborted request blocking", () => {
  const result = classifyFailedRequest(
    failedRequest({
      url: `${expectedOrigin}/videos/Vistaire2.mp4`,
      resourceType: "media",
      mediaState: { healthy: false, reason: "critical media did not reach HAVE_CURRENT_DATA" }
    })
  );
  assert.equal(result.ignored, false);
  assert.match(result.reason, /HAVE_CURRENT_DATA/);
});

test("the primary navigation cannot be ignored when it is cancelled", () => {
  const result = classifyFailedRequest(
    failedRequest({
      url: `${expectedOrigin}/`,
      resourceType: "document",
      isNavigationRequest: true,
      isMainFrame: true
    })
  );
  assert.equal(result.ignored, false);
  assert.match(result.reason, /navigation/);
});

test("an aborted XHR/fetch without prefetch evidence remains blocking", () => {
  const result = classifyFailedRequest(failedRequest());
  assert.equal(result.ignored, false);
  assert.equal(result.classification, REQUEST_CLASSIFICATIONS.BLOCKING);
});

test("explicit prefetch evidence permits an aborted speculative request", () => {
  assert.equal(hasExplicitPrefetchMarker({ purpose: "prefetch" }), true);
  const result = classifyFailedRequest(
    failedRequest({
      url: `${expectedOrigin}/en`,
      prefetchHeaders: { "next-router-prefetch": "1" }
    })
  );
  assert.equal(result.classification, REQUEST_CLASSIFICATIONS.EXPLICIT_PREFETCH_CANCELLATION);
  assert.equal(result.ignored, true);
  assert.deepEqual(result.prefetchHeaders, { "next-router-prefetch": "1" });
});

test("explicit prefetch evidence cannot suppress critical script or stylesheet failures", () => {
  for (const resourceType of ["script", "stylesheet"]) {
    const result = classifyFailedRequest(
      failedRequest({ resourceType, prefetchHeaders: { purpose: "prefetch" } })
    );
    assert.equal(result.ignored, false);
    assert.match(result.reason, /critical script or stylesheet/);
  }
});

test("an aborted root request without prefetch proof remains blocking", () => {
  const result = classifyFailedRequest(failedRequest({ url: `${expectedOrigin}/` }));
  assert.equal(result.ignored, false);
  assert.match(result.reason, /no explicit benign classification/);
});

test("HTTP 404 and 500 responses remain blocking", () => {
  for (const status of [404, 500]) {
    const result = classifyFailedResponse(
      failedRequest({ url: `${expectedOrigin}/api/required`, status })
    );
    assert.equal(result.classification, REQUEST_CLASSIFICATIONS.HTTP_ERROR);
    assert.equal(result.ignored, false);
    assert.match(result.reason, new RegExp(`HTTP ${status}`));
  }
});

test("console errors and page errors are always blocking signals", () => {
  for (const kind of ["console", "pageerror"]) {
    const result = classifyRuntimeSignal({ kind, message: "boom" });
    assert.equal(result.classification, REQUEST_CLASSIFICATIONS.BLOCKING);
    assert.equal(result.ignored, false);
    assert.match(result.reason, new RegExp(kind === "console" ? "console error" : "pageerror"));
  }
});

test("out-of-origin failures are blocking even when the browser reports ERR_ABORTED", () => {
  const result = classifyFailedRequest(
    failedRequest({ url: "https://other.example/", prefetchHeaders: { purpose: "prefetch" } })
  );
  assert.equal(result.ignored, false);
  assert.match(result.reason, /validated Preview origin/);
});

test("media source validation accepts the responsive source selected at 390px", () => {
  const sources = [
    "/videos/Vistaire2.mp4",
    "/videos/Vistaire2-mobile.mp4",
    "/videos/Vistaire2.mp4"
  ];
  assert.equal(
    isMediaCurrentSrcCoherent(
      "https://vistaire-preview.capoships-projects.vercel.app/videos/Vistaire2-mobile.mp4",
      sources,
      expectedOrigin
    ),
    true
  );
  assert.equal(
    isMediaCurrentSrcCoherent(
      "https://vistaire-preview.capoships-projects.vercel.app/videos/other.mp4",
      sources,
      expectedOrigin
    ),
    false
  );
});

test("media source validation keeps distinct signed URLs distinct", () => {
  assert.equal(
    isMediaCurrentSrcCoherent(
      "https://vistaire-preview.capoships-projects.vercel.app/videos/Vistaire2.mp4?sig=bad",
      ["https://vistaire-preview.capoships-projects.vercel.app/videos/Vistaire2.mp4?sig=good"],
      expectedOrigin
    ),
    false
  );
});

test("diagnostic URL and text sanitizers redact unknown signed values", () => {
  const unsafeUrl = `${expectedOrigin}/q/opaqueTokenThatIsLongEnoughToHide?sig=abc123&foo=bar&jwt=secret`;
  const safeUrl = sanitizeDiagnosticUrl(unsafeUrl);
  assert.doesNotMatch(safeUrl, /abc123|secret|opaqueTokenThatIsLongEnoughToHide|bar/);
  assert.match(safeUrl, /\/q\/\[redacted\]/);
  const safeText = sanitizeDiagnosticText(
    `failed {"token":"secret-value","authorization":"Bearer abc"} ${unsafeUrl}`
  );
  assert.doesNotMatch(safeText, /secret-value|Bearer abc|abc123|opaqueTokenThatIsLongEnoughToHide/);
  const diagnostic = classifyFailedRequest(
    failedRequest({ url: unsafeUrl, failureCode: "net::ERR_FAILED" })
  );
  assert.equal(diagnostic.pathname, "/q/[redacted]");
});
