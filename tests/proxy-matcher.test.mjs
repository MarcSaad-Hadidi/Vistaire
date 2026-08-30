import test from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

globalThis.AsyncLocalStorage = AsyncLocalStorage;

const DEV_BYPASS_TOKEN = "0123456789abcdef";
process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS = "1";
process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN = DEV_BYPASS_TOKEN;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

const clerkRouteMatcherUrl = pathToFileURL(
  resolve(
    process.cwd(),
    "node_modules/@clerk/nextjs/dist/cjs/server/routeMatcher.js"
  )
).href;
const clerkTestModule = `data:text/javascript,${encodeURIComponent(`
  import routeMatcherModule from ${JSON.stringify(clerkRouteMatcherUrl)};
  export const createRouteMatcher = routeMatcherModule.createRouteMatcher;
  export function clerkMiddleware(handler) {
    return async (request, event) => {
      const auth = Object.assign(async () => ({ userId: "test-user" }), {
        protect: async () => undefined
      });
      return handler(auth, request, event);
    };
  }
`)}`;
const supabaseTestModule = `data:text/javascript,${encodeURIComponent(`
  export function createServerClient(_url, _key, options) {
    return {
      auth: {
        async getUser() {
          options.cookies.setAll([
            {
              name: "sb-test-auth-token",
              value: "refreshed-session",
              options: { httpOnly: true, path: "/", sameSite: "lax" }
            }
          ]);
          return { data: { user: null }, error: null };
        }
      }
    };
  }
`)}`;

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
      return { url: clerkTestModule, shortCircuit: true };
    }

    if (specifier === "@supabase/ssr") {
      return { url: supabaseTestModule, shortCircuit: true };
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
  { DEV_OWNER_BYPASS_REQUEST_HEADER, DEV_OWNER_BYPASS_TRUSTED_HEADER },
  { ADMIN_LOCALE_HEADER, ADMIN_THEME_HEADER },
  { unstable_doesMiddlewareMatch },
  { NextRequest }
] = await Promise.all([
  import("../proxy.ts"),
  import("../lib/auth/devOwnerBypass.ts"),
  import("../lib/admin/preferences.ts"),
  import("next/experimental/testing/server.js"),
  import("next/server.js")
]);

// Next 16.2.11 still exposes the proxy matcher helper under its former name.
const doesProxyMatch = unstable_doesMiddlewareMatch;
const absoluteUrl = (pathname, origin = "https://www.vistaire.ca") =>
  new URL(pathname, origin);

function assertProxyMatch(pathname, expected, accept) {
  assert.equal(
    doesProxyMatch({
      config,
      url: absoluteUrl(pathname).href,
      ...(accept ? { headers: { accept } } : {})
    }),
    expected,
    `${pathname} with Accept ${accept ?? "<none>"}`
  );
}

