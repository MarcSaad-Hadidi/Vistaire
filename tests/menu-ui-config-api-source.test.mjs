import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("owner menu UI config API is owner-only, same-origin for mutations, and supports publish", async () => {
  const source = await readFile("app/api/owner/menu-ui-config/route.ts", "utf8");

  assert.match(source, /requireVistaireOwnerApi/);
  assert.match(source, /requireSameOriginOwnerMutation\(request\)/);
  assert.match(source, /validateMenuUiConfig/);
  assert.match(source, /saveDraftMenuUiConfig/);
  assert.match(source, /publishMenuUiConfig/);
  assert.match(source, /action === "publish"/);
  assert.match(source, /status:\s*503/);
});

test("owner menu data API is owner-only and returns real menu data without trusting client dishes", async () => {
  const source = await readFile("app/api/owner/menu-data/route.ts", "utf8");

  assert.match(source, /requireVistaireOwnerApi/);
  assert.match(source, /getOwnerMenuData/);
  assert.doesNotMatch(source, /request\.json\(/);
});

