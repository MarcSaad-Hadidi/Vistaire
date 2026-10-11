import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import {
  PUBLIC_MODEL_ASSETS,
  getPublicModelAsset,
  getPublicModelRedirects,
  indexPublicModelFramingHulls,
  isPublicModelCdnUrl,
  publicModelBaseUrl,
  resolvePublicModelUrl,
} from "../lib/publicModelAssets.ts";
import { isSafe3dAssetUrl } from "../lib/dish3dManifest.ts";

test("public model manifest pins all authorized candidates to their exact source bytes", async () => {
  assert.equal(PUBLIC_MODEL_ASSETS.length, 58);
  assert.equal(new Set(PUBLIC_MODEL_ASSETS.map((asset) => asset.id)).size, 58);
  assert.equal(new Set(PUBLIC_MODEL_ASSETS.map((asset) => asset.legacyUrl)).size, 58);
  for (const asset of PUBLIC_MODEL_ASSETS) {
    assert.equal(asset.visibility, "public");
    assert.equal(asset.version, `sha256-${asset.sha256}`);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.ok(!asset.legacyUrl.includes("homard-bisque.usdz"), "source-only USDZ is excluded");
    const source = asset.legacyUrl === "/immersive-assets/ar/burger.usdz"
      ? gunzipSync(await readFile("assets/immersive-runtime/burger.usdz.gz"))
      : await readFile(`public${asset.legacyUrl}`);
    assert.equal(source.length, asset.bytes, asset.id);
    assert.equal(createHash("sha256").update(source).digest("hex"), asset.sha256, asset.id);
    assert.equal(source.subarray(0, 4).toString("hex"), asset.format === "glb" ? "676c5446" : "504b0304");
    for (const id of Object.values(asset.variants ?? {})) assert.ok(getPublicModelAsset(id));
  }
});

test("resolver and legacy redirects use only exact reviewed public references", () => {
  for (const asset of PUBLIC_MODEL_ASSETS) {
    const expected = asset.publicUrl || asset.legacyUrl;
    assert.equal(resolvePublicModelUrl(asset.id), expected);
    assert.equal(resolvePublicModelUrl(asset.legacyUrl), expected);
    assert.equal(getPublicModelAsset(expected)?.id, asset.id);
    if (asset.publicUrl) {
      assert.ok(isPublicModelCdnUrl(asset.publicUrl));
      assert.ok(isSafe3dAssetUrl(asset.publicUrl, [], asset.format === "usdz" ? "iosUsdz" : "web"));
      assert.equal(isSafe3dAssetUrl(asset.publicUrl, [], asset.format === "usdz" ? "web" : "iosUsdz"), false);
      assert.equal(isPublicModelCdnUrl(`${asset.publicUrl}?download=1`), false);
    }
  }
  assert.deepEqual(getPublicModelRedirects(), PUBLIC_MODEL_ASSETS.filter((asset) => asset.publicUrl).map((asset) => ({
    source: asset.legacyUrl,
    destination: asset.publicUrl,
    permanent: false,
  })));
  for (const url of [
    "/api/public/menu-dishes/11111111-1111-4111-8111-111111111111/model/glb?v=abcd",
    "https://private.example/model.glb?token=secret",
    "https://3d.vistaire.ca/restaurants/private/model.glb",
    "https://3d.vistaire.ca/marketing/immersive/unverified/model.glb",
    "/models/demo/homard-bisque.usdz",
    "//other.example/model.glb",
  ]) {
    assert.equal(resolvePublicModelUrl(url), url, "unknown, private and signed routes remain unchanged");
    assert.equal(getPublicModelAsset(url), undefined);
    assert.equal(isPublicModelCdnUrl(url), false);
  }
  assert.equal(isSafe3dAssetUrl("https://3d.vistaire.ca/restaurants/private/model.glb"), false);
});

test("GLTF parser bases follow local and CDN model directories", () => {
  assert.equal(publicModelBaseUrl("/immersive-assets/phone/model.glb"), "/immersive-assets/phone/");
  assert.equal(publicModelBaseUrl("https://3d.vistaire.ca/marketing/v1/my%20model.glb"), "https://3d.vistaire.ca/marketing/v1/");
});

test("framing hulls resolve by immutable source identity without changing geometry", async () => {
  const original = JSON.parse(await readFile("public/immersive-assets/dishes/framing-hulls.json", "utf8"));
  const before = JSON.stringify(original);
  const byId = indexPublicModelFramingHulls(original.byUrl);
  assert.equal(Object.keys(byId).length, 8);
  for (const hull of Object.values(original.byUrl)) {
    const asset = PUBLIC_MODEL_ASSETS.find((candidate) => candidate.sha256 === hull.source.sha256);
    assert.ok(asset);
    assert.equal(byId[asset.id], hull);
    assert.equal(getPublicModelAsset(resolvePublicModelUrl(asset.legacyUrl))?.id, asset.id);
  }
  assert.equal(JSON.stringify(original), before);
  const hull = Object.values(original.byUrl)[0];
  assert.throws(() => indexPublicModelFramingHulls({ bad: { ...hull, source: { ...hull.source, bytes: 1 } } }), /source/i);
});
