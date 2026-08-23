import assert from "node:assert/strict";
import test from "node:test";

const {
  MODEL_VIEWER_NO_AR_FALLBACK_HASH,
  classifyArBrowser,
  isSceneViewerFallbackHash,
  resolveArExperience
} = await import("../lib/ar/arExperience.ts");
const { getSafeCurrentPageUrl } = await import("../lib/menu/arBrowserHandoff.ts");

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const BRAVE_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const FIREFOX_ANDROID =
  "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0";
const WEBVIEW_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36";
const INSTAGRAM_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 Instagram 312.0.0.0.0";
const SAMSUNG_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
const EDGE_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 EdgA/125.0.0.0";
const OPERA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 OPR/76.0.0.0";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const BRAVE_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 Brave/1.67.0";
const INSTAGRAM_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 312.0.0.0.0";
const CRIOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

test("classifyArBrowser maps platform and unsupported browsers without treating UA as ARCore proof", () => {
  const cases = [
    {
      name: "Android Chrome",
      input: { userAgent: CHROME_ANDROID, platform: "Linux armv8l", maxTouchPoints: 5 },
      expected: "android-chrome"
    },
    {
      name: "Android Brave via navigator.brave",
      input: {
        userAgent: BRAVE_ANDROID,
        platform: "Linux armv8l",
        maxTouchPoints: 5,
        brave: true
      },
      expected: "android-other"
    },
    {
      name: "Android Firefox",
      input: { userAgent: FIREFOX_ANDROID, platform: "Linux armv8l", maxTouchPoints: 5 },
      expected: "android-other"
    },
    {
      name: "Android WebView",
      input: { userAgent: WEBVIEW_ANDROID, platform: "Linux armv8l", maxTouchPoints: 5 },
      expected: "android-other"
    },
    {
      name: "Android WebView without the wv token still needs Chrome handoff",
      input: {
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36",
        platform: "Linux armv8l",
        maxTouchPoints: 5
      },
      expected: "android-other"
    },
    {
      name: "Android Instagram",
      input: { userAgent: INSTAGRAM_ANDROID, platform: "Linux armv8l", maxTouchPoints: 5 },
      expected: "android-other"
    },
    {
      name: "Samsung Internet",
      input: { userAgent: SAMSUNG_ANDROID, platform: "Linux armv8l", maxTouchPoints: 5 },
      expected: "android-other"
    },
    {
      name: "Edge Android",
      input: { userAgent: EDGE_ANDROID, platform: "Linux armv8l", maxTouchPoints: 5 },
      expected: "android-other"
    },
    {
      name: "Opera Android",
      input: { userAgent: OPERA_ANDROID, platform: "Linux armv8l", maxTouchPoints: 5 },
      expected: "android-other"
    },
    {
      name: "Android reduced UA without a Chrome brand is not treated as Chrome",
      input: {
        userAgent: "Mozilla/5.0 (Linux; Mobile)",
        userAgentDataPlatform: "Android",
        maxTouchPoints: 5
      },
      expected: "android-other"
    },
    {
      name: "Android reduced UA with Google Chrome brand",
      input: {
        userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36",
        userAgentDataPlatform: "Android",
        userAgentDataBrands: ["Not_A Brand", "Chromium", "Google Chrome"],
        maxTouchPoints: 5
      },
      expected: "android-chrome"
    },
    {
      name: "Android reduced UA with Edge brand stays unsupported",
      input: {
        userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36",
        userAgentDataPlatform: "Android",
        userAgentDataBrands: ["Not_A Brand", "Chromium", "Microsoft Edge"],
        maxTouchPoints: 5
      },
      expected: "android-other"
    },
    {
      name: "iOS Safari",
      input: { userAgent: SAFARI_IOS, platform: "iPhone", maxTouchPoints: 5 },
      expected: "ios-safari"
    },
    {
      name: "iOS Brave",
      input: { userAgent: BRAVE_IOS, platform: "iPhone", maxTouchPoints: 5, brave: true },
      expected: "ios-other"
    },
    {
      name: "iOS Instagram",
      input: { userAgent: INSTAGRAM_IOS, platform: "iPhone", maxTouchPoints: 5 },
      expected: "ios-other"
    },
    {
      name: "iOS Chrome",
      input: { userAgent: CRIOS, platform: "iPhone", maxTouchPoints: 5 },
      expected: "ios-other"
    },
    {
      name: "iPadOS desktop mode",
      input: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5
      },
      expected: "ios-safari"
    },
    {
      name: "desktop Chrome",
      input: { userAgent: DESKTOP_CHROME, platform: "Win32", maxTouchPoints: 0 },
      expected: "desktop"
    },
    {
      name: "unknown UA",
      input: { userAgent: "masked" },
      expected: "desktop"
    }
  ];

  for (const testCase of cases) {
    assert.equal(
      classifyArBrowser(testCase.input),
      testCase.expected,
      testCase.name
    );
  }
});

