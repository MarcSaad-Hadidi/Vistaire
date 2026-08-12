import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

globalThis.AsyncLocalStorage = AsyncLocalStorage;

function resolveTypeScriptAlias(specifier) {
  const basePath = resolve(process.cwd(), specifier.slice(2));
  const candidates = [`${basePath}.ts`, `${basePath}.tsx`, resolve(basePath, "index.ts"), resolve(basePath, "index.tsx")];
  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  if (!resolvedPath) throw new Error(`Could not resolve TypeScript alias: ${specifier}`);
  return pathToFileURL(resolvedPath).href;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
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

const preferences = await import("../lib/admin/preferences.ts");
const { POST } = await import("../app/admin/preferences/route.ts");
const { NextRequest } = await import("next/server.js");

test("admin preferences accept only closed locale and theme unions", () => {
  assert.equal(preferences.parseAdminLocale("fr"), "fr");
  assert.equal(preferences.parseAdminLocale("en"), "en");
  assert.equal(preferences.parseAdminLocale("EN"), null);
  assert.equal(preferences.parseAdminTheme("dark"), "dark");
  assert.equal(preferences.parseAdminTheme("light"), "light");
  assert.equal(preferences.parseAdminTheme("sepia"), null);
  assert.equal(preferences.parseAdminTheme("system"), null);
  assert.deepEqual(preferences.resolveAdminPreferences("attacker", "attacker"), { locale: "fr", theme: "light" });
});

test("return targets stay on the same admin origin", () => {
  assert.equal(preferences.sanitizeAdminReturnTo("https://www.vistaire.ca/admin/insights?range=30d", "https://www.vistaire.ca"), "/admin/insights?range=30d");
  assert.equal(preferences.sanitizeAdminReturnTo("https://evil.example/admin", "https://www.vistaire.ca"), "/admin");
  assert.equal(preferences.sanitizeAdminReturnTo("//evil.example/admin", "https://www.vistaire.ca"), "/admin");
  assert.equal(preferences.sanitizeAdminReturnTo("/owner", "https://www.vistaire.ca"), "/admin");
});

function preferenceRequest(body, headers = {}) {
  return new NextRequest("https://www.vistaire.ca/admin/preferences", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://www.vistaire.ca",
      referer: "https://www.vistaire.ca/admin/insights?range=30d",
      "sec-fetch-site": "same-origin",
      ...headers
    }
  });
}

test("admin preference endpoint writes one scoped hardened cookie", async () => {
  const response = await POST(preferenceRequest("kind=locale&value=en"));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://www.vistaire.ca/admin/insights?range=30d");
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^vistaire-admin-locale=en;/);
  assert.match(cookie, /Path=\/admin/i);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Max-Age=31536000/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("admin preference endpoint preserves a validated loopback origin in development", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const request = new NextRequest("http://localhost:3015/admin/preferences", {
      method: "POST",
      body: "kind=locale&value=en",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        host: "127.0.0.1:3015",
        origin: "http://127.0.0.1:3015",
        referer: "http://127.0.0.1:3015/admin/insights?range=30d",
        "sec-fetch-site": "same-origin"
      }
    });
    const response = await POST(request);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "http://127.0.0.1:3015/admin/insights?range=30d");
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("admin preference endpoint fails closed before form parsing", async () => {
  const cases = [
    preferenceRequest("kind=locale&value=EN"),
    preferenceRequest("kind=locale&value=en", { origin: "" }),
    preferenceRequest("kind=locale&value=en", { origin: "https://evil.example" }),
    preferenceRequest("kind=locale&value=en", { "sec-fetch-site": "cross-site" }),
    preferenceRequest("kind=locale&value=en", { "content-type": "application/json" }),
    preferenceRequest("kind=locale&value=en", { "content-length": "1025" })
  ];
  for (const request of cases) {
    const response = await POST(request);
    assert.notEqual(response.status, 303);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
