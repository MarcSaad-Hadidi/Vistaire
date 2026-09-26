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
