import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { PUBLIC_MENU_PROJECTIONS } from "../lib/menu/menuSchemaProjections.ts";

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

test("public menu cache is inter-request and tag-invalidated", async () => {
  const cache = await readFile("lib/menu/publicMenuCache.ts", "utf8");
  const loader = await readFile("lib/menu/publicMenu.ts", "utf8");
  const mutation = await readFile("lib/owner/menuMutationRevalidation.ts", "utf8");
  assert.match(cache, /unstable_cache/);
  assert.match(cache, /public-menu:\$\{slug\}/);
  assert.match(cache, /revalidate:\s*PUBLIC_MENU_CACHE_REVALIDATE_SECONDS/);
  assert.match(loader, /getCachedPublicMenu/);
  assert.match(cache, /import\("next\/cache"\)/);
  assert.match(mutation, /revalidatePublicMenuCache/);
});

test("public projections are explicit and do not expose wildcard rows", () => {
  for (const [name, projection] of Object.entries(PUBLIC_MENU_PROJECTIONS)) {
    assert.equal(projection.includes("*"), false, `${name} must stay column-scoped`);
    assert.ok(projection.split(",").length >= 3, `${name} should be a real projection`);
  }
});

test("3D owner mutations invalidate the public menu data cache", async () => {
  const routes = [
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/route.ts",
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/glb/route.ts",
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/viewer-glb/route.ts",
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/publish/route.ts",
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/usdz-runtime/complete/route.ts"
  ];
  for (const route of routes) {
    const source = await readFile(route, "utf8");
    assert.match(source, /revalidatePublicMenuCache/);
  }
});

test("settings and translation mutations invalidate public menu data", async () => {
  const settings = await readFile(
    "app/api/owner/restaurants/[restaurantId]/menu-settings/route.ts",
    "utf8"
  );
  const translations = await readFile(
    "app/api/owner/restaurants/[restaurantId]/menu-translations/route.ts",
    "utf8"
  );
  assert.match(settings, /revalidateOwnerMenuMutationPaths/);
  assert.match(translations, /revalidateOwnerMenuMutationPaths/);
  assert.match(translations, /body\?\.dryRun !== true/);
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
  assert.match(`${hostedWithoutOptIn.stdout}${hostedWithoutOptIn.stderr}`, /allow-production-read/i);
});
