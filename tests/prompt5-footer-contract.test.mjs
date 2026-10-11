import assert from "node:assert/strict";
import test from "node:test";

test("footer guide navigation follows the requested reading order", async () => {
  const { getEditorialGuideNavigation } = await import(
    "../lib/editorialGuideRoutes.ts"
  );

  assert.deepEqual(
    getEditorialGuideNavigation("fr").map((item) => item.href),
    [
      "/guides/anatomie-menu-digital-premium",
      "/guides/3d-restaurant-utile-vs-gadget",
      "/guides/menu-qr-mobile-sans-application"
    ]
  );
});

test("the public footer covers every localized marketing route and each restaurant menu once", async () => {
  const { getPublicFooterNavigation } = await import("../lib/publicFooterNavigation.ts");
  const { BILINGUAL_ROUTE_PAIRS } = await import("../lib/i18n.ts");
  for (const locale of ["fr", "en"]) {
    const links = getPublicFooterNavigation(locale).flatMap((group) => group.links);
    const hrefs = links.map((link) => link.href);
    assert.equal(new Set(hrefs).size, hrefs.length, "directory destinations must be unique");
    for (const pair of BILINGUAL_ROUTE_PAIRS) {
      assert.ok(hrefs.includes(pair[locale]), `missing ${locale} route ${pair[locale]}`);
    }
    for (const slug of ["maison-elyse", "trouvable", "sauge-noire"]) {
      assert.ok(hrefs.includes(`/menu/${slug}?lang=${locale}-CA`));
    }
    assert.ok(links.every((link) => link.label.trim() && link.href.startsWith("/")));
  }
});
