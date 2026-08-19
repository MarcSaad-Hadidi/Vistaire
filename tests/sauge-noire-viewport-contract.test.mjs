import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const layoutPath = new URL("../app/(fr)/menu/[slug]/layout.tsx", import.meta.url);
const frenchRootLayoutPath = new URL("../app/(fr)/layout.tsx", import.meta.url);
const englishRootLayoutPath = new URL("../app/(en)/layout.tsx", import.meta.url);
const globalStylesPath = new URL("../app/globals.css", import.meta.url);
const themePath = new URL("../lib/vistaireRouteTheme.ts", import.meta.url);
const bridgePath = new URL(
  "../components/menu/SaugeNoireRouteThemeBridge.tsx",
  import.meta.url
);

test("Sauge Noire owns its light viewport without request-dependent document roots", async () => {
  const [layout, frenchRoot, englishRoot, globalStyles, theme, bridge] = await Promise.all([
    readFile(layoutPath, "utf8"),
    readFile(frenchRootLayoutPath, "utf8"),
    readFile(englishRootLayoutPath, "utf8"),
    readFile(globalStylesPath, "utf8"),
    readFile(themePath, "utf8"),
    readFile(bridgePath, "utf8")
  ]);

  assert.match(layout, /export async function generateViewport/);
  assert.match(layout, /themeColor: SAUGE_NOIRE_PAPER/);
  assert.match(layout, /colorScheme: "light"/);
  assert.match(layout, /return \{\};/);
  assert.match(layout, /data-vistaire-route-theme/);
  for (const rootLayout of [frenchRoot, englishRoot]) {
    assert.doesNotMatch(rootLayout, /VISTAIRE_ROUTE_THEME_HEADER/);
    assert.doesNotMatch(rootLayout, /data-vistaire-route-theme/);
  }
  assert.match(theme, /SAUGE_NOIRE_PAPER = "#faf4e9"/);
  assert.match(globalStyles, /html\[data-vistaire-route-theme="sauge-noire"\]/);
  assert.match(globalStyles, /html:has\(\[data-vistaire-route-theme="sauge-noire"\]\)/);
  assert.match(globalStyles, /body:has\(\[data-vistaire-route-theme="sauge-noire"\]\)/);
  assert.match(globalStyles, /#contenu/);
  assert.match(bridge, /useEffect/);
  assert.match(bridge, /removeAttribute\(routeThemeAttribute\)/);
});
