import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { loadMenuSchemaProjections } from "./helpers/public-dish-asset-route-runtime.mjs";

const { PUBLIC_MENU_PROJECTIONS } = await loadMenuSchemaProjections();

function runAudit(env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/supabase-usage-audit.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("public projections are explicit and do not expose wildcard rows", () => {
  for (const [name, projection] of Object.entries(PUBLIC_MENU_PROJECTIONS)) {
    assert.equal(projection.includes("*"), false, `${name} must stay column-scoped`);
    assert.ok(projection.split(",").length >= 3, `${name} should be a real projection`);
  }
});

test("usage audit refuses missing credentials and never runs in CI", async () => {
  const missing = await runAudit({
    NEXT_PUBLIC_SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    CI: ""
  });
  assert.equal(missing.code, 1);
  assert.match(`${missing.stdout}${missing.stderr}`, /NEXT_PUBLIC_SUPABASE_URL|credentials/i);

  const ci = await runAudit({
    NEXT_PUBLIC_SUPABASE_URL: "https://preview.example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "not-a-real-key",
    CI: "1"
  });
  assert.equal(ci.code, 1);
  assert.match(`${ci.stdout}${ci.stderr}`, /CI/i);

  const hostedWithoutOptIn = await runAudit({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "not-a-real-key",
    VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "",
    VISTAIRE_SUPABASE_AUDIT_TARGET: "",
    CI: ""
  });
  assert.equal(hostedWithoutOptIn.code, 1);
  assert.match(
    `${hostedWithoutOptIn.stdout}${hostedWithoutOptIn.stderr}`,
    /expected project ref|required project ref|project ref.*required/i
  );
});
