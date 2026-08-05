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

const { resolveSaugeNoireImageUrl } = await import(
  "../lib/saugeNoireImageUrl.ts"
);

const options = {
  baseOrigin: "https://menu.vistaire.test",
  allowedOrigins: ["https://images.vistaire.test"]
};

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