test("resolveArExperience keeps Chrome Android on the CTA until a runtime failure", () => {
  const chromeReady = resolveArExperience({
    browser: "android-chrome",
    modelReady: true,
    hasArLite: true,
    hasUsdz: false,
    runtime: "none"
  });
  assert.deepEqual(chromeReady, { kind: "cta", platform: "android" });

  const chromeFailed = resolveArExperience({
    browser: "android-chrome",
    modelReady: true,
    hasArLite: true,
    hasUsdz: false,
    runtime: "ar-status-failed"
  });
  assert.equal(chromeFailed.kind, "unsupported-device");

  const chromeRejected = resolveArExperience({
    browser: "android-chrome",
    modelReady: true,
    hasArLite: true,
    hasUsdz: false,
    runtime: "activation-rejected"
  });
  assert.equal(chromeRejected.kind, "activation-failed");

  const chromeSceneViewer = resolveArExperience({
    browser: "android-chrome",
    modelReady: true,
    hasArLite: true,
    hasUsdz: false,
    runtime: "scene-viewer-unavailable"
  });
  assert.equal(chromeSceneViewer.kind, "unsupported-device");
});

test("resolveArExperience never recommends Chrome when the session is already Chrome", () => {
  for (const runtime of [
    "ar-status-failed",
    "activation-rejected",
    "scene-viewer-unavailable"
  ]) {
    const phase = resolveArExperience({
      browser: "android-chrome",
      modelReady: true,
      hasArLite: true,
      hasUsdz: false,
      runtime
    });
    assert.notEqual(phase.kind, "handoff");
    if (phase.kind === "handoff") {
      assert.notEqual(phase.recommendedBrowser, "chrome");
    }
  }
});

test("resolveArExperience sends unsupported Android browsers to Chrome handoff without a CTA", () => {
  const phase = resolveArExperience({
    browser: "android-other",
    modelReady: true,
    hasArLite: true,
    hasUsdz: false,
    runtime: "none"
  });
  assert.deepEqual(phase, {
    kind: "handoff",
    recommendedBrowser: "chrome"
  });

  const afterFailedAttempt = resolveArExperience({
    browser: "android-other",
    modelReady: true,
    hasArLite: true,
    hasUsdz: false,
    runtime: "activation-rejected"
  });
  assert.deepEqual(afterFailedAttempt, {
    kind: "handoff",
    recommendedBrowser: "chrome"
  });
});

test("iOS Safari Quick Look stays available even if an Android runtime signal is present", () => {
  for (const runtime of [
    "ar-status-failed",
    "activation-rejected",
    "scene-viewer-unavailable"
  ]) {
    assert.deepEqual(
      resolveArExperience({
        browser: "ios-safari",
        modelReady: true,
        hasArLite: true,
        hasUsdz: true,
        runtime
      }),
      { kind: "cta", platform: "ios" }
    );
  }
});

test("resolveArExperience preserves iOS Safari Quick Look and iOS handoff", () => {
  assert.deepEqual(
    resolveArExperience({
      browser: "ios-safari",
      modelReady: true,
      hasArLite: true,
      hasUsdz: true,
      runtime: "none"
    }),
    { kind: "cta", platform: "ios" }
  );

  assert.deepEqual(
    resolveArExperience({
      browser: "ios-other",
      modelReady: true,
      hasArLite: true,
      hasUsdz: true,
      runtime: "none"
    }),
    { kind: "handoff", recommendedBrowser: "safari" }
  );

  assert.deepEqual(
    resolveArExperience({
      browser: "ios-safari",
      modelReady: true,
      hasArLite: true,
      hasUsdz: false,
      runtime: "none"
    }),
    { kind: "missing-usdz" }
  );
});

