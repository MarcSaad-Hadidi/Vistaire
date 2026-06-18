import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readRepoFile(...segments) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

test("owner command center uses the cockpit shell (sidebar + topbar, no public chrome)", () => {
  const layout = readRepoFile("app", "owner", "layout.tsx");
  const overview = readRepoFile("app", "owner", "page.tsx");
  const shell = readRepoFile("components", "owner", "OwnerShell.tsx");
  const css = readRepoFile("components", "owner", "OwnerCockpit.module.css");

  // Layout: owner theme + cockpit shell, no public Header, noindex.
  assert.match(layout, /OwnerCockpit\.module\.css/);
  assert.match(layout, /OwnerShell/);
  assert.match(layout, /ownerTheme/);
  assert.doesNotMatch(layout, /Header/);
  assert.match(layout, /index:\s*false/);

  // Shell: route-based sidebar navigation.
  assert.match(shell, /"use client"/);
  assert.match(shell, /usePathname/);
  assert.match(shell, /OWNER_NAV_ITEMS/);
  assert.match(shell, /styles\.console/);
  assert.match(shell, /styles\.sidebar/);

  // Overview: operator cockpit, not a vitrine — no dominant hero photo.
  assert.match(overview, /ModuleHeader/);
  assert.match(overview, /StatGroup/);
  assert.match(overview, /OwnerRestaurantPortfolio/);
  assert.match(overview, /ownerPortfolioLayout/);
  assert.match(overview, /workflowStrip/);
  assert.doesNotMatch(overview, /PhotoRestoComplet5/);
  assert.doesNotMatch(overview, /heroPanel/);

  // CSS design system primitives for the cockpit.
  assert.match(css, /\.ownerTheme[\s\S]*--owner-cream/);
  assert.match(css, /\.console/);
  assert.match(css, /\.sidebar/);
  assert.match(css, /\.navItem/);
  assert.match(css, /\.statGroup/);
  assert.match(css, /\.dataTable/);
  assert.match(css, /\.qrCustomizer/);
});
