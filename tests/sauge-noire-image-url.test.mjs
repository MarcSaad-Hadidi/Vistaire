import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx"]) {
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

function source(path) {
  return readFileSync(path, "utf8");
}

const { resolveSaugeNoireImageUrl } = await import(
  "../lib/saugeNoireImageUrl.ts"
);

const publicImageEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS"
];

async function withPublicImageEnv(values, callback) {
  const previous = Object.fromEntries(
    publicImageEnvKeys.map((key) => [key, process.env[key]])
  );
  try {
    for (const key of publicImageEnvKeys) {
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
    return await callback();
  } finally {
    for (const key of publicImageEnvKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const options = {
  baseOrigin: "https://menu.vistaire.test",
  allowedOrigins: ["https://images.vistaire.test"]
};

test("public image origins keep statically analyzable Next.js env references", async () => {
  const helper = await source("lib/saugeNoireImageUrl.ts");
  assert.match(helper, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(helper, /process\.env\.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS/);
  assert.doesNotMatch(helper, /\b(?:const|let|var)\s+env\b/);
  assert.doesNotMatch(helper, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("accepts relative Vistaire paths, photo endpoints, and an allowlisted CDN", () => {
  assert.equal(
    resolveSaugeNoireImageUrl("/images/demo/dishes/plat.webp", options),
    "/images/demo/dishes/plat.webp"
  );
  assert.equal(
    resolveSaugeNoireImageUrl(
      "/api/public/menu-dishes/00000000-0000-4000-8000-000000000001/photo?v=abc",
      options
    ),
    "/api/public/menu-dishes/00000000-0000-4000-8000-000000000001/photo?v=abc"
  );
  assert.equal(
    resolveSaugeNoireImageUrl(
      "https://images.vistaire.test/restaurants/sauge/plat.webp?token=signed",
      options
    ),
    "https://images.vistaire.test/restaurants/sauge/plat.webp?token=signed"
  );
  assert.equal(
    resolveSaugeNoireImageUrl(
      "https://menu.vistaire.test/api/public/menu-dishes/00000000-0000-4000-8000-000000000001/photo",
      options
    ),
    "https://menu.vistaire.test/api/public/menu-dishes/00000000-0000-4000-8000-000000000001/photo"
  );
});

test("rejects active protocols, credentials, controls, and untrusted origins", () => {
  for (const value of [
    null,
    undefined,
    "",
    "not a URL",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/onload=alert(1)>",
    "vbscript:msgbox(1)",
    "https://user:password@images.vistaire.test/photo.webp",
    "https://@images.vistaire.test/photo.webp",
    "https://evil.example/photo.webp",
    "http://menu.vistaire.test/images/demo/dishes/plat.webp",
    "//evil.example/photo.webp",
    " /images/demo/dishes/plat.webp ",
    "https://images.vistaire.test/photo webp",
    "/images/%00photo.webp",
    "/images/\u0000photo.webp",
    "/images\\photo.webp"
  ]) {
    assert.equal(resolveSaugeNoireImageUrl(value, options), null, value);
  }
});

test("accepts explicitly configured Supabase and comma-separated CDN origins", async () => {
  await withPublicImageEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://storage.supabase.test",
      NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS:
        "https://cdn-one.vistaire.test, https://cdn-two.vistaire.test"
    },
    () => {
      assert.equal(
        resolveSaugeNoireImageUrl(
          "https://storage.supabase.test/object/sign/menu/photo.webp?token=signed",
          options
        ),
        "https://storage.supabase.test/object/sign/menu/photo.webp?token=signed"
      );
      assert.equal(
        resolveSaugeNoireImageUrl(
          "https://cdn-one.vistaire.test/menu/photo.webp",
          options
        ),
        "https://cdn-one.vistaire.test/menu/photo.webp"
      );
      assert.equal(
        resolveSaugeNoireImageUrl(
          "https://cdn-two.vistaire.test/menu/photo.webp",
          options
        ),
        "https://cdn-two.vistaire.test/menu/photo.webp"
      );
      assert.equal(
        resolveSaugeNoireImageUrl(
          "https://cdn-one.vistaire.test.evil.example/menu/photo.webp",
          options
        ),
        null
      );
      assert.equal(
        resolveSaugeNoireImageUrl(
          "https://sub.cdn-one.vistaire.test/menu/photo.webp",
          options
        ),
        null
      );
      assert.equal(
        resolveSaugeNoireImageUrl(
          "http://cdn-one.vistaire.test/menu/photo.webp",
          options
        ),
        null
      );
      assert.equal(
        resolveSaugeNoireImageUrl(
          "https://user:password@cdn-one.vistaire.test/menu/photo.webp",
          options
        ),
        null
      );
      assert.equal(
        resolveSaugeNoireImageUrl(
          "https://cdn-one.vistaire.test:8443/menu/photo.webp",
          options
        ),
        null
      );
    }
  );
});

test("accepts a configured port only as an exact origin", async () => {
  await withPublicImageEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS: "https://cdn-one.vistaire.test:8443"
    },
    () => {
      assert.equal(
        resolveSaugeNoireImageUrl(
          "https://cdn-one.vistaire.test:8443/menu/photo.webp",
          options
        ),
        "https://cdn-one.vistaire.test:8443/menu/photo.webp"
      );
      assert.equal(
        resolveSaugeNoireImageUrl(
          "https://cdn-one.vistaire.test/menu/photo.webp",
          options
        ),
        null
      );
    }
  );
});

test("allows a Supabase signed origin only when it is explicitly configured", () => {
  assert.equal(
    resolveSaugeNoireImageUrl(
      "https://storage.supabase.test/object/sign/menu/photo.webp?token=signed",
      { ...options, allowedOrigins: ["https://storage.supabase.test"] }
    ),
    "https://storage.supabase.test/object/sign/menu/photo.webp?token=signed"
  );
  assert.equal(
    resolveSaugeNoireImageUrl(
      "https://storage.supabase.test/object/sign/menu/photo.webp?token=signed",
      options
    ),
    null
  );
});
