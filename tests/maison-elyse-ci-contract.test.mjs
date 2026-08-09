import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const appCi = await readFile(new URL("../.github/workflows/app-ci.yml", import.meta.url), "utf8");

const REQUIRED_MEDIA_TESTS = [
  "tests/owner-maison-elyse-media-backfill.test.mjs",
  "tests/owner-dish-photo-upload.test.mjs",
  "tests/owner-dish-model-assets.test.mjs",
  "tests/owner-prepared-glb-workflow.test.mjs",
  "tests/owner-public-media-contract.test.mjs",
  "tests/public-menu-core.test.mjs",
  "tests/owner-usdz-source-not-stored.test.mjs",
  "tests/owner-usdz-runtime-optimizer.test.mjs"
];

test("Maison Elyse media tests are explicit and mandatory in App CI", () => {
  const script = packageJson.scripts?.["test:maison-elyse-media"] ?? "";
  assert.match(script, /^node --test /);
  for (const file of REQUIRED_MEDIA_TESTS) {
    assert.match(script, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const ciCommand = "npm run test:maison-elyse-media";
  const typecheckIndex = appCi.indexOf("npm run typecheck");
  const mediaIndex = appCi.indexOf(ciCommand);
  const buildIndex = appCi.indexOf("npm run build");

  assert.ok(typecheckIndex >= 0, "App CI must run typecheck");
  assert.ok(mediaIndex > typecheckIndex, "Maison Elyse tests must run after typecheck");
  assert.ok(buildIndex > mediaIndex, "Maison Elyse tests must run before build");
});

test("Maison Elyse PostgreSQL 17 tests are explicit and run before build", () => {
  assert.equal(packageJson.scripts?.["test:maison-elyse-postgres"], "node scripts/run-maison-elyse-postgres-tests.mjs");
  assert.match(appCi, /name: database-contracts/);
  assert.match(appCi, /npm run test:maison-elyse-postgres/);
  assert.ok(appCi.indexOf("npm run test:maison-elyse-postgres") > appCi.indexOf("npm run test:maison-elyse-media"));
  assert.ok(appCi.indexOf("npm run build") > appCi.indexOf("npm run test:maison-elyse-postgres"));
});

test("Maison Elyse public locale regression runs in Chromium and WebKit CI", () => {
  const chromium = packageJson.scripts?.["test:ci:e2e:menu"] ?? "";
  const webkit = packageJson.scripts?.["test:ci:e2e:webkit"] ?? "";

  assert.match(chromium, /e2e\/maison-elyse-public-menu\.spec\.ts/);
  assert.match(chromium, /--project=chromium/);
  assert.match(webkit, /e2e\/maison-elyse-public-menu\.spec\.ts/);
  assert.match(webkit, /--project=webkit/);
  assert.match(chromium, /--retries=0/);
  assert.match(webkit, /--retries=0/);
});

test("Maison public browser tests opt into the complete tracked menu fixture", async () => {
  const [runner, publicMenu] = await Promise.all([
    readFile(new URL("../scripts/run-playwright-e2e.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/menu/publicMenu.ts", import.meta.url), "utf8")
  ]);

  assert.match(runner, /endsWith\("e2e\/maison-elyse-public-menu\.spec\.ts"\)/);
  assert.match(runner, /VISTAIRE_E2E_MAISON_PUBLIC_MENU: "1"/);
  assert.match(
    publicMenu,
    /slug === "maison-elyse"[\s\S]*?dependencies\.readRows === readSupabaseRowsByFilters[\s\S]*?VISTAIRE_OWNER_E2E_AUTH_BYPASS === "1"[\s\S]*?VISTAIRE_E2E_MAISON_PUBLIC_MENU === "1"[\s\S]*?return demoMenu\(slug, resolvedLocale\)/
  );
});
