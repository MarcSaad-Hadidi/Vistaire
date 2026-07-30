import test from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

globalThis.AsyncLocalStorage = AsyncLocalStorage;

function resolveTypeScriptAlias(specifier) {
  const basePath = resolve(process.cwd(), specifier.slice(2));
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    resolve(basePath, "index.ts"),
    resolve(basePath, "index.tsx")
  ];
  const resolvedPath = candidates.find((candidate) => existsSync(candidate));

  if (!resolvedPath) {
    throw new Error(`Could not resolve TypeScript alias: ${specifier}`);
  }

  return pathToFileURL(resolvedPath).href;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@clerk/nextjs/server") {
      return nextResolve(
        pathToFileURL(
          resolve(
            process.cwd(),
            "node_modules/@clerk/nextjs/dist/cjs/server/index.js"
          )
        ).href,
        context
      );
    }

    if (specifier.startsWith("@/")) {
      return nextResolve(resolveTypeScriptAlias(specifier), context);
    }

    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const needsJavaScriptExtension =
        (specifier.startsWith("./") ||
          specifier.startsWith("../") ||
          specifier.startsWith("next/")) &&
        !/\.[a-z]+$/i.test(specifier);

      if (needsJavaScriptExtension) {
        return nextResolve(`${specifier}.js`, context);
      }

      throw error;
    }
  }
});

const [
  { config, default: proxy },
  { unstable_doesMiddlewareMatch },
  { NextRequest }
] = await Promise.all([
  import("../proxy.ts"),
  import("next/experimental/testing/server.js"),
  import("next/server.js")
]);

// Next 16.2.11 still exposes the proxy matcher helper under its former name.
const doesProxyMatch = unstable_doesMiddlewareMatch;
const absoluteUrl = (pathname) => new URL(pathname, "https://www.vistaire.ca");

test("proxy matcher excludes only exact public dish media delivery routes", () => {
  const uuid = "ae55441d-8f35-4f9c-b8e7-c24758c739de";
  const excludedUrls = [
    "/api/public/menu-dishes/abc/photo",
    "/api/public/menu-dishes/abc/photo/",
    `/api/public/menu-dishes/${uuid}/photo?v=photo-12`,
    "/api/public/menu-dishes/abc/model/glb",
    "/api/public/menu-dishes/abc/model/glb/",
    "/api/public/menu-dishes/abc/model/glb?variant=ar-lite",
    `/api/public/menu-dishes/${uuid}/model/usdz`,
    `/api/public/menu-dishes/${uuid}/model/usdz/?v=ios-7`
  ];

  for (const url of excludedUrls) {
    assert.equal(
      doesProxyMatch({
        config,
        url: absoluteUrl(url).href
      }),
      false,
      `${url} must bypass the proxy`
    );
  }
});

test("proxy matcher preserves protected, API, trpc, discovery, and invalid media subpaths", () => {
  const matchedUrls = [
    "/owner",
    "/owner/restaurants",
    "/todos",
    "/api/restaurants",
    "/api/owner/x",
    "/api/analytics/summary",
    "/api/public/other",
    "/api/public/other.glb",
    "/api/public/menu-dishes/abc",
    "/api/public/menu-dishes/abc/photo/extra",
    "/api/public/menu-dishes/abc/model/glb/extra",
    "/trpc/x",
    "/",
    "/.well-known/api-catalog",
    "/.well-known/agent-skills/index.json",
    "/auth.md",
    "/openapi.json"
  ];

  for (const url of matchedUrls) {
    assert.equal(
      doesProxyMatch({
        config,
        url: absoluteUrl(url).href
      }),
      true,
      `${url} must keep matching the proxy`
    );
  }
});

test("ordinary proxy responses preserve locale, theme, and homepage discovery headers", async () => {
  const englishResponse = await proxy(
    new NextRequest(absoluteUrl("/en/demo")),
    undefined
  );
  assert.equal(
    englishResponse.headers.get("x-middleware-request-x-vistaire-locale"),
    "en"
  );

  const themedResponse = await proxy(
    new NextRequest(absoluteUrl("/menu/sauge-noire")),
    undefined
  );
  assert.equal(
    themedResponse.headers.get("x-middleware-request-x-vistaire-route-theme"),
    "sauge-noire"
  );

  const homepageResponse = await proxy(
    new NextRequest(absoluteUrl("/"), {
      headers: { accept: "text/html" }
    }),
    undefined
  );
  assert.match(homepageResponse.headers.get("link") ?? "", /api-catalog/);
  assert.match(homepageResponse.headers.get("vary") ?? "", /Accept/);

  const markdownResponse = await proxy(
    new NextRequest(absoluteUrl("/"), {
      headers: { accept: "text/markdown" }
    }),
    undefined
  );
  assert.match(
    markdownResponse.headers.get("content-type") ?? "",
    /^text\/markdown/
  );
});
