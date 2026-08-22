import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(
  new URL("../app/(fr)/owner/restaurants/[restaurantId]/qr/page.tsx", import.meta.url),
  "utf8"
);
const switcherSource = await readFile(
  new URL("../components/owner/OwnerRestaurantQrTargetSwitcher.tsx", import.meta.url),
  "utf8"
);

test("scoped QR page reads only the selected canonical target", () => {
  assert.match(pageSource, /searchParams/);
  assert.match(pageSource, /targetKind/);
  assert.match(pageSource, /getOwnerCanonicalQrCode/);
  assert.match(pageSource, /purposeKey:\s*"default"/);
  assert.match(pageSource, /record\.redirectUrl/);
  assert.match(pageSource, /selectedQrDestination/);
  assert.match(pageSource, /const selectedStatus = qrStatusLabel\(canonicalRecord, targetKind\)/);
  assert.match(pageSource, /const selectedTone = qrStatusTone\(canonicalRecord, targetKind\)/);
  assert.match(pageSource, /const selectedChecklist = preparation\.checklist\.map/);
  assert.match(pageSource, /const canonicalReadError = canonicalRead === null/);
  assert.match(pageSource, /Aucun QR ne\s*doit[\s\S]*être créé ou imprimé/);
  assert.match(pageSource, /detail: selectedStatus/);
  assert.match(pageSource, /!usableCanonical/);
  assert.match(pageSource, /Aucun QR admin canonique actif/);
  assert.doesNotMatch(pageSource, /getOrCreateOwnerQrCode/);
  assert.doesNotMatch(pageSource, /targetPath/);
  assert.doesNotMatch(pageSource, /console\.(log|info|debug).*token/i);
  assert.doesNotMatch(pageSource, /selectedStatus = targetKind === "menu"/);
});

test("QR target controls are real accessible pressed buttons", () => {
  assert.match(switcherSource, /aria-pressed/);
  assert.match(switcherSource, /selectTarget\("menu"\)/);
  assert.match(switcherSource, /selectTarget\("admin"\)/);
  assert.match(switcherSource, /URLSearchParams/);
});
