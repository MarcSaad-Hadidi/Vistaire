import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const entrypoints = [
  "app/(fr)/apercu-restaurateur/page.tsx",
  "app/(en)/en/restaurant-preview/page.tsx"
];
const codeExtensions = ["", ".ts", ".tsx", ".mjs", ".js"];
const indexExtensions = ["/index.ts", "/index.tsx", "/index.mjs", "/index.js"];

const forbiddenPackages = [
  /^server-only$/,
  /^next\/headers$/,
  /^@clerk\//,
  /^@supabase\//,
  /^@google\/model-viewer(?:\/|$)/,
  /^three(?:\/|$)/,
  /^@babylonjs\//
];

const forbiddenLocalModules = [
  /^app\/admin(?:\/|$)/,
  /^app\/owner(?:\/|$)/,
  /^app\/api(?:\/|$)/,
  /^lib\/admin(?:\/|$)/,
  /^lib\/owner(?:\/|$)/,
  /^lib\/analytics\/serverRows(?:\.|$)/
];

const allowedAdminComponentModules = new Set([
  "components/admin/system/AdminIcons",
  "components/admin/system/AdminPresentationPrimitives",
  "components/admin/system/AdminSystem.module.css",
  "components/admin/charts/CartesianAxes",
  "components/admin/charts/ChartFrame",
  "components/admin/charts/Charts.module.css",
  "components/admin/charts/ComparisonLineChart",
  "components/admin/charts/InteractiveBars",
  "components/admin/charts/InteractiveDonut",
  "components/admin/charts/InteractiveHeatmap",
  "components/admin/charts/InteractiveLineChart",
  "components/admin/charts/Sparkline",
  "components/admin/charts/data",
  "components/admin/charts/formatters",
  "components/admin/charts/geometry",
  "components/admin/charts/index",
  "components/admin/charts/interaction",
  "components/admin/charts/types",
  "components/admin/charts/useChartInteraction"
]);

