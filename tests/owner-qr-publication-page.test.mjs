import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("publication page consumes the canonical secure payload and persisted style", async () => {
  const source = await readFile(
    "app/owner/restaurants/[restaurantId]/qr/page.tsx",
    "utf8"
  );
  assert.match(source, /targetKind:\s*"menu"/);
  assert.match(source, /menuUrl=\{qrUrl\}/);
  assert.match(source, /displayUrl=\{publicDestination\}/);
  assert.match(source, /style=\{canonicalRecord\.style\}/);
  assert.match(source, /configVersion=\{canonicalRecord\.configVersion\}/);
  assert.match(source, /qrId=\{canonicalRecord\.id\}/);
  assert.doesNotMatch(source, /<OwnerRestaurantQrTargetSwitcher/);
  assert.doesNotMatch(source, /import\(\s*["']qrcode/);
});
