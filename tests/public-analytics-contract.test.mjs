import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL(
  "../components/analytics/MicrosoftClarity.tsx",
  import.meta.url
);
const clientComponentPath = new URL(
  "../components/analytics/MicrosoftClarityScript.tsx",
  import.meta.url
);
const instrumentationClientPath = new URL(
  "../instrumentation-client.ts",
  import.meta.url
);
const layoutPath = new URL(
  "../components/layout/VistaireDocumentShell.tsx",
  import.meta.url
);
const packagePath = new URL("../package.json", import.meta.url);
const lockfilePath = new URL("../package-lock.json", import.meta.url);

async function readSource(path) {
  return readFile(path, "utf8").catch(() => "");
}

test("Microsoft Clarity uses the expected project and non-blocking Next.js script", async () => {
  const [component, clientComponent] = await Promise.all([
    readSource(componentPath),
    readSource(clientComponentPath)
  ]);

  assert.match(clientComponent, /import Script from ["']next\/script["']/);
  assert.match(component, /CLARITY_PROJECT_ID\s*=\s*["']y0gra96318["']/);
  assert.match(clientComponent, /id=["']microsoft-clarity["']/);
  assert.match(clientComponent, /strategy=["']afterInteractive["']/);
  assert.match(clientComponent, /https:\/\/www\.clarity\.ms\/tag\//);
  assert.match(
    clientComponent,
    /if\s*\(!window\.__vistaireClarityBlocked\)\s*\{\s*\(function/
  );
  assert.doesNotMatch(clientComponent, /beforeInteractive/);
});

test("Microsoft Clarity is enabled only for Vercel production", async () => {
  const component = await readSource(componentPath);

  assert.match(
    component,
    /if\s*\(process\.env\.VERCEL_ENV\s*!==\s*["']production["']\)\s*\{\s*return children;\s*\}/
  );
  assert.doesNotMatch(component, /NODE_ENV/);
});

test("the shared document shell loads Microsoft Clarity exactly once", async () => {
  const [clientComponent, layout] = await Promise.all([
    readSource(clientComponentPath),
    readSource(layoutPath)
  ]);

  assert.equal(layout.match(/<MicrosoftClarity>/g)?.length ?? 0, 1);
  assert.equal(layout.match(/<\/MicrosoftClarity>/g)?.length ?? 0, 1);
  assert.equal(layout.match(/<VercelAnalytics\s/g)?.length ?? 0, 1);
  assert.match(layout, /process\.env\.VERCEL_ENV === "production"/);
  assert.match(layout, /process\.env\.VERCEL_ENV === "preview"/);
  assert.equal(
    clientComponent.match(/id=["']microsoft-clarity["']/g)?.length ?? 0,
    1
  );
});

test("Microsoft Clarity excludes sensitive route trees without prefix collisions", async () => {
  const {
    shouldTrackPublicRoute,
    shouldReloadForMicrosoftClarityBoundary
  } = await import(
    "../lib/analytics/publicAnalyticsRoutes.ts"
  );
  const cases = [
    [null, false],
    ["", false],
    ["/owner", false],
    ["/owner/restaurants/demo/settings", false],
    ["/todos", false],
    ["/todos/private", false],
    ["/sign-in", false],
    ["/sign-in/continue", false],
    ["/", true],
    ["/demo", true],
    ["/admin", false],
    ["/admin/insights", false],
    ["/admin/availability", false],
    ["/administrator", true],
    ["/ownerly", true],
    ["/todos-public", true],
    ["/sign-in-help", true]
  ];

  for (const [pathname, expected] of cases) {
    assert.equal(shouldTrackPublicRoute(pathname), expected, pathname ?? "null");
  }

  assert.equal(shouldReloadForMicrosoftClarityBoundary("/demo", "/owner"), true);
  assert.equal(shouldReloadForMicrosoftClarityBoundary("/demo", "/admin"), true);
  assert.equal(shouldReloadForMicrosoftClarityBoundary("/owner", "/demo"), true);
  assert.equal(shouldReloadForMicrosoftClarityBoundary("/", "/demo"), false);
  assert.equal(
    shouldReloadForMicrosoftClarityBoundary("/owner", "/owner/settings"),
    false
  );
});

test("client route changes stop Clarity and reload before protected content renders", async () => {
  const clientComponent = await readSource(clientComponentPath);

  assert.match(clientComponent, /usePathname\(\)/);
  assert.match(clientComponent, /useLayoutEffect\(/);
  assert.match(clientComponent, /useState\(pathname\)/);
  assert.match(clientComponent, /shouldTrackPublicRoute\(pathname\)/);
  assert.match(
    clientComponent,
    /shouldReloadForMicrosoftClarityBoundary\(/
  );
  assert.match(clientComponent, /window\.clarity\?\.\(["']stop["']\)/);
  assert.match(clientComponent, /window\.location\.reload\(\)/);
  assert.match(
    clientComponent,
    /if\s*\(shouldReload\)\s*\{\s*return null;\s*\}/
  );
  assert.match(
    clientComponent,
    /if\s*\(!shouldLoad\)\s*\{\s*return children;\s*\}/
  );
});

test("navigation start stops Clarity before a sensitive URL transition", async () => {
  const { shouldStopMicrosoftClarityBeforeNavigation } = await import(
    "../lib/analytics/publicAnalyticsRoutes.ts"
  );
  const instrumentationClient = await readSource(instrumentationClientPath);

  assert.equal(
    shouldStopMicrosoftClarityBeforeNavigation("/demo", "/owner"),
    true
  );
  assert.equal(
    shouldStopMicrosoftClarityBeforeNavigation("/demo", "/admin/insights"),
    true
  );
  assert.equal(
    shouldStopMicrosoftClarityBeforeNavigation("/demo", "/sign-in"),
    true
  );
  assert.equal(
    shouldStopMicrosoftClarityBeforeNavigation("/demo", "/menu/bistro"),
    false
  );
  assert.equal(
    shouldStopMicrosoftClarityBeforeNavigation("/owner", "/owner/settings"),
    false
  );

  assert.match(
    instrumentationClient,
    /export function onRouterTransitionStart\([\s\S]*navigationType:\s*[\s\S]*["']traverse["']/
  );
  assert.match(
    instrumentationClient,
    /shouldStopMicrosoftClarityBeforeNavigation\(/
  );
  assert.match(
    instrumentationClient,
    /window\.__vistaireClarityBlocked\s*=\s*true/
  );
  assert.match(
    instrumentationClient,
    /window\.clarity\?\.\(["']stop["']\)/
  );
  assert.match(
    instrumentationClient,
    /window\.addEventListener\(["']popstate["']/
  );
  assert.match(
    instrumentationClient,
    /window\.__vistaireClarityPathname/
  );
  assert.match(
    await readSource(clientComponentPath),
    /window\.__vistaireClarityPathname\s*=\s*pathname/
  );
});

test("Microsoft Clarity requires no additional package", async () => {
  const [packageJson, lockfile] = await Promise.all([
    readFile(packagePath, "utf8").then(JSON.parse),
    readFile(lockfilePath, "utf8").then(JSON.parse)
  ]);
  const declaredPackages = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  assert.equal(Object.keys(declaredPackages).some((name) => /clarity/i.test(name)), false);
  assert.equal(Object.keys(lockfile.packages).some((name) => /clarity/i.test(name)), false);
});

test("Vercel Analytics preserves public pageviews and custom events", async () => {
  const { filterPublicAnalyticsEvent } = await import(
    "../lib/analytics/publicAnalyticsRoutes.ts"
  );

  assert.equal(typeof filterPublicAnalyticsEvent, "function");
  for (const path of ["/", "/en", "/menu/bistro", "/administrator", "/ownerly"]) {
    for (const type of ["pageview", "event"]) {
      const event = { type, url: "https://vistaire.com" + path + "?source=menu" };
      assert.equal(filterPublicAnalyticsEvent(event, path), event, path);
    }
  }
});

test("Vercel Analytics drops protected event URLs regardless of the current route", async () => {
  const { filterPublicAnalyticsEvent } = await import(
    "../lib/analytics/publicAnalyticsRoutes.ts"
  );

  assert.equal(typeof filterPublicAnalyticsEvent, "function");
  for (const root of ["/admin", "/owner", "/todos", "/sign-in"]) {
    for (const type of ["pageview", "event"]) {
      assert.equal(
        filterPublicAnalyticsEvent({ type, url: "https://vistaire.com/" }, root),
        null,
        "The SDK may retain a public path after entering " + root
      );
    }
    for (const path of [root, root + "/private?token=private"]) {
      for (const type of ["pageview", "event"]) {
        assert.equal(
          filterPublicAnalyticsEvent({ type, url: "https://vistaire.com" + path }, "/"),
          null,
          path
        );
      }
    }
  }
  assert.equal(filterPublicAnalyticsEvent({ type: "pageview", url: "" }, "/"), null);
  assert.equal(
    filterPublicAnalyticsEvent({ type: "pageview", url: "invalid-url" }, "/"),
    null
  );
});
