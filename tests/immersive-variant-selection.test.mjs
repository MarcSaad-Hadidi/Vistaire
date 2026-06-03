import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDemoDish3dManifest,
  selectImmersiveVariant
} from "../lib/dish3dManifest.ts";

const baseDish = {
  slug: "homard-bisque",
  categorySlug: "plats-signatures",
  name: "Homard bleu",
  model3dUrl: "/models/demo/homard-bisque.glb",
  webModel3dUrl: "/models/demo/homard-bisque-meshopt-ee44bc60.glb",
  arModel3dUrl: "/models/demo/ar-lite/homard-bisque-ar-lite.glb",
  arUsdzUrl: "/models/demo/ar-lite/homard-bisque-ios-quicklook-ultra.usdz",
  image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png"
};

function select(overrides = {}) {
  return selectImmersiveVariant({
    manifest: buildDemoDish3dManifest(baseDish),
    device: "desktop",
    browser: "chrome",
    viewport: { width: 1440, height: 900 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "view3d",
    prefersReducedMotion: false,
    ...overrides
  });
}

test("demo adapter exposes a schema v2 manifest without mutating legacy dish fields", () => {
  const dish = { ...baseDish };
  const manifest = buildDemoDish3dManifest(dish);

  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.kind, "vistaire.dish-3d-manifest");
  assert.equal(manifest.restaurantSlug, "maison-elyse");
  assert.equal(manifest.menuSlug, "demo");
  assert.equal(manifest.dishSlug, "homard-bisque");
  assert.equal(manifest.status, "approved");
  assert.equal(manifest.validationStatus, "passed");
  assert.equal(manifest.variants.web.url, baseDish.webModel3dUrl);
  assert.equal(manifest.variants.mobile.url, baseDish.arModel3dUrl);
  assert.equal(manifest.variants.arLite.url, baseDish.arModel3dUrl);
  assert.equal(manifest.variants.iosUsdz.url, baseDish.arUsdzUrl);
  assert.equal(manifest.variants.poster.url, baseDish.image);
  assert.equal(dish.webModel3dUrl, baseDish.webModel3dUrl);
});

test("variant selector keeps all models behind explicit user intent", () => {
  const result = select({ userIntent: "none" });

  assert.equal(result.kind, "poster");
  assert.equal(result.url, baseDish.image);
  assert.equal(result.shouldLoadModel, false);
  assert.match(result.reason, /intent/i);
});

test("variant selector chooses desktop web and mobile preview variants for 3D intent", () => {
  assert.equal(select().kind, "web");
  assert.equal(select().url, baseDish.webModel3dUrl);

  const mobile = select({
    device: "android",
    browser: "chrome",
    viewport: { width: 390, height: 844 }
  });

  assert.equal(mobile.kind, "mobile");
  assert.equal(mobile.url, baseDish.arModel3dUrl);
  assert.equal(mobile.shouldLoadModel, true);
});

