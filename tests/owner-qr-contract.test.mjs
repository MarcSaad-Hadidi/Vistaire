import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("owner QR API accepts an explicit target kind and returns target metadata", async () => {
  const source = await readFile("app/api/owner/qr-codes/route.ts", "utf8");

  assert.match(source, /targetKind/);
  assert.match(source, /candidate\.targetKind === "menu"/);
  assert.match(source, /candidate\.targetKind === "admin"/);
  assert.match(source, /createOwnerQrCode\(\{[\s\S]*targetKind/s);
  assert.match(source, /targetPath: created\.record\.targetPath/);
  assert.match(source, /targetKind: created\.record\.targetKind/);
});

test("owner QR manager exposes restaurant, QR type, destination, and safety badges", async () => {
  const manager = await readFile("components/owner/OwnerQrManager.tsx", "utf8");
  const customizer = await readFile("components/owner/OwnerQrCustomizer.tsx", "utf8");

  assert.match(manager, /buildOwnerQrTarget/);
  assert.match(manager, /QR menu public/);
  assert.match(manager, /QR dashboard restaurant/);
  assert.match(manager, /Destination exacte/);
  assert.match(manager, /Public client/);
  assert.match(manager, /Interne restaurant/);
  assert.match(manager, /Ne pas imprimer pour les clients/);
  assert.match(customizer, /Logo au centre/);
  assert.match(customizer, /Aucun logo/);
  assert.match(customizer, /Monogramme du restaurant/);
  assert.match(customizer, /Logo image/);
});

test("owner QR page can be preselected from restaurant creation success", async () => {
  const page = await readFile("app/owner/qr-codes/page.tsx", "utf8");
  const manager = await readFile("components/owner/OwnerQrManager.tsx", "utf8");
  const createForm = await readFile("components/owner/RestaurantCreateForm.tsx", "utf8");

  assert.match(page, /searchParams/);
  assert.match(page, /restaurantId/);
  assert.match(page, /restaurantSlug/);
  assert.match(page, /target/);
  assert.match(page, /initialRestaurantId=/);
  assert.match(page, /initialRestaurantSlug=/);
  assert.match(page, /initialTargetKind=/);
  assert.match(manager, /initialRestaurantId/);
  assert.match(manager, /initialRestaurantSlug/);
  assert.match(manager, /initialTargetKind/);
  assert.match(page, /return value === "admin" \? "admin" : "menu"/);
  assert.match(manager, /return value === "admin" \? "admin" : "menu"/);
  assert.match(manager, /restaurant\.slug === initialRestaurantSlug/);
  assert.match(createForm, /qrCodesHref/);
  assert.match(createForm, /Generer le QR menu/);
  assert.match(createForm, /state\.qrCodesHref/);
});

test("owner QR customizer saves target kind and displays persistence details", async () => {
  const source = await readFile("components/owner/OwnerQrCustomizer.tsx", "utf8");

  assert.match(source, /targetKind/);
  assert.match(source, /targetLabel/);
  assert.match(source, /targetPath/);
  assert.match(source, /persisted/);
  assert.match(source, /record\?:/);
  assert.match(source, /QR securise enregistre/);
  assert.match(source, /non persiste/);
});

test("owner QR customizer cannot expose or export a direct destination before secure creation", async () => {
  const source = await readFile("components/owner/OwnerQrCustomizer.tsx", "utf8");

  assert.match(source, /useState\(""\)/);
  assert.match(source, /if \(!qrValue\) \{[\s\S]*?setSvgMarkup\(""\)/);
  assert.match(source, /const canExportQr = Boolean\(qrValue && svgMarkup\)/);
  assert.match(source, /disabled=\{!canExportQr\}/);
  assert.match(source, /if \(!qrValue\) return;/);
  assert.match(source, /isOpaqueQrRedirect/);
  assert.doesNotMatch(source, /useState\(targetDisplayUrl\)/);
  assert.doesNotMatch(source, /il ne contient aucun identifiant ni secret/i);
  assert.match(source, /jeton d.accès/i);
});

test("QR scan RPC is not executable by public browser roles", async () => {
  const migration = await readFile(
    "supabase/migrations/0002_qr_resolve_scan_rpc.sql",
    "utf8"
  );

  assert.match(migration, /security definer/i);
  assert.match(
    migration,
    /revoke execute on function public\.resolve_qr_code_scan\(text\) from public, anon, authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.resolve_qr_code_scan\(text\) to service_role/i
  );
});

test("QR exchange sets only the path-scoped restaurant admin session", async () => {
  const route = await readFile("app/q/[token]/route.ts", "utf8");

  assert.match(route, /vistaire_admin_access/);
  assert.match(route, /httpOnly:\s*true/);
  assert.match(route, /secure:\s*process\.env\.NODE_ENV === "production"/);
  assert.match(route, /sameSite:\s*"lax"/);
  assert.match(route, /path:\s*"\/admin"/);
  assert.match(route, /maxAge:\s*ADMIN_ACCESS_TTL_SECONDS/);
  assert.match(route, /resolved\.targetKind === "menu"[\s\S]*resolved\.targetPath/);
  assert.match(route, /protectedRedirect\(request, "\/admin"\)/);
  assert.match(route, /Cache-Control["'],\s*["']no-store/);
  assert.match(route, /Referrer-Policy["'],\s*["']no-referrer/);
  assert.doesNotMatch(route, /[?&]restaurantId=/);
});
