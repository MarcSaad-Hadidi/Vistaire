import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

function runPreflight(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/runtime-assets/preview-e2e-preflight.mjs"],
      {
        cwd: process.cwd(),
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      }
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

test("official runtime Preview E2E preflight fails explicitly without configuration", async () => {
  const result = await runPreflight({ PATH: process.env.PATH ?? "" });

  assert.equal(result.code, 2);
  for (const name of [
    "VISTAIRE_RUNTIME_E2E=1",
    "PLAYWRIGHT_SKIP_WEB_SERVER=1",
    "PLAYWRIGHT_BASE_URL",
    "VISTAIRE_RUNTIME_DISH_PATH",
    "VISTAIRE_RUNTIME_DISH_ID",
    "VISTAIRE_RUNTIME_ASSET_VERSION",
    "VISTAIRE_RUNTIME_STORAGE_HOST"
  ]) {
    assert.match(result.stderr, new RegExp(name.replace("=", "\\=")));
  }
});

test("official runtime Preview E2E preflight accepts complete read-only configuration", async () => {
  const result = await runPreflight({
    PATH: process.env.PATH ?? "",
    VISTAIRE_RUNTIME_E2E: "1",
    PLAYWRIGHT_SKIP_WEB_SERVER: "1",
    PLAYWRIGHT_BASE_URL: "https://preview.example.test",
    VISTAIRE_RUNTIME_DISH_PATH: "/menu/example/dishes/dish",
    VISTAIRE_RUNTIME_DISH_ID: "11111111-2222-4333-8444-555555555555",
    VISTAIRE_RUNTIME_ASSET_VERSION: "asset-version",
    VISTAIRE_RUNTIME_STORAGE_HOST: "project.supabase.co"
  });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
});