function requestOverrideHeaders(response) {
  const names = (response.headers.get("x-middleware-override-headers") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return new Headers(
    names.map((name) => [
      name,
      response.headers.get(`x-middleware-request-${name}`) ?? ""
    ])
  );
}

test("proxy matcher includes Markdown root negotiation, protected surfaces and private Admin preferences", () => {
  for (const accept of ["text/markdown", "Text/Markdown", "text/markdown;q=0"]) {
    assertProxyMatch("/", true, accept);
  }

  for (const pathname of [
    "/owner",
    "/owner/restaurants",
    "/todos",
    "/todos/42",
    "/api/restaurants",
    "/api/restaurants/42",
    "/api/owner",
    "/api/owner/x",
    "/api/analytics/summary",
    "/admin",
    "/admin/insights"
  ]) {
    assertProxyMatch(pathname, true);
  }
});

test("proxy matcher excludes ordinary HTML, public routes, and non-approved APIs", () => {
  assertProxyMatch("/", false);
  assertProxyMatch("/", false, "*/*");
  assertProxyMatch("/", false, "text/html");

  for (const pathname of [
    "/a-propos",
    "/en/about",
    "/menu/maison-elyse",
    "/sign-in",
    "/q/example",
    "/.well-known/api-catalog",
    "/.well-known/agent-skills/index.json",
    "/auth.md",
    "/openapi.json",
    "/images/demo/hero.webp",
    "/models/demo/dish.glb",
    "/api/public/other",
    "/api/exchange-rates",
    "/api/analytics/summary/extra",
    "/trpc/x"
  ]) {
    assertProxyMatch(pathname, false);
  }
});

test("Admin request overrides reject spoofed preferences and derive trusted values from scoped cookies", async () => {
  const response = await proxy(
    new NextRequest(absoluteUrl("/admin/insights"), {
      headers: {
        cookie: "vistaire-admin-locale=en; vistaire-admin-theme=dark",
        [ADMIN_LOCALE_HEADER]: "fr",
        [ADMIN_THEME_HEADER]: "light",
        [DEV_OWNER_BYPASS_TRUSTED_HEADER]: "spoofed"
      }
    }),
    undefined
  );
  const overrides = requestOverrideHeaders(response);

  assert.equal(overrides.get(ADMIN_LOCALE_HEADER), "en");
  assert.equal(overrides.get(ADMIN_THEME_HEADER), "dark");
  assert.equal(overrides.get(DEV_OWNER_BYPASS_TRUSTED_HEADER), null);
});

test("proxy representation selection honors q-values and safe methods", async () => {
  const cases = [
    ["text/markdown", "GET", "markdown"],
    ["text/markdown;q=0", "GET", "next"],
    ["text/html, text/markdown;q=0.8", "GET", "next"],
    ["text/markdown;q=0.9, text/html;q=0.1", "GET", "markdown"],
    ["text/markdown", "HEAD", "markdown-head"],
    ["text/markdown", "POST", "next"]
  ];

  for (const [accept, method, expected] of cases) {
    const response = await proxy(
      new NextRequest(absoluteUrl("/"), { method, headers: { accept } }),
      undefined
    );
    const body = await response.text();

    if (expected.startsWith("markdown")) {
      assert.match(response.headers.get("content-type") ?? "", /^text\/markdown/);
      assert.equal(response.headers.get("vary"), "Accept");
      assert.match(response.headers.get("link") ?? "", /api-catalog/);
      assert.equal(response.headers.get("x-middleware-next"), null);
      assert.equal(body.length > 0, expected === "markdown");
    } else {
      assert.equal(response.headers.get("x-middleware-next"), "1");
      assert.equal(response.headers.get("content-type"), null);
      assert.equal(body, "");
    }
  }
});

test("protected request overrides remove untrusted bypass input", async () => {
  for (const pathname of [
    "/owner",
    "/todos",
    "/api/owner/x",
    "/api/analytics/summary"
  ]) {
    const response = await proxy(
      new NextRequest(absoluteUrl(pathname), {
        headers: {
          [DEV_OWNER_BYPASS_TRUSTED_HEADER]: "1",
          "x-client-marker": pathname
        }
      }),
      undefined
    );
    const overrides = requestOverrideHeaders(response);

    assert.equal(
      overrides.get(DEV_OWNER_BYPASS_TRUSTED_HEADER),
      null,
      `${pathname} must remove client-provided trust`
    );
    assert.equal(overrides.get("x-client-marker"), pathname);

    if (pathname === "/todos") {
      assert.match(
        overrides.get("cookie") ?? "",
        /sb-test-auth-token=refreshed-session/
      );
      assert.match(
        response.headers.get("set-cookie") ?? "",
        /sb-test-auth-token=refreshed-session/
      );
    }
  }
});

test("verified local bypass recreates trust only for approved Owner routes", async () => {
  for (const pathname of ["/owner", "/api/owner/x", "/api/restaurants/42"]) {
    const response = await proxy(
      new NextRequest(absoluteUrl(pathname, "http://localhost:3000"), {
        headers: {
          host: "localhost:3000",
          [DEV_OWNER_BYPASS_REQUEST_HEADER]: DEV_BYPASS_TOKEN,
          [DEV_OWNER_BYPASS_TRUSTED_HEADER]: "spoofed"
        }
      }),
      undefined
    );

    assert.equal(
      requestOverrideHeaders(response).get(DEV_OWNER_BYPASS_TRUSTED_HEADER),
      "1",
      pathname
    );
  }

  for (const pathname of ["/todos", "/api/analytics/summary"]) {
    const response = await proxy(
      new NextRequest(absoluteUrl(pathname, "http://localhost:3000"), {
        headers: {
          host: "localhost:3000",
          [DEV_OWNER_BYPASS_REQUEST_HEADER]: DEV_BYPASS_TOKEN,
          [DEV_OWNER_BYPASS_TRUSTED_HEADER]: "spoofed"
        }
      }),
      undefined
    );

    assert.equal(
      requestOverrideHeaders(response).get(DEV_OWNER_BYPASS_TRUSTED_HEADER),
      null,
      pathname
    );
  }
});
