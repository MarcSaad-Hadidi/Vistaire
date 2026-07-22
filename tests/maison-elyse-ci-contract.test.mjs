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

  const ciCommand = "run: npm run test:maison-elyse-media";
  const typecheckIndex = appCi.indexOf("run: npm run typecheck");
  const mediaIndex = appCi.indexOf(ciCommand);
  const buildIndex = appCi.indexOf("run: npm run build");

  assert.ok(typecheckIndex >= 0, "App CI must run typecheck");
  assert.ok(mediaIndex > typecheckIndex, "Maison Elyse tests must run after typecheck");
  assert.ok(buildIndex > mediaIndex, "Maison Elyse tests must run before build");
});

test("Maison Elyse PostgreSQL 17 tests are explicit and run before build", () => {
  assert.equal(packageJson.scripts?.["test:maison-elyse-postgres"], "node scripts/run-maison-elyse-postgres-tests.mjs");
  assert.match(appCi, /name: Maison Elyse PostgreSQL 17 tests/);
  assert.match(appCi, /run: npm run test:maison-elyse-postgres/);
  assert.ok(appCi.indexOf("run: npm run test:maison-elyse-postgres") > appCi.indexOf("run: npm run test:maison-elyse-media"));
  assert.ok(appCi.indexOf("run: npm run build") > appCi.indexOf("run: npm run test:maison-elyse-postgres"));
});
