import { expect, test, type BrowserContext, type Page, type Request } from "@playwright/test";
import {
  classifyFailedRequest,
  classifyFailedResponse,
  classifyRuntimeSignal,
  isMediaCurrentSrcCoherent,
  pickPrefetchHeaders,
  sanitizeDiagnosticText,
  sanitizeDiagnosticUrl,
  type RequestDiagnostic
} from "./support/preview-request-policy.mjs";

const previewBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
if (!previewBaseUrl) throw new Error("Preview Gate requires PLAYWRIGHT_BASE_URL.");

const previewUrl = new URL(previewBaseUrl);
if (previewUrl.username || previewUrl.password || previewUrl.port) {
  throw new Error("Preview Gate requires an origin URL without credentials or an explicit port.");
}
const expectedOrigin = previewUrl.origin;
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
if (!protectionBypass) {
  throw new Error("Preview Gate requires VERCEL_AUTOMATION_BYPASS_SECRET.");
}
const validatedProtectionBypass: string = protectionBypass;

async function establishPreviewAccess(context: BrowserContext) {
  // Keep the secret on one direct API request. maxRedirects: 0 ensures a
  // Preview-controlled redirect cannot forward it to another origin.
  const response = await context.request.get(`${expectedOrigin}/`, {
    headers: {
      "x-vercel-protection-bypass": validatedProtectionBypass,
      "x-vercel-set-bypass-cookie": "true"
    },
    maxRedirects: 0
  });
  const location = response.headers().location;
  if (location && new URL(location, expectedOrigin).origin !== expectedOrigin) {
    throw new Error("Preview access bootstrap redirect left the validated origin.");
  }
  if (response.status() >= 400) {
    throw new Error(`Preview access bootstrap returned HTTP ${response.status()}.`);
  }
}

test.beforeEach(async ({ context }) => {
  await establishPreviewAccess(context);
});

type FrameScope = "main" | "secondary" | "unknown";

type FailedResponseDiagnostic = RequestDiagnostic & {
  status: number;
};

type MediaElementDiagnostic = {
  tagName: string;
  visible: boolean;
  explicitlyCritical: boolean;
  sources: string[];
  source: string;
  currentSrc: string;
  hasActiveSource: boolean;
  currentSrcCoherent: boolean;
  error: string | null;
  readyState: number;
  pendingRequests: number;
};

type MediaReadiness = {
  healthy: boolean;
  settled: boolean;
  observed: boolean;
  allowCancellation: boolean;
  reason: string;
  criticalMedia: MediaElementDiagnostic[];
  pendingCriticalRequests: number;
};

type RuntimeSignal = ReturnType<typeof classifyRuntimeSignal>;

type RuntimeIssues = {
  failedResponses: FailedResponseDiagnostic[];
  failedRequests: RequestDiagnostic[];
  ignoredRequests: RequestDiagnostic[];
  consoleErrors: string[];
  pageErrors: string[];
  blockingSignals: RuntimeSignal[];
  pendingMediaRequests: number;
  mediaState?: MediaReadiness;
  primaryNavigation?: {
    url: string;
    method: string;
    resourceType: string;
    isNavigationRequest: boolean;
    frame: FrameScope;
  };
  navigationError?: string;
  finalize: (mediaState?: MediaReadiness) => void;
  settle: () => Promise<void>;
};

function safeFrameScope(request: Request, page: Page): FrameScope {
  let frame;
  try {
    frame = request.frame();
  } catch {
    frame = null;
  }
  if (frame === page.mainFrame()) return "main";
  if (frame) return "secondary";
  return request.isNavigationRequest() ? "main" : "unknown";
}

