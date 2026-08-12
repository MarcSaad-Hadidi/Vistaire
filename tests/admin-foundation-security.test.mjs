import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire, registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

globalThis.AsyncLocalStorage = AsyncLocalStorage;
const require = createRequire(import.meta.url);
const clerkServerUrl = pathToFileURL(require.resolve("@clerk/nextjs/server")).href;

function resolveTypeScriptAlias(specifier) {
  const basePath = resolve(process.cwd(), specifier.slice(2));
  const candidates = [`${basePath}.ts`, `${basePath}.tsx`, resolve(basePath, "index.ts"), resolve(basePath, "index.tsx")];
  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  if (!resolvedPath) throw new Error(`Could not resolve TypeScript alias: ${specifier}`);
  return pathToFileURL(resolvedPath).href;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@clerk/nextjs/server") {
      return nextResolve(clerkServerUrl, context);
    }
    if (specifier.startsWith("@/")) return nextResolve(resolveTypeScriptAlias(specifier), context);
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const canAddExtension = (specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("next/")) && !/\.[a-z]+$/i.test(specifier);
      if (canAddExtension) return nextResolve(`${specifier}.js`, context);
      throw error;
    }
  }
});

const [{ default: proxy }, { NextRequest }] = await Promise.all([
  import("../proxy.ts"),
  import("next/server.js")
]);

test("spoofed admin preference headers are deleted before SSR", async () => {
  const response = await proxy(new NextRequest("https://www.vistaire.ca/admin", {
    headers: { "x-vistaire-admin-locale": "en", "x-vistaire-admin-theme": "dark" }
  }), undefined);
  assert.equal(response.headers.get("x-middleware-request-x-vistaire-admin-locale"), "fr");
  assert.equal(response.headers.get("x-middleware-request-x-vistaire-admin-theme"), "light");
});

test("validated admin cookies become trusted internal headers only on admin paths", async () => {
  const cookie = "vistaire-admin-locale=en; vistaire-admin-theme=dark";
  const admin = await proxy(new NextRequest("https://www.vistaire.ca/admin/insights", { headers: { cookie } }), undefined);
  assert.equal(admin.headers.get("x-middleware-request-x-vistaire-admin-locale"), "en");
  assert.equal(admin.headers.get("x-middleware-request-x-vistaire-admin-theme"), "dark");
  assert.equal(admin.headers.get("x-middleware-request-x-vistaire-locale"), "en");
  const publicPage = await proxy(new NextRequest("https://www.vistaire.ca/en", { headers: { cookie } }), undefined);
  assert.equal(publicPage.headers.get("x-middleware-request-x-vistaire-admin-locale"), null);
  assert.equal(publicPage.headers.get("x-middleware-request-x-vistaire-admin-theme"), null);
});

test("admin preferences are rendered from trusted headers during SSR", async () => {
  const [layout, shell, controls, css] = await Promise.all([
    readFile("app/admin/layout.tsx", "utf8"),
    readFile("components/admin/system/AdminShell.tsx", "utf8"),
    readFile("components/admin/system/AdminPreferencesControls.tsx", "utf8"),
    readFile("components/admin/system/AdminSystem.module.css", "utf8")
  ]);
  assert.match(layout, /await headers\(\)/);
  assert.match(layout, /readAdminPreferencesFromHeaders/);
  assert.match(layout, /data-admin-locale=\{preferences\.locale\}/);
  assert.match(layout, /data-admin-theme=\{preferences\.theme\}/);
  assert.match(layout, /lang=\{preferences\.locale === "fr" \? "fr-CA" : "en-CA"\}/);
  assert.doesNotMatch(`${layout}\n${shell}\n${controls}`, /localStorage|useEffect|cookies\s*\(/);
  assert.match(shell, /await headers\(\)/);
  assert.match(shell, /locale=\{preferences\.locale\}/g);
  assert.match(controls, /action="\/admin\/preferences"/);
  assert.match(controls, /name="kind"/);
  assert.match(controls, /name="value"/);
  assert.match(controls, /aria-pressed/);
  assert.match(css, /\.adminRoot\[data-admin-theme="light"\]/);
  assert.match(css, /\.adminPreferences/);
});
