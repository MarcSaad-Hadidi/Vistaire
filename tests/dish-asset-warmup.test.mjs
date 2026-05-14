import test from "node:test";
import assert from "node:assert/strict";

import {
  prefetchUsdzForQuickLook,
  prepareDishAssetIntent
} from "../lib/dishAssetWarmup.ts";

function installBrowserLikeEnvironment(overrides = {}) {
  const fetchCalls = [];
  const appendedLinks = [];
  const fetchOptions = [];
  const origin = overrides.origin ?? "http://localhost:3000";

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      connection: {
        effectiveType: overrides.effectiveType ?? "4g",
        saveData: overrides.saveData ?? false
      },
      maxTouchPoints: overrides.maxTouchPoints ?? 1,
      platform: overrides.platform ?? "Win32",
      userAgent: overrides.userAgent ?? "Mozilla/5.0"
    }
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tagName) => ({
        crossOrigin: "",
        href: "",
        rel: "",
        tagName,
        setAttribute(name, value) {
          this[name] = value;
        }
      }),
      head: {
        appendChild: (element) => {
          appendedLinks.push(element);
        }
      }
    }
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
      location: {
        href: `${origin}/demo`,
        origin
      },
      setTimeout
    }
  });

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (url, options) => {
      fetchCalls.push(String(url));
      fetchOptions.push(options ?? {});
      return new Response("");
    }
  });

  return {
    appendedLinks,
    fetchCalls,
    fetchOptions,
    async settleWarmupQueue() {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
}

test("menu-card asset intent does not fetch large demo GLB or USDZ files", async () => {
  const env = installBrowserLikeEnvironment();

  prepareDishAssetIntent({
    model3dUrl: "/models/demo/ravioles-chevre-miel.glb",
    usdzUrl: "/models/demo/ravioles-chevre-miel.usdz"
  });
  await env.settleWarmupQueue();

  assert.deepEqual(env.fetchCalls, []);
});

test("menu-card asset intent can warm very small demo assets only", async () => {
  const env = installBrowserLikeEnvironment();

  prepareDishAssetIntent({
    model3dUrl: "/models/demo/maison-elyse-n1.glb",
    usdzUrl: "/models/demo/maison-elyse-n1.usdz"
  });
  await env.settleWarmupQueue();

  assert.deepEqual(env.fetchCalls, [
    "http://localhost:3000/models/demo/maison-elyse-n1.glb",
    "http://localhost:3000/models/demo/maison-elyse-n1.usdz"
  ]);
});

test("iPhone Quick Look prefetch warms only the current dish AR-lite USDZ with a stable URL", async () => {
  const env = installBrowserLikeEnvironment({
    origin: "http://localhost:3001",
    platform: "iPhone",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
  });
  const states = [];

  prefetchUsdzForQuickLook(
    {
      model3dUrl: "/models/demo/homard-bisque.glb",
      webModel3dUrl: "/models/demo/homard-bisque-meshopt-73be7175.glb",
      arModel3dUrl: "/models/demo/ar-lite/homard-bisque-ar-lite.glb",
      usdzUrl: "/models/demo/homard-bisque.usdz",
      arUsdzUrl: "/models/demo/ar-lite/homard-bisque-ios-quicklook-v2.usdz"
    },
    (state) => states.push(state)
  );
  await env.settleWarmupQueue();

  assert.deepEqual(env.fetchCalls, [
    "http://localhost:3001/models/demo/ar-lite/homard-bisque-ios-quicklook-v2.usdz"
  ]);
  assert.equal(env.fetchCalls[0].includes("?"), false);
  assert.equal(env.fetchOptions[0].cache, "force-cache");
  assert.deepEqual(
    env.appendedLinks.map((link) => ({
      as: link.as,
      href: link.href,
      rel: link.rel,
      type: link.type
    })),
    [
      {
        as: "fetch",
        href: "http://localhost:3001/models/demo/ar-lite/homard-bisque-ios-quicklook-v2.usdz",
        rel: "prefetch",
        type: "model/vnd.usdz+zip"
      }
    ]
  );
  assert.deepEqual(states, ["preparing", "ready"]);
});

test("iPhone Quick Look prefetch respects Save-Data", async () => {
  const env = installBrowserLikeEnvironment({
    origin: "http://localhost:3002",
    platform: "iPhone",
    saveData: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
  });
  const states = [];

  prefetchUsdzForQuickLook(
    {
      model3dUrl: "/models/demo/homard-bisque.glb",
      usdzUrl: "/models/demo/homard-bisque.usdz",
      arUsdzUrl: "/models/demo/ar-lite/homard-bisque-ios-quicklook-v2.usdz"
    },
    (state) => states.push(state)
  );
  await env.settleWarmupQueue();

  assert.deepEqual(env.fetchCalls, []);
  assert.deepEqual(states, ["idle"]);
});

test("iPhone Quick Look prefetch does not run in iOS Chrome shells", async () => {
  const env = installBrowserLikeEnvironment({
    origin: "http://localhost:3003",
    platform: "iPhone",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1"
  });
  const states = [];

  prefetchUsdzForQuickLook(
    {
      model3dUrl: "/models/demo/homard-bisque.glb",
      usdzUrl: "/models/demo/homard-bisque.usdz",
      arUsdzUrl: "/models/demo/ar-lite/homard-bisque-ios-quicklook-v2.usdz"
    },
    (state) => states.push(state)
  );
  await env.settleWarmupQueue();

  assert.deepEqual(env.fetchCalls, []);
  assert.deepEqual(states, ["idle"]);
});