function isSameOriginMediaRequest(request: Request) {
  if (request.resourceType() !== "media") return false;
  try {
    return new URL(request.url()).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function emptyMediaReadiness(): MediaReadiness {
  return {
    healthy: false,
    settled: true,
    observed: false,
    allowCancellation: false,
    reason: "no critical media DOM evidence was observed",
    criticalMedia: [],
    pendingCriticalRequests: 0
  };
}

function formatDiagnostics(issues: RuntimeIssues) {
  const sections: Array<[string, unknown[]]> = [
    ...(issues.primaryNavigation ? [["primary navigation", [issues.primaryNavigation]] as [string, unknown[]]] : []),
    ["failed responses", issues.failedResponses],
    ["blocking requests", issues.failedRequests],
    ["benign cancellations", issues.ignoredRequests],
    ["console/page errors", issues.blockingSignals],
    ["critical media", issues.mediaState?.criticalMedia ?? []]
  ];
  return sections
    .filter(([, entries]) => entries.length > 0)
    .map(([label, entries]) => `${label}:\n${entries.map((entry) => JSON.stringify(entry)).join("\n")}`)
    .join("\n");
}

function readRequestDetails(request: Request, page: Page) {
  const frame = safeFrameScope(request, page);
  return {
    url: request.url(),
    expectedOrigin,
    method: request.method(),
    resourceType: request.resourceType(),
    isNavigationRequest: request.isNavigationRequest(),
    isMainFrame: request.isNavigationRequest() && frame === "main",
    frame,
    failureCode: request.failure()?.errorText ?? null,
    prefetchHeaders: pickPrefetchHeaders(request.headers())
  };
}

function observeRuntimeIssues(page: Page): RuntimeIssues {
  const issues: RuntimeIssues = {
    failedResponses: [],
    failedRequests: [],
    ignoredRequests: [],
    consoleErrors: [],
    pageErrors: [],
    blockingSignals: [],
    pendingMediaRequests: 0,
    finalize: () => undefined,
    settle: async () => undefined
  };
  const failedRequests: ReturnType<typeof readRequestDetails>[] = [];
  const failedResponses: Array<ReturnType<typeof readRequestDetails> & { status: number }> = [];
  const pendingMediaByUrl = new Map<string, number>();
  let currentMediaState = emptyMediaReadiness();
  let hasFinalized = false;
  let eventVersion = 0;

  const refreshClassifications = () => {
    issues.failedResponses = failedResponses.map((input) => ({
      ...classifyFailedResponse(input),
      status: input.status
    }));
    const classified = failedRequests.map((input) =>
      classifyFailedRequest({
        ...input,
        mediaState: input.resourceType === "media" ? currentMediaState : undefined
      })
    );
    issues.failedRequests = classified.filter((entry) => !entry.ignored);
    issues.ignoredRequests = classified.filter((entry) => entry.ignored);
  };

  const refreshIfFinalized = () => {
    if (hasFinalized) refreshClassifications();
  };

  const markEvent = () => {
    eventVersion += 1;
    refreshIfFinalized();
  };

  const settleMediaRequest = (request: Request) => {
    if (!isSameOriginMediaRequest(request)) return;
    const current = pendingMediaByUrl.get(request.url()) ?? 0;
    if (current <= 1) pendingMediaByUrl.delete(request.url());
    else pendingMediaByUrl.set(request.url(), current - 1);
    issues.pendingMediaRequests = Math.max(0, issues.pendingMediaRequests - 1);
  };

  page.on("request", (request) => {
    if (!isSameOriginMediaRequest(request)) return;
    pendingMediaByUrl.set(request.url(), (pendingMediaByUrl.get(request.url()) ?? 0) + 1);
    issues.pendingMediaRequests += 1;
    markEvent();
  });
  page.on("requestfinished", (request) => {
    settleMediaRequest(request);
    markEvent();
  });

  page.on("response", (response) => {
    try {
      if (new URL(response.url()).origin !== expectedOrigin || response.status() < 400) return;
      failedResponses.push({
        ...readRequestDetails(response.request(), page),
        status: response.status()
      });
      markEvent();
    } catch {
      // Ignore browser-internal URLs.
    }
  });
  page.on("requestfailed", (request) => {
    settleMediaRequest(request);
    failedRequests.push(readRequestDetails(request, page));
    markEvent();
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const signal = classifyRuntimeSignal({
      kind: "console",
      message: sanitizeDiagnosticText(message.text())
    });
    issues.consoleErrors.push(signal.message);
    issues.blockingSignals.push(signal);
    markEvent();
  });
  page.on("pageerror", (error) => {
    const signal = classifyRuntimeSignal({
      kind: "pageerror",
      message: sanitizeDiagnosticText(error.message)
    });
    issues.pageErrors.push(signal.message);
    issues.blockingSignals.push(signal);
    markEvent();
  });

  issues.finalize = (mediaState = emptyMediaReadiness()) => {
    currentMediaState = mediaState;
    hasFinalized = true;
    issues.mediaState = mediaState;
    refreshClassifications();
  };

  issues.settle = async () => {
    // Give Playwright two quiet event-loop turns so late request/response and
    // runtime signals are observed before the final green/red assertions.
    let lastVersion = eventVersion;
    let quietTurns = 0;
    for (let attempt = 0; attempt < 5 && quietTurns < 2; attempt += 1) {
      await page.waitForTimeout(0);
      refreshClassifications();
      if (eventVersion === lastVersion) quietTurns += 1;
      else {
        lastVersion = eventVersion;
        quietTurns = 0;
      }
    }
  };

  issues.pendingMediaRequests = 0;
  Object.defineProperty(issues, "pendingMediaByUrl", { value: pendingMediaByUrl });
  return issues;
}

async function readMediaReadiness(page: Page, issues: RuntimeIssues): Promise<MediaReadiness> {
  const rawElements = await page.locator("video, audio").evaluateAll((nodes) =>
    nodes.map((node) => {
      const media = node as HTMLMediaElement;
      const rect = media.getBoundingClientRect();
      const styles = getComputedStyle(media);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        styles.display !== "none" &&
        styles.visibility !== "hidden";
      const explicitlyCritical =
        media.hasAttribute("data-preview-critical-media") ||
        media.getAttribute("data-critical-media") === "true";
      const sources = [
        media.getAttribute("src") || "",
        ...Array.from(media.querySelectorAll("source"), (sourceNode) =>
          sourceNode.src || sourceNode.getAttribute("src") || ""
        )
      ].filter(Boolean);
      const source = sources[0] ?? "";
      const currentSrc = media.currentSrc || "";
      let currentSrcCoherent = true;
      if (sources.length) {
        try {
          currentSrcCoherent =
            Boolean(currentSrc) &&
            sources.some(
              (candidate) =>
                new URL(currentSrc, window.location.href).href ===
                new URL(candidate, window.location.href).href
            );
        } catch {
          currentSrcCoherent = Boolean(currentSrc);
        }
      }
      const hasActiveSource = Boolean(source || currentSrc);
      return {
        tagName: media.tagName.toLowerCase(),
        visible,
        explicitlyCritical,
        sources,
        source,
        currentSrc,
        hasActiveSource,
        currentSrcCoherent,
        error: media.error ? `MediaError code ${media.error.code}` : null,
        readyState: media.readyState,
        pendingRequests: 0
      };
    })
  );
  const criticalRawMedia = rawElements.filter((entry) => entry.visible || entry.explicitlyCritical);
  const criticalUrls = new Set(
    criticalRawMedia.flatMap((entry) => [...entry.sources, entry.currentSrc].filter(Boolean))
  );
  let pendingCriticalRequests = 0;
  const pendingMediaByUrl = (issues as RuntimeIssues & { pendingMediaByUrl?: Map<string, number> }).pendingMediaByUrl;
  if (pendingMediaByUrl) {
    for (const [url, count] of pendingMediaByUrl) {
      if (criticalUrls.has(url)) pendingCriticalRequests += count;
    }
  }
  const annotatedMedia = criticalRawMedia.map((entry) => {
    // Keep raw URLs for every readiness decision. Sanitization is diagnostic-only;
    // signed query values must not collapse two distinct media sources.
    const currentSrcCoherent = isMediaCurrentSrcCoherent(entry.currentSrc, entry.sources, page.url());
    const pendingRequests = [...entry.sources, entry.currentSrc]
      .filter(Boolean)
      .reduce((total, url) => total + (pendingMediaByUrl?.get(url) ?? 0), 0);
    return {
      ...entry,
      sources: entry.sources.map(sanitizeDiagnosticUrl),
      source: sanitizeDiagnosticUrl(entry.source),
      currentSrc: sanitizeDiagnosticUrl(entry.currentSrc),
      currentSrcCoherent,
      pendingRequests
    };
  });
  const settled = annotatedMedia.every(
    (entry) => entry.hasActiveSource && (entry.readyState >= 2 || entry.error !== null)
  ) && pendingCriticalRequests === 0;
  const unhealthy = annotatedMedia.filter(
    (entry) =>
      !entry.hasActiveSource ||
      entry.error !== null ||
      !entry.currentSrcCoherent ||
      entry.readyState < 2
  );
  const healthy = criticalRawMedia.length === 0 || (settled && unhealthy.length === 0);
  const reason = healthy
    ? "critical media has a coherent source, no DOM error, current data, and no pending request"
    : unhealthy[0]?.error
      ? "critical media exposes a MediaError"
      : unhealthy[0]?.currentSrcCoherent === false
        ? "critical media currentSrc does not match its active source"
        : unhealthy[0]
          ? "critical media did not reach HAVE_CURRENT_DATA"
          : "critical media still has pending requests";
  return {
    healthy,
    settled,
    observed: rawElements.length > 0,
    allowCancellation: criticalRawMedia.length > 0 && healthy,
    reason,
    criticalMedia: annotatedMedia,
    pendingCriticalRequests
  };
}

async function expectReadyMedia(page: Page, issues: RuntimeIssues): Promise<MediaReadiness> {
  if (!(await page.locator("video, audio").count())) return emptyMediaReadiness();
  let latest = emptyMediaReadiness();
  try {
    await expect
      .poll(
        async () => {
          latest = await readMediaReadiness(page, issues);
          issues.mediaState = latest;
          return latest.settled;
        },
        {
          message: "Expected critical media to settle before runtime checks.",
          timeout: 15_000
        }
      )
      .toBe(true);
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nCritical media state: ${JSON.stringify(latest)}`
    );
  }
  expect(latest.healthy, `Critical media state: ${JSON.stringify(latest)}`).toBe(true);
  expect(latest.pendingCriticalRequests, `Critical media state: ${JSON.stringify(latest)}`).toBe(0);
  return latest;
}

async function expectLoadedImages(page: Page) {
  const images = page.locator("img:visible");
  const inViewportCount = () =>
    images.evaluateAll((elements) => {
      const viewportHeight = window.innerHeight;
      return elements.filter((element) => {
        const image = element as HTMLImageElement;
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < viewportHeight && image.currentSrc;
      }).length;
    });
  const loadedInViewportCount = () =>
    images.evaluateAll((elements) => {
      const viewportHeight = window.innerHeight;
      return elements.filter((element) => {
        const image = element as HTMLImageElement;
        const rect = image.getBoundingClientRect();
        return (
          rect.bottom > 0 &&
          rect.top < viewportHeight &&
          image.currentSrc &&
          image.complete &&
          image.naturalWidth > 0 &&
          image.naturalHeight > 0
        );
      }).length;
    });
  const count = await inViewportCount();
  if (!count) return;
  await expect.poll(loadedInViewportCount).toBe(count);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(2);
}

function expectExpectedLocation(actualUrl: string, expectedPath: string, label: string) {
  const actual = new URL(actualUrl);
  const expected = new URL(expectedPath, expectedOrigin);
  expect(actual.origin, `${label} origin`).toBe(expected.origin);
  expect(actual.pathname, `${label} pathname`).toBe(expected.pathname);
  expect(actual.search, `${label} query`).toBe(expected.search);
}

async function expectHealthyRoute(page: Page, path: string, html = true) {
  const issues = observeRuntimeIssues(page);
  let mediaState = emptyMediaReadiness();
  try {
    const primaryResponse = await page.goto(path, { waitUntil: "domcontentloaded" });
    if (!primaryResponse) throw new Error(`Primary navigation to ${path} returned no response.`);
    const primaryRequest = primaryResponse.request();
    issues.primaryNavigation = {
      url: sanitizeDiagnosticUrl(primaryResponse.url()),
      method: primaryRequest.method(),
      resourceType: primaryRequest.resourceType(),
      isNavigationRequest: primaryRequest.isNavigationRequest(),
      frame: safeFrameScope(primaryRequest, page)
    };
    expect(primaryRequest.isNavigationRequest(), `Expected ${path} page.goto request to be navigation`).toBe(true);
    expect(primaryResponse.status(), `Expected ${path} to return 200`).toBe(200);
    expectExpectedLocation(primaryResponse.url(), path, `${path} response`);
    expectExpectedLocation(page.url(), path, `${path} page`);
    if (html) {
      await expect(page.locator("main")).toBeVisible();
      await expectLoadedImages(page);
      await expectNoHorizontalOverflow(page);
      mediaState = await expectReadyMedia(page, issues);
      await issues.settle();
      mediaState = await expectReadyMedia(page, issues);
    }
  } catch (error) {
    issues.navigationError = sanitizeDiagnosticText(error instanceof Error ? error.message : String(error));
    await issues.settle();
    issues.finalize(issues.mediaState ?? mediaState);
    await issues.settle();
    throw new Error(
      `${issues.navigationError}\nPreview diagnostics:\n${formatDiagnostics(issues) || "none"}`
    );
  }

  await issues.settle();
  issues.finalize(mediaState);
  await issues.settle();
  const diagnostics = formatDiagnostics(issues);
  expect(issues.failedResponses, `Unexpected HTTP responses.\n${diagnostics}`).toEqual([]);
  expect(issues.failedRequests, `Unexpected failed requests.\n${diagnostics}`).toEqual([]);
  expect(issues.consoleErrors, `Unexpected console errors.\n${diagnostics}`).toEqual([]);
  expect(issues.pageErrors, `Unexpected page errors.\n${diagnostics}`).toEqual([]);
  for (const entry of issues.ignoredRequests) {
    console.info(`[Preview Gate] benign request cancellation: ${JSON.stringify(entry)}`);
  }
}

test.describe("trusted Vercel Preview Gate", () => {
  for (const path of [
    "/",
    "/en",
    "/demo",
    "/menu/trouvable?lang=en-CA",
    "/menu/sauge-noire?lang=en-CA",
    "/menu/trouvable/dishes/pesto-burrata-verde?lang=en-CA"
  ]) {
    test(`loads ${path} without runtime failures`, async ({ page }) => {
      await expectHealthyRoute(page, path);
    });
  }

  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    test(`serves ${path} without an unexpected error`, async ({ page }) => {
      await expectHealthyRoute(page, path, false);
    });
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    test(`keeps the landing route within ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await expectHealthyRoute(page, "/");
    });
  }
});
