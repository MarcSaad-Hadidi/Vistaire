import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  loadMenuSchemaProjections,
  loadPublicMenu,
  loadPublicMenuCache
} from "./helpers/public-dish-asset-route-runtime.mjs";

const publicMenuCache = await loadPublicMenuCache();
const publicMenu = await loadPublicMenu();
const { PUBLIC_MENU_PROJECTIONS } = await loadMenuSchemaProjections();

function createCacheHarness(clock) {
  const entries = new Map();
  const keyFor = (keyParts) => JSON.stringify(keyParts);
  return {
    entries,
    async unstableCache(loader, keyParts, options) {
      const key = keyFor(keyParts);
      return async () => {
        const cached = entries.get(key);
        if (cached && cached.expiresAt > clock.now()) return cached.value;
        const value = await loader();
        entries.set(key, {
          value,
          tags: [...(options.tags ?? [])],
          expiresAt: clock.now() + Number(options.revalidate) * 1_000
        });
        return value;
      };
    },
    revalidateTag(tag) {
      for (const [key, entry] of entries) {
        if (entry.tags.includes(tag)) entries.delete(key);
      }
    }
  };
}

function productionDependencies(harness) {
  return {
    environment: {
      nodeEnv: "production",
      ci: "",
      ownerE2EAuthBypass: ""
    },
    unstableCache: harness.unstableCache
  };
}

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

test("public menu cache scopes cold and warm reads by slug, locale, and restaurant", async () => {
  const clock = { value: 1_000, now() { return this.value; } };
  const harness = createCacheHarness(clock);
  const dependencies = productionDependencies(harness);
  let loads = 0;
  const read = (slug, locale, restaurantId) => publicMenuCache.getCachedPublicMenu({
    slug,
    locale,
    restaurantId,
    dependencies,
    loader: async () => ({ restaurantId, slug, locale, revision: ++loads })
  });

  assert.deepEqual(await read("bistro-a", "fr-CA", "restaurant-a"), {
    restaurantId: "restaurant-a", slug: "bistro-a", locale: "fr-CA", revision: 1
  });
  assert.equal((await read("bistro-a", "fr-CA", "restaurant-a")).revision, 1);
  assert.equal((await read("bistro-a", "en-CA", "restaurant-a")).revision, 2);
  assert.equal((await read("bistro-b", "fr-CA", "restaurant-b")).revision, 3);
  assert.equal((await read("bistro-a", "fr-CA", "restaurant-b")).revision, 4);
  assert.equal(loads, 4);

  clock.value += 59_999;
  assert.equal((await read("bistro-a", "fr-CA", "restaurant-a")).revision, 1);
  clock.value += 1;
  assert.equal((await read("bistro-a", "fr-CA", "restaurant-a")).revision, 5);
});

test("public menu cache deduplicates concurrent reads and retries after loader errors", async () => {
  const clock = { now: () => 1_000 };
  const harness = createCacheHarness(clock);
  const dependencies = productionDependencies(harness);
  let rejectLoads = 0;
  const rejectedArgs = {
    slug: "bistro-error",
    locale: "fr-CA",
    restaurantId: "restaurant-error",
    dependencies,
    loader: async () => {
      rejectLoads += 1;
      if (rejectLoads === 1) throw new Error("transient loader failure");
      return { revision: rejectLoads };
    }
  };
  await assert.rejects(publicMenuCache.getCachedPublicMenu(rejectedArgs), /transient loader failure/);
  assert.deepEqual(await publicMenuCache.getCachedPublicMenu(rejectedArgs), { revision: 2 });

  let release;
  let concurrentLoads = 0;
  const concurrentArgs = {
    slug: "bistro-concurrent",
    locale: "fr-CA",
    restaurantId: "restaurant-concurrent",
    dependencies,
    loader: async () => {
      concurrentLoads += 1;
      return new Promise((resolve) => { release = resolve; });
    }
  };
  const first = publicMenuCache.getCachedPublicMenu(concurrentArgs);
  const second = publicMenuCache.getCachedPublicMenu(concurrentArgs);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(concurrentLoads, 1);
  release({ revision: 1 });
  assert.deepEqual(await Promise.all([first, second]), [{ revision: 1 }, { revision: 1 }]);
});

