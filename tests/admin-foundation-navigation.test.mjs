import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("admin navigation consumes one five-route contract in a desktop rail and mobile bar", async () => {
  const [nav, icons, css] = await Promise.all([
    read("components/admin/system/AdminNav.tsx"),
    read("components/admin/system/AdminIcons.tsx"),
    read("components/admin/system/AdminSystem.module.css")
  ]);

  assert.equal((nav.match(/from ["']@\/lib\/admin\/foundationRoutes["']/g) ?? []).length, 1);
  assert.match(nav, /export type AdminNavProps\s*=\s*\{[\s\S]*active:\s*AdminRouteId;[\s\S]*locale:\s*AdminLocale;[\s\S]*variant:\s*["']desktop["']\s*\|\s*["']mobile["']/);
  assert.match(nav, /ADMIN_ROUTES\.flatMap\s*\(/);
  assert.match(nav, /data-admin-nav=\{variant\}/);
  assert.match(nav, /data-route-availability=\{route\.availability\}/);
  assert.match(nav, /prefetch=\{route\.availability === ["']integrated["'] \? undefined : false\}/);
  assert.match(nav, /styles\.desktopNav/);
  assert.match(nav, /styles\.mobileNav/);
  assert.match(icons, /export function ReportsIcon\b/);
  assert.match(icons, /export function MoreIcon\b/);
  assert.match(css, /\.sidebar\s*\{[^}]*width:\s*183px/s);
  assert.match(css, /\.desktopNav\s*\{[^}]*display:\s*grid/s);
  assert.match(nav, /href="\/admin\/more#quality"/);
  assert.match(css, /\.mobileNav\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s);
  assert.match(css, /\.mobileNav a\s*\{[^}]*min-height:\s*(?:44|5\d)px/s);
  assert.doesNotMatch(css, /overflow-x:\s*auto/);
});

test("AdminShell keeps the legacy route API while rendering canonical navigation", async () => {
  const shell = await read("components/admin/system/AdminShell.tsx");

  assert.match(shell, /activeRoute:\s*AdminRouteId;\s*active\?:\s*never/);
  assert.match(shell, /active:\s*LegacyAdminRoute;\s*activeRoute\?:\s*never/);
  assert.match(shell, /normalizeLegacyAdminRoute\((?:props\.)?active\)/);
  assert.match(shell, /<AdminNav active=\{canonicalActive\} locale=\{preferences\.locale\} variant="desktop"\s*\/>/);
  assert.match(shell, /<AdminNav active=\{canonicalActive\} locale=\{preferences\.locale\} variant="mobile"\s*\/>/);
  assert.match(shell, /active \? <div hidden><AdminTabs active=\{active\} \/><\/div> : null/);
});

test("AdminShell gives vnext routes one page heading while preserving restaurant identity", async () => {
  const shell = await read("components/admin/system/AdminShell.tsx");

  assert.match(shell, /pageTitle\?:\s*string/);
  assert.match(shell, /pageDescription\?:\s*string/);
  assert.match(shell, /pageTitle \? restaurantName : ["']Dashboard restaurant["']/);
  assert.match(shell, /<h1>\{pageTitle \?\? restaurantName\}<\/h1>/);
  assert.equal((shell.match(/<h1>/g) ?? []).length, 1);
});

test("foundation and legacy browser specs stay local, unskipped, and cover five labels", async () => {
  const [foundation, legacy] = await Promise.all([
    read("e2e/admin-foundation.spec.ts"),
    read("e2e/admin-visual.spec.ts")
  ]);

  for (const source of [foundation, legacy]) {
    assert.doesNotMatch(source, /test\.skip|test\.fixme|describe\.skip|VISTAIRE_ADMIN_E2E_QR_TOKEN/);
  }
  assert.match(foundation, /localhost/);
  assert.match(foundation, /127\.0\.0\.1/);
  assert.match(foundation, /\[::1\]/);
  assert.match(foundation, /route\.abort\(["']blockedbyclient["']\)/);
  assert.match(foundation, /page\.routeWebSocket\(/);
  assert.match(foundation, /webSocketRoute\.close\(/);
  assert.match(
    foundation,
    /test\(["']accessibility keeps navigation targets[\s\S]*?await enterLocalPreview\(page\)/
  );
  for (const label of ["Aujourd’hui", "Disponibilités", "Intelligence", "Rapports", "Plus"]) {
    assert.match(foundation, new RegExp(label));
  }

  for (const match of legacy.matchAll(/page\.goto\(\s*["']([^"']+)["']/g)) {
    assert.match(match[1], /^\//, `legacy page.goto must stay relative: ${match[1]}`);
  }
  const forbiddenAbsolute = /(?:https?|wss?):\/\/(?!localhost(?::\d+)?(?:\/|["'])|127\.0\.0\.1(?::\d+)?(?:\/|["'])|\[::1\](?::\d+)?(?:\/|["']))/i;
  assert.doesNotMatch(foundation, forbiddenAbsolute);
  assert.doesNotMatch(legacy, forbiddenAbsolute);
});