test("variant selector offers Android AR only when an AR-lite variant exists", () => {
  const android = select({
    device: "android",
    browser: "chrome",
    userIntent: "ar"
  });

  assert.equal(android.kind, "arLite");
  assert.equal(android.url, baseDish.arModel3dUrl);

  const noArLiteManifest = buildDemoDish3dManifest({
    ...baseDish,
    arModel3dUrl: ""
  });
  const fallback = selectImmersiveVariant({
    manifest: noArLiteManifest,
    device: "android",
    browser: "chrome",
    viewport: { width: 390, height: 844 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "ar",
    prefersReducedMotion: false
  });

  assert.equal(fallback.kind, "mobile");
  assert.equal(fallback.shouldLoadModel, true);
  assert.match(fallback.message, /3D reste disponible/i);
});

test("variant selector handles iOS Safari, iOS Chrome, slow network, and unsafe URLs", () => {
  const safari = select({
    device: "ios",
    browser: "safari",
    userIntent: "ar",
    viewport: { width: 390, height: 844 }
  });
  assert.equal(safari.kind, "iosUsdz");
  assert.equal(safari.url, baseDish.arUsdzUrl);

  const chrome = select({
    device: "ios",
    browser: "chrome",
    userIntent: "ar",
    viewport: { width: 390, height: 844 }
  });
  assert.equal(chrome.kind, "mobile");
  assert.match(chrome.message, /Safari/i);

  const slow = select({
    device: "android",
    browser: "chrome",
    connection: { effectiveType: "3g", saveData: true },
    viewport: { width: 390, height: 844 }
  });
  assert.equal(slow.kind, "poster");
  assert.equal(slow.requiresConfirmation, true);
  assert.equal(slow.shouldLoadModel, false);

  const unsafeManifest = buildDemoDish3dManifest({
    ...baseDish,
    webModel3dUrl: "/models/demo/homard-bisque.glb?v=1"
  });
  const unsafe = selectImmersiveVariant({
    manifest: unsafeManifest,
    device: "desktop",
    browser: "chrome",
    viewport: { width: 1440, height: 900 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "view3d",
    prefersReducedMotion: false
  });
  assert.equal(unsafe.kind, "none");
  assert.equal(unsafe.shouldLoadModel, false);
  assert.match(unsafe.reason, /unsafe/i);
});

test("variant selector rejects wrong roots, wrong extensions, and visually unapproved production manifests", () => {
  const baseManifest = buildDemoDish3dManifest(baseDish);
  const visuallyUnapproved = {
    ...baseManifest,
    status: "published",
    quality: {
      manualVisualApprovalRequired: true,
      manualVisualApproved: false
    }
  };
  const blockedQuality = selectImmersiveVariant({
    manifest: visuallyUnapproved,
    device: "desktop",
    browser: "chrome",
    viewport: { width: 1440, height: 900 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "view3d",
    prefersReducedMotion: false
  });
  assert.equal(blockedQuality.kind, "none");
  assert.equal(blockedQuality.reason, "manifest-not-runtime-eligible");

  const wrongWebExtension = {
    ...baseManifest,
    variants: {
      ...baseManifest.variants,
      web: { url: "/models/demo/homard-bisque.webp" }
    }
  };
  const blockedWeb = selectImmersiveVariant({
    manifest: wrongWebExtension,
    device: "desktop",
    browser: "chrome",
    viewport: { width: 1440, height: 900 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "view3d",
    prefersReducedMotion: false
  });
  assert.equal(blockedWeb.kind, "none");
  assert.equal(blockedWeb.shouldLoadModel, false);
  assert.match(blockedWeb.reason, /unsafe/i);

  const wrongQuickLookRoot = {
    ...baseManifest,
    variants: {
      ...baseManifest.variants,
      iosUsdz: { url: "/models/demo/homard-bisque.usdz", productionQuickLook: true }
    }
  };
  const blockedQuickLook = selectImmersiveVariant({
    manifest: wrongQuickLookRoot,
    device: "ios",
    browser: "safari",
    viewport: { width: 390, height: 844 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "ar",
    prefersReducedMotion: false
  });
  assert.equal(blockedQuickLook.kind, "mobile");
  assert.equal(blockedQuickLook.reason, "ios-usdz-missing");

  const wrongQuickLookExtension = {
    ...baseManifest,
    variants: {
      ...baseManifest.variants,
      iosUsdz: { url: "/models/demo/ar-lite/homard-bisque.glb", productionQuickLook: true }
    }
  };
  const blockedQuickLookExtension = selectImmersiveVariant({
    manifest: wrongQuickLookExtension,
    device: "ios",
    browser: "safari",
    viewport: { width: 390, height: 844 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "ar",
    prefersReducedMotion: false
  });
  assert.equal(blockedQuickLookExtension.kind, "mobile");
  assert.equal(blockedQuickLookExtension.reason, "ios-usdz-missing");

  const unsafeLocalRoot = {
    ...baseManifest,
    variants: {
      ...baseManifest.variants,
      mobile: { url: "/api/internal-model.glb" },
      web: { url: "/api/internal-model.glb" }
    }
  };
  const blockedRoot = selectImmersiveVariant({
    manifest: unsafeLocalRoot,
    device: "android",
    browser: "firefox",
    viewport: { width: 390, height: 844 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "view3d",
    prefersReducedMotion: false
  });
  assert.equal(blockedRoot.kind, "none");
  assert.match(blockedRoot.reason, /unsafe/i);
});

test("variant selector accepts only allowlisted CDN origins with stable role-specific URLs", () => {
  const cdnManifest = {
    ...buildDemoDish3dManifest(baseDish),
    variants: {
      poster: {
        url: "https://cdn.example.com/vistaire/maison-elyse/demo/homard-bisque/v1/poster/homard-bisque.png"
      },
      web: {
        url: "https://cdn.example.com/vistaire/maison-elyse/demo/homard-bisque/v1/web/homard-bisque-web.glb"
      },
      mobile: {
        url: "https://cdn.example.com/vistaire/maison-elyse/demo/homard-bisque/v1/mobile/homard-bisque-mobile.glb"
      },
      arLite: {
        url: "https://cdn.example.com/vistaire/maison-elyse/demo/homard-bisque/v1/ar-lite/homard-bisque-ar-lite.glb"
      },
      iosUsdz: {
        url: "https://cdn.example.com/vistaire/maison-elyse/demo/homard-bisque/v1/ios/homard-bisque.usdz"
      }
    }
  };

  const allowed = selectImmersiveVariant({
    manifest: cdnManifest,
    device: "desktop",
    browser: "chrome",
    viewport: { width: 1440, height: 900 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "view3d",
    prefersReducedMotion: false,
    allowedExternalOrigins: ["https://cdn.example.com"]
  });
  assert.equal(allowed.kind, "web");
  assert.equal(allowed.url, cdnManifest.variants.web.url);

  const blockedOrigin = selectImmersiveVariant({
    manifest: cdnManifest,
    device: "desktop",
    browser: "chrome",
    viewport: { width: 1440, height: 900 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "view3d",
    prefersReducedMotion: false,
    allowedExternalOrigins: ["https://static.example.com"]
  });
  assert.equal(blockedOrigin.kind, "none");
  assert.match(blockedOrigin.reason, /unsafe/i);

  const blockedQuery = selectImmersiveVariant({
    manifest: {
      ...cdnManifest,
      variants: {
        ...cdnManifest.variants,
        web: { url: `${cdnManifest.variants.web.url}?v=1` }
      }
    },
    device: "desktop",
    browser: "chrome",
    viewport: { width: 1440, height: 900 },
    connection: { effectiveType: "4g", saveData: false },
    userIntent: "view3d",
    prefersReducedMotion: false,
    allowedExternalOrigins: ["https://cdn.example.com"]
  });
  assert.equal(blockedQuery.kind, "none");
  assert.match(blockedQuery.reason, /unsafe/i);
});