const forbiddenSource = [
  ["private admin access", /\brequireAdminRestaurantAccess\b/],
  ["private dashboard loader", /\bloadAdminDashboardData(?:WithDependencies)?\b/],
  ["private Supabase reader", /\breadSupabaseRowsByFilters\b/],
  ["private analytics reader", /\breadAnalyticsEventsForPeriod\b/],
  ["network fetch", /\bfetch\s*\(/],
  ["router navigation", /\buseRouter\b|\brouter\.refresh\s*\(/],
  ["browser persistence", /\b(?:localStorage|sessionStorage)\b/],
  ["document cookies", /\b(?:(?:(?:window|globalThis)\s*(?:(?:\?\.|\.)\s*document|\[\s*["']document["']\s*\]))|document)\s*(?:(?:\?\.|\.)\s*cookie|\[\s*["']cookie["']\s*\])/],
  ["Cookie Store", /\b(?:(?:window|globalThis)\s*\.\s*)?cookieStore\b/],
  ["IndexedDB", /\b(?:(?:window|globalThis)\s*\.\s*)?indexedDB\b/],
  ["Cache Storage", /\bCacheStorage\b|\b(?:window|globalThis)\s*(?:(?:\?\.|\.)\s*caches|\[\s*["']caches["']\s*\])|\bcaches\s*(?:\?\.|\.)\s*(?:delete|has|keys|match|open)\s*\(/],
  ["storage manager", /\b(?:(?:window|globalThis)\s*(?:(?:\?\.|\.)\s*navigator|\[\s*["']navigator["']\s*\])|navigator)\s*(?:(?:\?\.|\.)\s*storage|\[\s*["']storage["']\s*\])/],
  ["request cookies or headers", /\b(?:cookies|headers)\s*\(/],
  ["private rendered destination", /\b(?:href|action|formAction)\s*[:=]\s*(?:\{\s*)?["'`]\/(?:admin|owner)(?:\/|["'`])/]
];

function normalized(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function canonicalModulePath(file) {
  return file.replaceAll("\\", "/").replace(/\.(?:[cm]?[jt]sx?)$/, "");
}

function isForbiddenLocalModule(file) {
  const modulePath = canonicalModulePath(file);
  if (/^components\/admin(?:\/|$)/.test(modulePath)) {
    return !allowedAdminComponentModules.has(modulePath);
  }
  return forbiddenLocalModules.some((pattern) => pattern.test(modulePath));
}

function localSpecifierPath(specifier, importer) {
  const absolute = specifier.startsWith("@/")
    ? path.resolve(root, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(importer), specifier)
      : null;
  return absolute ? normalized(absolute) : null;
}

function resolveLocal(specifier, importer) {
  const base = specifier.startsWith("@/")
    ? path.resolve(root, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(importer), specifier)
      : null;
  if (!base) return null;
  for (const suffix of [...codeExtensions, ...indexExtensions]) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate) && /\.(?:[cm]?[jt]sx?)$/.test(candidate)) return candidate;
  }
  return null;
}

function importsFrom(source, file) {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const imports = [];
  const nonliteralDynamicImports = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
        imports.push(node.arguments[0].text);
      } else {
        nonliteralDynamicImports.push(`${normalized(file)}:${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
        imports.push(node.arguments[0].text);
      } else {
        nonliteralDynamicImports.push(`${normalized(file)}:${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { imports, nonliteralDynamicImports };
}

function publicPreviewGraph() {
  const pending = entrypoints.map((entry) => path.resolve(root, entry));
  const visited = new Map();
  const violations = [];
  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    const source = readFileSync(file, "utf8");
    visited.set(file, source);
    const parsed = importsFrom(source, file);
    violations.push(...parsed.nonliteralDynamicImports.map((location) => `${location} nonliteral dynamic import`));
    for (const specifier of parsed.imports) {
      if (forbiddenPackages.some((pattern) => pattern.test(specifier))) {
        violations.push(`${normalized(file)} imports forbidden package ${specifier}`);
      }
      const resolved = resolveLocal(specifier, file);
      const localPath = resolved ? normalized(resolved) : localSpecifierPath(specifier, file);
      if (localPath && isForbiddenLocalModule(localPath)) {
        violations.push(`${normalized(file)} imports forbidden module ${localPath}`);
      }
      if (!resolved) continue;
      pending.push(resolved);
    }
  }
  return { visited, violations };
}

function assertPrivateModulePolicy() {
  const source = `
    import type { AdminDashboardData } from "@/lib/admin/dashboardTypes";
    export type { OwnerMutation } from "@/app/api/owner/restaurants/route";
    export { privateLoader } from "@/app/api/private-preview/route";
    import type { AdminDishWorklistProps } from "@/components/admin/AdminDishWorklist";
    export { AdminInsightCard } from "@/components/admin/AdminInsightCard";
    import { AdminPanel } from "@/components/admin/system/AdminPrimitives";
    import { AdminKpiCard } from "@/components/admin/system/AdminPresentationPrimitives";
    export type { ChartDatum } from "@/components/admin/charts/types";
  `;
  const parsed = importsFrom(source, path.join(root, "components", "preview-policy-probe.ts"));
  const relativeModules = parsed.imports.map((specifier) => specifier.replace(/^@\//, ""));

  assert.deepEqual(relativeModules, [
    "lib/admin/dashboardTypes",
    "app/api/owner/restaurants/route",
    "app/api/private-preview/route",
    "components/admin/AdminDishWorklist",
    "components/admin/AdminInsightCard",
    "components/admin/system/AdminPrimitives",
    "components/admin/system/AdminPresentationPrimitives",
    "components/admin/charts/types"
  ]);
  assert.deepEqual(
    relativeModules.map(isForbiddenLocalModule),
    [true, true, true, true, true, true, false, false]
  );
}

function assertBrowserStatePolicy() {
  for (const source of [
    "document.cookie = 'preview=1'",
    "window.document.cookie",
    "document['cookie']",
    "globalThis.document?.cookie",
    "indexedDB.open('preview')",
    "window.indexedDB.deleteDatabase('preview')",
    "caches.open('preview')",
    "window.caches.match('/preview')",
    "globalThis.caches.keys()",
    "globalThis['caches']",
    "cookieStore.get('preview')",
    "navigator.storage.persist()",
    "window.navigator.storage.persist()",
    "globalThis.navigator.storage.persist()",
    "navigator['storage'].persist()",
    "localStorage.setItem('preview', '1')",
    "sessionStorage.getItem('preview')"
  ]) {
    assert.equal(
      forbiddenSource.some(([, pattern]) => pattern.test(source)),
      true,
      source
    );
  }
}

test("the public preview import graph cannot reach private capabilities or browser persistence", () => {
  assertPrivateModulePolicy();
  assertBrowserStatePolicy();
  const graph = publicPreviewGraph();
  for (const [file, source] of graph.visited) {
    for (const [label, pattern] of forbiddenSource) {
      if (pattern.test(source)) graph.violations.push(`${normalized(file)} contains ${label}`);
    }
  }
  assert.deepEqual(graph.violations, []);
});

test("request policy distinguishes Next internals from private product mutations without retaining secrets", async () => {
  const policyPath = new URL(
    "../e2e/support/restaurateur-preview-request-policy.mjs",
    import.meta.url
  );
  assert.equal(existsSync(policyPath), true, "Prompt 7 request policy must exist");
  const {
    classifyRestaurateurPreviewRequest,
    shouldIgnoreRestaurateurPreviewRequestFailure
  } = await import(policyPath.href);
  const base = "http://127.0.0.1:3000";

  const nextPost = classifyRestaurateurPreviewRequest({
    baseOrigin: base,
    url: `${base}/apercu-restaurateur`,
    method: "POST",
    headers: { "next-action": "opaque-action-id", cookie: "private-cookie" }
  });
  assert.deepEqual(nextPost, {
    pathname: "/apercu-restaurateur",
    frameworkInternal: true,
    privateEndpoint: false,
    productMutation: false,
    unexpectedWrite: true,
    modelAsset: false,
    videoAsset: false
  });
  assert.doesNotMatch(JSON.stringify(nextPost), /opaque-action-id|private-cookie/);

  const privatePatch = classifyRestaurateurPreviewRequest({
    baseOrigin: base,
    url: `${base}/admin/api/dishes/dish-secret/availability`,
    method: "PATCH",
    headers: { authorization: "Bearer private" }
  });
  assert.equal(privatePatch.privateEndpoint, true);
  assert.equal(privatePatch.productMutation, true);
  assert.equal(privatePatch.unexpectedWrite, true);
  assert.doesNotMatch(JSON.stringify(privatePatch), /dish-secret|Bearer private/);

  const ownerRead = classifyRestaurateurPreviewRequest({
    baseOrigin: base,
    url: `${base}/api/owner/restaurants?token=secret`,
    method: "GET"
  });
  assert.equal(ownerRead.privateEndpoint, true);
  assert.equal(ownerRead.productMutation, false);

  const supabaseRead = classifyRestaurateurPreviewRequest({
    baseOrigin: base,
    url: "https://project.supabase.co/rest/v1/menu_dishes?select=*",
    method: "GET",
    headers: { apikey: "private-key" }
  });
  assert.equal(supabaseRead.privateEndpoint, true);
  assert.equal(supabaseRead.productMutation, false);
  assert.doesNotMatch(JSON.stringify(supabaseRead), /private-key|menu_dishes/);

  const analyticsWrite = classifyRestaurateurPreviewRequest({
    baseOrigin: base,
    url: `${base}/api/analytics/events`,
    method: "POST"
  });
  assert.equal(analyticsWrite.productMutation, true);

  const model = classifyRestaurateurPreviewRequest({
    baseOrigin: base,
    url: `${base}/models/demo.glb?v=secret`,
    method: "GET"
  });
  assert.equal(model.modelAsset, true);
  assert.doesNotMatch(JSON.stringify(model), /secret/);

  for (const url of [
    `${base}/_next/image?url=%2Fimages%2Fdishes%2Fdemo.webp&w=640&q=75`,
    `${base}/_next/static/chunks/app-demo.js`
  ]) {
    assert.equal(
      shouldIgnoreRestaurateurPreviewRequestFailure({
        baseOrigin: base,
        url,
        errorText: "net::ERR_ABORTED"
      }),
      true,
      `an intentional same-origin Next resource cancellation should be ignored: ${url}`
    );
  }

  for (const input of [
    {
      baseOrigin: base,
      url: `${base}/images/dishes/demo.webp`,
      errorText: "net::ERR_ABORTED"
    },
    {
      baseOrigin: base,
      url: `${base}/admin/api/menu-dishes/secret/photo`,
      errorText: "net::ERR_ABORTED"
    },
    {
      baseOrigin: base,
      url: "https://cdn.example.com/_next/static/chunks/app-demo.js",
      errorText: "net::ERR_ABORTED"
    },
    {
      baseOrigin: base,
      url: `${base}/_next/static/chunks/app-demo.js`,
      errorText: "net::ERR_FAILED"
    }
  ]) {
    assert.equal(
      shouldIgnoreRestaurateurPreviewRequestFailure(input),
      false,
      `the request failure must remain visible: ${input.url}`
    );
  }
});

test("request policy catches and redacts every owner and admin namespace", async () => {
  const policyPath = new URL(
    "../e2e/support/restaurateur-preview-request-policy.mjs",
    import.meta.url
  );
  const { classifyRestaurateurPreviewRequest } = await import(policyPath.href);
  const base = "http://127.0.0.1:3000";
  const cases = [
    ["/admin/restaurants/secret-admin", "/admin/[redacted]"],
    ["/owner/restaurants/secret-owner", "/owner/[redacted]"],
    ["/api/admin/assistant/secret-api-admin", "/api/admin/[redacted]"],
    ["/api/owner/restaurants/secret-api-owner", "/api/owner/[redacted]"]
  ];

  for (const [pathname, redactedPathname] of cases) {
    const result = classifyRestaurateurPreviewRequest({
      baseOrigin: base,
      url: `${base}${pathname}?token=secret-query`,
      method: "GET"
    });
    assert.equal(result.privateEndpoint, true, pathname);
    assert.equal(result.productMutation, false, pathname);
    assert.equal(result.pathname, redactedPathname, pathname);
    assert.doesNotMatch(JSON.stringify(result), /secret|token/i, pathname);
  }
});

test("request policy source never captures bodies or raw credential headers", async () => {
  const source = await readFile(
    new URL("../e2e/support/restaurateur-preview-request-policy.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /postData|request\.body|headers\s*:/);
  assert.doesNotMatch(source, /authorization\][^)]|cookie\][^)]|apikey\][^)]/i);
});
