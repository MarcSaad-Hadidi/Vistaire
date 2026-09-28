import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022
          }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

const r2Config = await import("../lib/storage/r2Config.ts");

test("r2StorageEnabled is true only with R2_STORAGE_ENABLED=true", () => {
  assert.equal(r2Config.r2StorageEnabled({ R2_STORAGE_ENABLED: "true" }), true);
  assert.equal(r2Config.r2StorageEnabled({}), false);
  assert.equal(r2Config.r2StorageEnabled({ R2_STORAGE_ENABLED: "1" }), false);
  assert.equal(r2Config.r2StorageEnabled({ R2_STORAGE_ENABLED: "false" }), false);
});

test("isR2Bucket only matches the two migrated buckets", () => {
  assert.equal(r2Config.isR2Bucket("vistaire-media"), true);
  assert.equal(r2Config.isR2Bucket("vistaire-3d"), true);
  assert.equal(r2Config.isR2Bucket("vistaire-3d-qa"), false);
  assert.equal(r2Config.isR2Bucket("vistaire-3d-sources"), false);
  assert.equal(r2Config.isR2Bucket(""), false);
});

test("shouldUseR2ForBucket requires both the flag and a migrated bucket", () => {
  const on = { R2_STORAGE_ENABLED: "true" };
  const off = {};
  assert.equal(r2Config.shouldUseR2ForBucket("vistaire-media", on), true);
  assert.equal(r2Config.shouldUseR2ForBucket("vistaire-3d", on), true);
  assert.equal(r2Config.shouldUseR2ForBucket("vistaire-media", off), false);
  assert.equal(r2Config.shouldUseR2ForBucket("vistaire-3d-qa", on), false);
  assert.equal(r2Config.shouldUseR2ForBucket("vistaire-3d-sources", on), false);
});

test("r2PublicAssetUrl uses the default CDN bases and encodes each segment", () => {
  assert.equal(
    r2Config.r2PublicAssetUrl("vistaire-media", "restaurants/abc/photos/dish.webp", {}),
    "https://cdn.vistaire.ca/restaurants/abc/photos/dish.webp"
  );
  assert.equal(
    r2Config.r2PublicAssetUrl("vistaire-3d", "restaurants/abc/models/ar-ios/dish.usdz", {}),
    "https://3d.vistaire.ca/restaurants/abc/models/ar-ios/dish.usdz"
  );
  // Espaces, accents et parenthèses encodés par segment, slashes préservés.
  assert.equal(
    r2Config.r2PublicAssetUrl("vistaire-3d", "restaurants/abc/Crème brûlée (v2)/modèle.usdz", {}),
    "https://3d.vistaire.ca/restaurants/abc/Cr%C3%A8me%20br%C3%BBl%C3%A9e%20(v2)/mod%C3%A8le.usdz"
  );
  assert.equal(r2Config.r2PublicAssetUrl("vistaire-3d-qa", "x/y", {}), null);
});

test("r2PublicAssetUrl honors env overrides and trims trailing slashes", () => {
  const env = {
    R2_PUBLIC_MEDIA_BASE_URL: "https://media.example.test/",
    R2_PUBLIC_3D_BASE_URL: "https://models.example.test//"
  };
  assert.equal(
    r2Config.r2PublicAssetUrl("vistaire-media", "a/b.webp", env),
    "https://media.example.test/a/b.webp"
  );
  assert.equal(
    r2Config.r2PublicAssetUrl("vistaire-3d", "a/b.usdz", env),
    "https://models.example.test/a/b.usdz"
  );
});

test("isExpectedR2PublicAssetUrl only accepts the exact expected URL", () => {
  const bucket = "vistaire-media";
  const storagePath = "restaurants/abc/photos/dish.webp";
  const expected = "https://cdn.vistaire.ca/restaurants/abc/photos/dish.webp";
  assert.equal(
    r2Config.isExpectedR2PublicAssetUrl({ publicUrl: expected, bucket, storagePath, env: {} }),
    true
  );
  assert.equal(
    r2Config.isExpectedR2PublicAssetUrl({
      publicUrl: expected + "?token=forged",
      bucket,
      storagePath,
      env: {}
    }),
    false
  );
  assert.equal(
    r2Config.isExpectedR2PublicAssetUrl({
      publicUrl: "https://cdn.vistaire.ca/restaurants/abc/photos/other.webp",
      bucket,
      storagePath,
      env: {}
    }),
    false
  );
  assert.equal(
    r2Config.isExpectedR2PublicAssetUrl({
      publicUrl: expected,
      bucket: "vistaire-3d",
      storagePath,
      env: {}
    }),
    false
  );
  assert.equal(
    r2Config.isExpectedR2PublicAssetUrl({ publicUrl: "", bucket, storagePath, env: {} }),
    false
  );
});

test("r2PublicObjectExists maps HEAD status to existence", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 200 });
    assert.equal(
      await r2Config.r2PublicObjectExists("vistaire-media", "a/b.webp", {}, 1000),
      true
    );
    globalThis.fetch = async () => new Response(null, { status: 404 });
    assert.equal(
      await r2Config.r2PublicObjectExists("vistaire-media", "a/b.webp", {}, 1000),
      false
    );
    globalThis.fetch = async () => {
      throw new Error("network down");
    };
    assert.equal(
      await r2Config.r2PublicObjectExists("vistaire-media", "a/b.webp", {}, 1000),
      false
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