test("hermetic E2E reads bypass durable cache and isolate each fixture", async () => {
  let loads = 0;
  const dependencies = {
    environment: {
      nodeEnv: "production",
      ci: "true",
      ownerE2EAuthBypass: "1"
    },
    unstableCache: async () => assert.fail("hermetic E2E must not construct durable cache entries")
  };
  const args = {
    slug: "fixture-menu",
    locale: "fr-CA",
    restaurantId: "fixture-restaurant",
    dependencies,
    loader: async () => ({ fixtureRevision: ++loads })
  };
  assert.deepEqual(await publicMenuCache.getCachedPublicMenu(args), { fixtureRevision: 1 });
  assert.deepEqual(await publicMenuCache.getCachedPublicMenu(args), { fixtureRevision: 2 });
});

test("restaurant and locale tags invalidate warm data and the next read loads the committed value", async () => {
  const clock = { now: () => 1_000 };
  const harness = createCacheHarness(clock);
  const dependencies = productionDependencies(harness);
  let committed = "before";
  let loads = 0;
  const args = {
    slug: "bistro-a",
    locale: "fr-CA",
    restaurantId: "restaurant-a",
    dependencies,
    loader: async () => ({ committed, loads: ++loads })
  };
  assert.deepEqual(await publicMenuCache.getCachedPublicMenu(args), { committed: "before", loads: 1 });
  committed = "after-restaurant-invalidation";
  assert.equal((await publicMenuCache.getCachedPublicMenu(args)).committed, "before");
  const restaurantResult = await publicMenuCache.revalidatePublicMenuCache(
    { restaurantId: "restaurant-a" },
    { revalidateTag: harness.revalidateTag }
  );
  assert.equal(restaurantResult.ok, true);
  assert.equal((await publicMenuCache.getCachedPublicMenu(args)).committed, "after-restaurant-invalidation");

  committed = "after-locale-invalidation";
  harness.revalidateTag("public-menu:bistro-a:locale:fr-ca");
  assert.equal((await publicMenuCache.getCachedPublicMenu(args)).committed, "after-locale-invalidation");
  assert.equal(loads, 3);
});

test("an availability mutation evicts the old menu and the unavailable dish disappears on reload", async () => {
  const restaurantId = "33333333-3333-4333-8333-333333333333";
  const slug = "bistro-mutation";
  let available = true;
  let dishReads = 0;
  const readRows = async ({ table }) => {
    if (table === "restaurants") {
      return {
        ok: true,
        rows: [{ id: restaurantId, slug, name: "Bistro Mutation" }]
      };
    }
    if (table === "menu_dishes") {
      dishReads += 1;
      return {
        ok: true,
        rows: [{
          id: "dish-1",
          restaurant_id: restaurantId,
          slug: "plat-test",
          name: "Plat test",
          category_name: "Plats",
          price: 20,
          is_available: available
        }]
      };
    }
    return { ok: true, rows: [] };
  };
  const clock = { now: () => 1_000 };
  const harness = createCacheHarness(clock);
  const dependencies = productionDependencies(harness);
  const args = {
    slug,
    locale: "fr-CA",
    restaurantId,
    dependencies,
    loader: () => publicMenu.getPublicMenuBySlug(slug, "fr-CA", {
      readRows,
      nodeEnv: "production"
    })
  };

  const before = await publicMenuCache.getCachedPublicMenu(args);
  assert.deepEqual(before.dishes.map((dish) => dish.id), ["dish-1"]);
  available = false;
  const stillWarm = await publicMenuCache.getCachedPublicMenu(args);
  assert.deepEqual(stillWarm.dishes.map((dish) => dish.id), ["dish-1"]);
  assert.equal(dishReads, 1);

  await publicMenuCache.revalidatePublicMenuCache(
    { restaurantId },
    { revalidateTag: harness.revalidateTag }
  );
  const after = await publicMenuCache.getCachedPublicMenu(args);
  assert.deepEqual(after.dishes, []);
  assert.equal(dishReads, 2);
});

test("signed storage tokens are rejected before durable public menu caching", async () => {
  const clock = { now: () => 1_000 };
  const harness = createCacheHarness(clock);
  const dependencies = productionDependencies(harness);
  const secret = "must-not-enter-cache-or-error";
  await assert.rejects(
    publicMenuCache.getCachedPublicMenu({
      slug: "unsafe-menu",
      locale: "fr-CA",
      restaurantId: "unsafe-restaurant",
      dependencies,
      loader: async () => ({
        imageUrl: `https://project.supabase.co/storage/v1/object/sign/media/photo.webp?token=${secret}`
      })
    }),
    (error) => {
      assert.equal(String(error).includes(secret), false);
      assert.match(String(error), /signed asset/i);
      return true;
    }
  );
  assert.equal(harness.entries.size, 0);
});

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
  assert.match(`${hostedWithoutOptIn.stdout}${hostedWithoutOptIn.stderr}`, /allow-production-read/i);
});
