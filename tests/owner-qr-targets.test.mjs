import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildOwnerQrTarget,
  inferOwnerQrTargetKind,
  isOwnerQrResolvedTargetPathAllowed,
  isOwnerQrTargetPathAllowed,
  sanitizeOwnerQrTargetPath
} from "../lib/owner/menuUrlCore.ts";
import { normalizeOwnerQrStyle } from "../lib/owner/qrStyle.ts";

test("builds a public menu QR target with a clear label", () => {
  const target = buildOwnerQrTarget({
    targetKind: "menu",
    restaurantId: "rest_123",
    restaurantName: "Maison Elyse",
    restaurantSlug: "maison-elyse"
  });

  assert.equal(target.targetKind, "menu");
  assert.equal(target.targetPath, "/menu/maison-elyse");
  assert.equal(target.label, "QR menu - Maison Elyse");
  assert.equal(target.badgeLabel, "Public client");
});

test("builds Resto Marc menu QR targets for the secure redirect flow", () => {
  const target = buildOwnerQrTarget({
    targetKind: "menu",
    restaurantId: "33333333-3333-4333-8333-333333333333",
    restaurantName: "Resto Marc",
    restaurantSlug: "resto-marc"
  });

  assert.equal(target.targetKind, "menu");
  assert.equal(target.targetPath, "/menu/resto-marc");
  assert.doesNotMatch(target.targetPath, /owner|admin|token|service_role/i);
});

test("builds an internal protected owner QR target with a clear label", () => {
  const target = buildOwnerQrTarget({
    targetKind: "admin",
    restaurantId: "rest_123",
    restaurantName: "Maison Elyse",
    restaurantSlug: "maison-elyse"
  });

  assert.equal(target.targetKind, "admin");
  assert.equal(target.targetPath, "/admin");
  assert.equal(target.label, "QR dashboard restaurant - Maison Elyse");
  assert.equal(target.badgeLabel, "Interne restaurant");
  assert.doesNotMatch(target.targetPath, /secret|token|key|service_role/i);
});

test("sanitizes QR target paths without allowing open redirects", () => {
  assert.equal(sanitizeOwnerQrTargetPath("/menu/maison?table=12"), "/menu/maison?table=12");
  assert.equal(
    sanitizeOwnerQrTargetPath("/owner/restaurants?restaurantId=rest_123"),
    "/owner/restaurants?restaurantId=rest_123"
  );
  assert.equal(
    sanitizeOwnerQrTargetPath("/owner/restaurants/rest_123"),
    "/owner/restaurants/rest_123"
  );
  assert.equal(sanitizeOwnerQrTargetPath("https://evil.example/menu"), null);
  assert.equal(sanitizeOwnerQrTargetPath("http://evil.example/menu"), null);
  assert.equal(sanitizeOwnerQrTargetPath("//evil.example/menu"), null);
  assert.equal(sanitizeOwnerQrTargetPath("/\\evil.example"), null);
  assert.equal(sanitizeOwnerQrTargetPath("/menu\\evil"), null);
});

test("enforces allowed target paths by QR type", () => {
  assert.equal(isOwnerQrTargetPathAllowed("menu", "/menu/maison-elyse"), true);
  assert.equal(isOwnerQrTargetPathAllowed("menu", "/owner/restaurants"), false);
  assert.equal(isOwnerQrTargetPathAllowed("admin", "/admin"), true);
  assert.equal(isOwnerQrTargetPathAllowed("admin", "/admin?restaurantId=rest_123"), false);
  assert.equal(isOwnerQrTargetPathAllowed("admin", "/owner/restaurants/rest_123"), false);
  assert.equal(isOwnerQrTargetPathAllowed("admin", "/menu/maison-elyse"), false);
});

test("infers QR target kind from persisted target paths", () => {
  assert.equal(inferOwnerQrTargetKind("/menu/maison-elyse"), "menu");
  assert.equal(inferOwnerQrTargetKind("/admin"), "admin");
  assert.equal(inferOwnerQrTargetKind("/owner/restaurants?restaurantId=rest_123"), "admin");
  assert.equal(inferOwnerQrTargetKind("/owner/restaurants/rest_123"), "admin");
});

test("allows legacy owner paths only when resolving existing admin QR rows", () => {
  for (const path of [
    "/owner",
    "/owner/restaurants/rest_123",
    "/owner/restaurants?restaurantId=rest_123"
  ]) {
    assert.equal(isOwnerQrTargetPathAllowed("admin", path), false);
    assert.equal(isOwnerQrResolvedTargetPathAllowed("admin", path), true);
  }
  assert.equal(
    isOwnerQrResolvedTargetPathAllowed("admin", "/menu/maison-elyse"),
    false
  );
});

test("keeps logo QR styles scannable with high error correction", () => {
  assert.equal(
    normalizeOwnerQrStyle({ logoMode: "none", errorCorrectionLevel: "M" })
      .errorCorrectionLevel,
    "M"
  );
  assert.equal(
    normalizeOwnerQrStyle({ logoMode: "monogram", errorCorrectionLevel: "M" })
      .errorCorrectionLevel,
    "H"
  );
  assert.equal(
    normalizeOwnerQrStyle({ logoMode: "imageUrl", errorCorrectionLevel: "Q" })
      .errorCorrectionLevel,
    "H"
  );
});

test("signed fallback remains dev-gated but canonical creation never uses it", async () => {
  const tokenSource = await readFile("lib/owner/qrTokens.ts", "utf8");
  const storeSource = await readFile("lib/owner/qrStore.ts", "utf8");

  assert.match(tokenSource, /canUseSignedQrFallback/);
  assert.match(tokenSource, /process\.env\.NODE_ENV !== "production"/);
  assert.doesNotMatch(storeSource, /canUseSignedQrFallback/);
  assert.match(
    storeSource,
    /isOwnerQrTargetPathAllowed\(targetKind, targetPath\)/
  );
  const createOwnerQrCodeBody = storeSource.match(
    /export async function createOwnerQrCode\([\s\S]*?\r?\n}\r?\n\r?\nexport async function updateOwnerQrCode/
  )?.[0] ?? "";
  assert.match(
    createOwnerQrCodeBody,
    /return getOrCreateOwnerQrCode\(\{[\s\S]*purposeKey: args\.purposeKey \?\? "default"/
  );
});

test("restaurant dashboard copies the configured menu URL used by QR", async () => {
  const source = await readFile(
    "components/owner/OwnerRestaurantDashboard.tsx",
    "utf8"
  );

  assert.match(source, /navigator\.clipboard\.writeText\(restaurant\.menuUrl\)/);
  assert.match(source, /href=\{restaurant\.menuUrl\}/);
  assert.doesNotMatch(
    source,
    /navigator\.clipboard\.writeText\(restaurant\.publicMenuUrl\)/
  );
  assert.doesNotMatch(source, /href=\{restaurant\.publicMenuUrl\}/);
});

test("restaurant preview iframe uses configured client URL before derived slug path", async () => {
  const source = await readFile(
    "app/owner/restaurants/[restaurantId]/preview/page.tsx",
    "utf8"
  );

  assert.match(source, /restaurant\.menuUrlSource === "column"/);
  assert.match(source, /\? restaurant\.menuUrl/);
  assert.match(source, /: restaurant\.publicMenuPath \|\| restaurant\.clientMenuHref \|\| restaurant\.menuUrl/);
  assert.doesNotMatch(
    source,
    /const previewPath = restaurant\.publicMenuPath \|\| restaurant\.clientMenuHref/
  );
});
