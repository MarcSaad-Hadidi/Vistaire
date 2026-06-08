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
  assert.match(source, /rollbackPublishedMenuUiConfig/);
  assert.match(source, /duplicatePublishedMenuUiConfigToDraft/);
  assert.match(source, /getOwnerMenuUiConfigHistory/);
  assert.match(source, /action === "publish"/);
  assert.match(source, /action === "rollback"/);
  assert.match(source, /action === "revert-to-published"/);
  assert.match(source, /status:\s*503/);
});

test("owner menu UI config store preserves live published rows during publish and rollback", async () => {
  const source = await readFile("lib/owner/menuUiConfigStore.ts", "utf8");

  assert.match(source, /archiveCurrentPublishedSnapshot/);
  assert.match(source, /updatePublishedInPlace/);
  assert.match(source, /rollbackPublishedMenuUiConfig/);
  assert.doesNotMatch(
    source,
    /\.update\(\{\s*status:\s*"archived"\s*\}\)[\s\S]{0,240}\.insert\(publishedRow\)/,
    "publish must not archive the live row before inserting a replacement"
  );
});

test("owner menu data API is owner-only and returns real menu data without trusting client dishes", async () => {
  const source = await readFile("app/api/owner/menu-data/route.ts", "utf8");

  assert.match(source, /requireVistaireOwnerApi/);
  assert.match(source, /getOwnerMenuData/);
  assert.doesNotMatch(source, /request\.json\(/);
});