test("resolveArExperience keeps desktop 3D without an AR CTA", () => {
  assert.deepEqual(
    resolveArExperience({
      browser: "desktop",
      modelReady: true,
      hasArLite: true,
      hasUsdz: true,
      runtime: "none"
    }),
    { kind: "desktop-hint" }
  );
});

test("resolveArExperience stays idle until the 3D model is ready", () => {
  assert.deepEqual(
    resolveArExperience({
      browser: "android-chrome",
      modelReady: false,
      hasArLite: true,
      hasUsdz: false,
      runtime: "none"
    }),
    { kind: "idle" }
  );
});

test("canActivateAR false after load on Chrome Android is an unsupported device, not a Chrome handoff", () => {
  const phase = resolveArExperience({
    browser: "android-chrome",
    modelReady: true,
    hasArLite: true,
    hasUsdz: false,
    runtime: "none",
    canActivateAR: false
  });
  assert.equal(phase.kind, "unsupported-device");
});

test("canActivateAR true or unset never hides a ready Chrome Android CTA", () => {
  for (const canActivateAR of [true, null, undefined]) {
    const phase = resolveArExperience({
      browser: "android-chrome",
      modelReady: true,
      hasArLite: true,
      hasUsdz: false,
      runtime: "none",
      canActivateAR
    });
    assert.deepEqual(phase, { kind: "cta", platform: "android" });
  }
});

test("Chrome Android without an AR Lite asset is asset-unavailable, never a Chrome handoff", () => {
  assert.deepEqual(
    resolveArExperience({
      browser: "android-chrome",
      modelReady: true,
      hasArLite: false,
      hasUsdz: false,
      runtime: "none"
    }),
    { kind: "asset-unavailable" }
  );
});

test("unsupported Android browsers without an AR Lite asset do not recommend Chrome", () => {
  assert.deepEqual(
    resolveArExperience({
      browser: "android-other",
      modelReady: true,
      hasArLite: false,
      hasUsdz: false,
      runtime: "none"
    }),
    { kind: "asset-unavailable" }
  );
});

test("unsupported Android browsers with an AR Lite asset still get a Chrome handoff", () => {
  assert.deepEqual(
    resolveArExperience({
      browser: "android-other",
      modelReady: true,
      hasArLite: true,
      hasUsdz: false,
      runtime: "none"
    }),
    { kind: "handoff", recommendedBrowser: "chrome" }
  );
});

test("Scene Viewer fallback hash is the real Android failure signal from model-viewer 4.2", () => {
  assert.equal(MODEL_VIEWER_NO_AR_FALLBACK_HASH, "#model-viewer-no-ar-fallback");
  assert.equal(isSceneViewerFallbackHash("#model-viewer-no-ar-fallback"), true);
  assert.equal(isSceneViewerFallbackHash("#dish"), false);
  assert.equal(isSceneViewerFallbackHash(""), false);
});

test("getSafeCurrentPageUrl keeps the current origin and rejects javascript URLs", () => {
  const href =
    "https://vistaire.ca/menu/trouvable/dishes/homard?lang=fr-CA&table=12&zone=terrasse&view=list";
  assert.equal(
    getSafeCurrentPageUrl({
      href,
      origin: "https://vistaire.ca",
      protocol: "https:"
    }),
    href
  );
  assert.equal(
    getSafeCurrentPageUrl({
      href: "javascript:alert(1)",
      origin: "https://vistaire.ca",
      protocol: "javascript:"
    }),
    ""
  );
  assert.equal(
    getSafeCurrentPageUrl({
      href: "https://evil.example/phish",
      origin: "https://vistaire.ca",
      protocol: "https:"
    }),
    ""
  );
  assert.equal(
    getSafeCurrentPageUrl({
      href:
        "https://vistaire.ca/menu/trouvable/dishes/homard?lang=fr-CA&table=12&zone=terrasse&view=list#model-viewer-no-ar-fallback",
      origin: "https://vistaire.ca",
      protocol: "https:"
    }),
    "https://vistaire.ca/menu/trouvable/dishes/homard?lang=fr-CA&table=12&zone=terrasse&view=list"
  );
});
