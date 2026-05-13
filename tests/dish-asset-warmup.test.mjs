import test from "node:test";
import assert from "node:assert/strict";

import { prepareDishAssetIntent } from "../lib/dishAssetWarmup.ts";

function installBrowserLikeEnvironment() {
  const fetchCalls = [];
  const appendedLinks = [];

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      connection: { effectiveType: "4g", saveData: false },
      maxTouchPoints: 1,
      platform: "Win32",
      userAgent: "Mozilla/5.0"
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
        href: "http://localhost:3000/demo",
        origin: "http://localhost:3000"
      },
      setTimeout
    }
  });

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (url) => {
      fetchCalls.push(String(url));
      return new Response("");
    }
  });

  return {
    appendedLinks,
    fetchCalls,
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
