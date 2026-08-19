import assert from "node:assert/strict";
import test from "node:test";

import {
  NAMED_STATIC_PUBLIC_ROUTES,
  validateStaticPublicRoutes
} from "../scripts/ci/check-static-public-routes.mjs";

function fixture() {
  return {
    version: 4,
    routes: Object.fromEntries(
      NAMED_STATIC_PUBLIC_ROUTES.map((route, index) => [
        route,
        {
          dataRoute: `${route === "/" ? "/index" : route}.rsc`,
          initialRevalidateSeconds: index % 2 === 0 ? false : 60,
          srcRoute: null
        }
      ])
    ),
    dynamicRoutes: {
      "/[slug]": { routeRegex: "synthetic" },
      "/en/[slug]": { routeRegex: "synthetic" },
      "/menu/[slug]": { routeRegex: "synthetic" },
      "/menu/[slug]/dishes/[dishSlug]": { routeRegex: "synthetic" }
    },
    notFoundRoutes: [],
    preview: {}
  };
}

test("the exact 26 named routes accept static or positive ISR entries", () => {
  assert.equal(NAMED_STATIC_PUBLIC_ROUTES.length, 26);
  const manifest = fixture();
  assert.deepEqual(validateStaticPublicRoutes(manifest), {
    named: [...NAMED_STATIC_PUBLIC_ROUTES],
    dynamic: [
      "/[slug]",
      "/en/[slug]",
      "/menu/[slug]",
      "/menu/[slug]/dishes/[dishSlug]"
    ]
  });
});

test("a missing named route is a blocking manifest failure", () => {
  const manifest = fixture();
  delete manifest.routes["/en/about"];
  assert.throws(
    () => validateStaticPublicRoutes(manifest),
    /missing named static public route: \/en\/about/i
  );
});

test("approved dynamic surfaces may not appear as prerendered routes", () => {
  for (const route of [
    "/demo",
    "/en/vistaire-menu",
    "/admin",
    "/owner/restaurants",
    "/api/public/private",
    "/q/token",
    "/menu/maison-elyse",
    "/sign-in",
    "/todos",
    "/legacy/path",
    "/[slug]",
    "/en/[slug]"
  ]) {
    const manifest = fixture();
    manifest.routes[route] = { initialRevalidateSeconds: false };
    assert.throws(
      () => validateStaticPublicRoutes(manifest),
      new RegExp(`dynamic route is prerendered: ${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
      route
    );
  }
});

test("named routes cannot remain dynamic or use invalid revalidation values", () => {
  const dynamicManifest = fixture();
  dynamicManifest.dynamicRoutes["/contact"] = { routeRegex: "synthetic" };
  assert.throws(
    () => validateStaticPublicRoutes(dynamicManifest),
    /named static public route is dynamic: \/contact/i
  );

  for (const invalid of [0, -1, true, "60", null]) {
    const manifest = fixture();
    manifest.routes["/contact"].initialRevalidateSeconds = invalid;
    assert.throws(
      () => validateStaticPublicRoutes(manifest),
      /invalid initialRevalidateSeconds for \/contact/i,
      String(invalid)
    );
  }
});
