import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  TROUVABLE_COPY,
  buildTrouvableLocalizedUiCopyPack,
  getTrouvableUiCopyTranslationEntries
} = await import("../components/menu/trouvableMenuControls.ts");
const {
  copyTextToClipboard,
  detectArHandoffPlatform
} = await import("../lib/menu/arBrowserHandoff.ts");

test("detectArHandoffPlatform distinguishes iOS, iPadOS, Android and desktop", () => {
  const cases = [
    {
      name: "iPhone",
      input: {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
        platform: "iPhone",
        maxTouchPoints: 5
      },
      expected: "ios"
    },
    {
      name: "iPad",
      input: {
        userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)",
        platform: "iPad",
        maxTouchPoints: 5
      },
      expected: "ios"
    },
    {
      name: "iPod",
      input: {
        userAgent: "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_7 like Mac OS X)",
        platform: "iPod",
        maxTouchPoints: 5
      },
      expected: "ios"
    },
    {
      name: "iPadOS desktop mode",
      input: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        platform: "MacIntel",
        maxTouchPoints: 5
      },
      expected: "ios"
    },
    {
      name: "Android",
      input: {
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36",
        platform: "Linux armv8l",
        maxTouchPoints: 5
      },
      expected: "android"
    },
    {
      name: "Android userAgentData",
      input: {
        userAgent: "Mozilla/5.0 (Linux; Mobile)",
        platform: "Linux armv8l",
        userAgentDataPlatform: "Android"
      },
      expected: "android"
    },
    {
      name: "macOS",
      input: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)",
        platform: "MacIntel",
        maxTouchPoints: 0
      },
      expected: "other"
    },
    {
      name: "Windows",
      input: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        platform: "Win32",
        maxTouchPoints: 0
      },
      expected: "other"
    },
    {
      name: "empty user agent",
      input: { userAgent: "" },
      expected: "other"
    },
    {
      name: "unknown platform",
      input: { userAgent: "masked", platform: "Unknown" },
      expected: "other"
    }
  ];

  for (const testCase of cases) {
    assert.equal(
      detectArHandoffPlatform(testCase.input),
      testCase.expected,
      testCase.name
    );
  }
});

test("clipboard helper reports success and failure without throwing", async () => {
  let copiedText = "";
  const success = await copyTextToClipboard("https://vistaire.ca/menu/trouvable?dish=1", {
    writeText: async (text) => {
      copiedText = text;
    }
  });
  assert.equal(success, true);
  assert.equal(copiedText, "https://vistaire.ca/menu/trouvable?dish=1");

  const failure = await copyTextToClipboard("https://vistaire.ca/menu/trouvable", {
    writeText: async () => {
      throw new Error("clipboard denied");
    }
  });
  assert.equal(failure, false);
  assert.equal(await copyTextToClipboard("https://vistaire.ca/menu/trouvable", undefined), false);
});

test("clipboard helper falls back to the legacy document copy path", async () => {
  let copiedText = "";
  let removed = false;
  const textarea = {
    value: "",
    style: {},
    setAttribute() {},
    select() {},
    remove() {
      removed = true;
    }
  };
  const documentApi = {
    body: {
      appendChild(element) {
        copiedText = element.value;
      }
    },
    createElement() {
      return textarea;
    },
    execCommand(command) {
      return command === "copy";
    }
  };

  assert.equal(
    await copyTextToClipboard(
      "https://vistaire.ca/menu/trouvable?dish=legacy",
      undefined,
      documentApi
    ),
    true
  );
  assert.equal(copiedText, "https://vistaire.ca/menu/trouvable?dish=legacy");
  assert.equal(removed, true);
});

test("built-in AR fallback copy is complete for every supported locale", () => {
  const locales = ["fr", "en", "es", "it", "de", "el", "ar"];
  const platformKeys = ["ios", "android", "other", "device"];

  for (const locale of locales) {
    const fallback = TROUVABLE_COPY[locale].arBrowserFallback;
    for (const platform of platformKeys) {
      for (const key of ["title", "body", "action", "success"]) {
        assert.equal(typeof fallback[platform][key], "string", `${locale}.${platform}.${key}`);
        assert.ok(fallback[platform][key].trim(), `${locale}.${platform}.${key}`);
      }
    }
    for (const key of ["copyError", "manualCopyLabel", "selectLink"]) {
      assert.equal(typeof fallback[key], "string", `${locale}.${key}`);
      assert.ok(fallback[key].trim(), `${locale}.${key}`);
    }
  }

  const entries = getTrouvableUiCopyTranslationEntries("fr-CA");
  assert.ok(entries.some((entry) => entry.path === "arBrowserFallback.ios.title"));
  const pack = buildTrouvableLocalizedUiCopyPack(
    entries,
    entries.map((entry) => entry.text)
  );
  assert.equal(pack.arBrowserFallback.ios.title, TROUVABLE_COPY.fr.arBrowserFallback.ios.title);
});

test("arFallbackUiMode never maps Chrome Android runtime failure to a browser handoff", async () => {
  const { arFallbackUiMode } = await import("../lib/ar/arExperience.ts");
  assert.equal(arFallbackUiMode("ios-handoff"), "browser");
  assert.equal(arFallbackUiMode("android-handoff"), "browser");
  assert.equal(arFallbackUiMode("missing-ios-usdz"), "none");
  assert.equal(arFallbackUiMode("unsupported-device"), "device");
  assert.equal(arFallbackUiMode("activation-failed"), "device");
  assert.equal(arFallbackUiMode("ar-status-failed"), "device");
  assert.equal(arFallbackUiMode("scene-viewer-fallback"), "device");
  assert.equal(arFallbackUiMode("asset-unavailable"), "asset");
  assert.equal(
    arFallbackUiMode("android-fallback"),
    "device",
    "legacy android-fallback was a runtime/device failure, never a Chrome handoff"
  );
});

test("Trouvable keeps browser handoff separate from a generic 3D load failure", async () => {
  const [premium, standalone, viewer] = await Promise.all([
    readFile("components/menu/TrouvablePremiumMenuExperience.tsx", "utf8"),
    readFile("components/menu/TrouvableDishDetailExperience.tsx", "utf8"),
    readFile("components/dish/DishModelViewer.tsx", "utf8")
  ]);

  assert.doesNotMatch(premium, /showArBrowserHelp\s*\|\|\s*modelViewerLoadFailed/);
  assert.doesNotMatch(standalone, /className=\{styles\.arBrowserHelp\}/);
  assert.match(premium, /arFallbackUiMode/);
  assert.match(standalone, /arFallbackUiMode/);
  assert.match(premium, /showArDeviceHelp/);
  assert.match(standalone, /showArDeviceHelp/);
  assert.match(premium, /showArAssetHelp/);
  assert.match(standalone, /showArAssetHelp/);
  assert.match(viewer, /onArFallbackNeeded\?: \(reason: ArFallbackReason\)/);
  assert.match(viewer, /getSafeCurrentPageUrl/);
  assert.match(viewer, /ArFallbackPanel/);
  assert.match(viewer, /fallbackPresentation/);
  assert.doesNotMatch(viewer, /!quietChrome && showAndroidFallback/);
  assert.match(
    viewer,
    /arExperience\.kind === "desktop-hint" && !quietChrome/
  );
  assert.match(viewer, /manifest\.variants\.arLite/);
  assert.doesNotMatch(viewer, /navigator\.clipboard\?\.writeText/);
  assert.match(premium, /setModelViewerLoadFailed\(true\)/);
});
