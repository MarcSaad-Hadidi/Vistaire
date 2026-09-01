import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildAdminEvidenceBundle } from "../lib/admin/data/evidenceRegistry.ts";
import { buildMoreQuality } from "../lib/admin/more/buildMoreQuality.ts";
import { loadMoreQualityDataWithDependencies } from "../lib/admin/more/loadMoreQuality.ts";

const restaurantId = "restaurant-private";
const menuId = "menu-private";
const scope = { restaurantId, menuId, source: "production", timezone: "America/Toronto" };
const window = {
  range: "today",
  timezone: "America/Toronto",
  calendarDayCount: 1,
  observedAt: "2026-08-11T20:42:00.000Z",
  current: { from: "2026-08-11T04:00:00.000Z", to: "2026-08-11T20:42:00.000Z" },
  previous: { from: "2026-08-10T04:00:00.000Z", to: "2026-08-10T20:42:00.000Z" },
  alignment: "local-calendar-v1"
};
const bundle = buildAdminEvidenceBundle({ scope, window, generatedAt: window.observedAt, records: [] });
const profile = {
  name: "Maison Élyse",
  location: "Montréal",
  cuisineType: "Cuisine française",
  contactPhone: "+1 514 555 0100",
  contactEmail: "bonjour@maison.test",
  publicMenuPath: "/menu/maison-elyse"
};

function dish(overrides = {}) {
  return {
    id: "dish-1",
    name: "Homard rôti",
    hasPhoto: true,
    hasDescription: true,
    allergenStatus: "declared",
    hasImmersiveAsset: true,
    ...overrides
  };
}

function build(overrides = {}) {
  return buildMoreQuality({
    locale: "fr",
    profile,
    menu: { status: "published", defaultLocale: "fr-CA", supportedLocales: ["fr-CA", "en-CA"] },
    qr: { active: 1, total: 1 },
    dishes: { ok: true, items: [dish()] },
    translations: { ok: true, rows: [{ dishId: "dish-1", locale: "en-CA", status: "up_to_date" }] },
    ...overrides
  });
}

test("an empty menu is not applicable rather than falsely complete", () => {
  const model = build({ dishes: { ok: true, items: [] }, translations: { ok: true, rows: [] } });
  for (const state of [model.photos, model.descriptions, model.allergens, model.translations, model.immersiveAssets]) {
    assert.deepEqual(state, { kind: "unavailable", reason: "not-applicable" });
  }
  assert.equal(model.completionIssues.length, 1);
  assert.equal(model.completionIssues[0].kind, "menu-empty");
});

test("catalog completeness uses explicit dish denominators and records observed gaps", () => {
  const model = build({
    dishes: { ok: true, items: [dish(), dish({ id: "dish-2", name: "Risotto", hasPhoto: false, hasDescription: false, allergenStatus: "unknown", hasImmersiveAsset: false })] },
    translations: { ok: true, rows: [{ dishId: "dish-1", locale: "en-CA", status: "up_to_date" }] }
  });
  assert.deepEqual(model.photos, { kind: "partial", completed: 1, total: 2 });
  assert.deepEqual(model.descriptions, { kind: "partial", completed: 1, total: 2 });
  assert.deepEqual(model.allergens, { kind: "partial", completed: 1, total: 2 });
  assert.deepEqual(model.immersiveAssets, { kind: "partial", completed: 1, total: 2 });
  assert.deepEqual(model.translations, { kind: "partial", completed: 3, total: 4 });
  assert.equal(model.completionIssues.some((issue) => issue.kind === "allergens-unknown" && issue.dishName === "Risotto"), true);
  assert.equal(JSON.stringify(model).includes("incident"), false);
});

test("technical outcomes remain unmeasured even when a 3D catalog asset exists", () => {
  const model = build();
  assert.deepEqual(model.immersiveAssets, { kind: "ready", completed: 1, total: 1 });
  assert.deepEqual(model.mobilePerformance, { kind: "unmeasured", reason: "source-not-connected" });
  assert.deepEqual(model.immersiveSuccess, { kind: "unmeasured", reason: "source-not-connected" });
  assert.deepEqual(model.assetErrors, { kind: "unmeasured", reason: "source-not-connected" });
});

test("QR readiness counts active rows instead of treating any active row as full coverage", () => {
  const model = build({ qr: { active: 1, total: 2 } });
  assert.deepEqual(model.qr, { kind: "partial", completed: 1, total: 2 });
});

test("independent read failures fail only the affected quality states", () => {
  const translationsFailed = build({ translations: { ok: false, reason: "read-failed" } });
  assert.deepEqual(translationsFailed.translations, { kind: "unavailable", reason: "read-failed" });
  assert.equal(translationsFailed.photos.kind, "ready");

  const catalogFailed = build({ dishes: { ok: false, reason: "read-failed" } });
  assert.deepEqual(catalogFailed.photos, { kind: "unavailable", reason: "read-failed" });
  assert.deepEqual(catalogFailed.allergens, { kind: "unavailable", reason: "read-failed" });
  assert.equal(catalogFailed.completionIssues.length, 0);
});

test("missing profile fields stay absent and locale-specific copy remains bilingual", () => {
  const model = build({ locale: "en", profile: { name: "Maison Élyse", publicMenuPath: "/menu/maison-elyse" } });
  assert.deepEqual(model.profile, { name: "Maison Élyse", publicMenuPath: "/menu/maison-elyse" });
  assert.equal(model.locale, "en");
  assert.match(model.copy.states.unmeasured, /not measured/i);
  assert.doesNotMatch(JSON.stringify(model.copy), /excellent|real[- ]time|\bSLA\b/i);
});

test("the loader enforces production restaurant and menu scope and rejects foreign rows", async () => {
  const access = { ok: true, restaurantId, qrId: "qr-1", sessionKind: "qr", assurance: "live-admin-qr", expiresAt: 1, capabilities: ["dashboard:read"] };
  const seen = [];
  const dependencies = {
    readProfile: async (input) => { seen.push(["profile", input]); return { ok: true, profile: { restaurantId, name: profile.name, slug: "maison-elyse" } }; },
    readMenu: async (input) => { seen.push(["menu", input]); return { ok: true, menu: { restaurantId, menuId, status: "published", settingsJson: { defaultLocale: "fr-CA", supportedLocales: ["fr-CA", "en-CA"] } } }; },
    readQr: async (input) => { seen.push(["qr", input]); return { ok: true, rows: [{ restaurantId, id: "qr-1", status: "active" }] }; },
    readDishes: async (input) => { seen.push(["dishes", input]); return { ok: true, rows: [{ restaurantId, menuId, ...dish() }] }; },
    readTranslations: async (input) => { seen.push(["translations", input]); return { ok: true, rows: [{ restaurantId, menuId, dishId: "dish-1", locale: "en-CA", status: "up_to_date" }] }; }
  };
  const result = await loadMoreQualityDataWithDependencies({ access, bundle, locale: "fr" }, dependencies);
  assert.equal(result.ok, true);
  assert.deepEqual(seen.map((entry) => entry[1]), [
    { restaurantId }, { restaurantId, menuId }, { restaurantId, qrId: "qr-1" },
    { restaurantId, menuId }, { restaurantId, menuId }
  ]);
  assert.equal(result.model.photos.kind, "ready");

  const foreign = await loadMoreQualityDataWithDependencies({ access, bundle, locale: "fr" }, {
    ...dependencies,
    readDishes: async () => ({ ok: true, rows: [{ restaurantId: "foreign", menuId, ...dish() }] })
  });
  assert.deepEqual(foreign, { ok: false, error: { code: "scope-integrity", retryable: false } });
});

test("the route composes validated access, Data Foundation and the scoped Quality loader", async () => {
  const source = await readFile(new URL("../app/(fr)/admin/more/page.tsx", import.meta.url), "utf8");
  assert.match(source, /requireAdminRestaurantAccess\(["']dashboard:read["']\)/);
  assert.match(source, /loadAdminDataBundle\(/);
  assert.match(source, /loadMoreQualityData\(/);
  assert.match(source, /activeRoute=["']more["']/);
  assert.match(source, /restaurantId=\{dataResult\.presentation\.restaurantId\}/);
  assert.doesNotMatch(source, /searchParams|[?&]restaurantId=|[?&]menuId=|getSupabase|\.from\(/);
});

test("the Quality page exposes honest named regions and a safe support mail link", async () => {
  const source = await readFile(new URL("../components/admin/more/AdminMoreQualityPage.tsx", import.meta.url), "utf8");
  for (const component of ["QualityStatusGrid", "QrHealthPanel", "ContentReadinessPanel", "ExperienceEvidencePanel", "RestaurantProfileCard", "CompletionIssuesPanel", "SupportPanel"]) {
    assert.match(source, new RegExp(`<${component}\\b`));
  }
  assert.match(source, /mailto:contact@vistaire\.ca/);
  assert.doesNotMatch(source, /scans? en temps réel|taux de succès|excellent|7j\/7|ticket|SLA/i);
});

test("the repository is allowlisted, scoped and never reads synthetic operations data", async () => {
  const source = await readFile(new URL("../lib/admin/more/repository.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /select\(["']\*["']\)|internal_notes?|personal_contact|support_tickets?|incidents?/i);
  assert.match(source, /restaurant_id:\s*input\.restaurantId/);
  assert.match(source, /menu_id:\s*input\.menuId/);
  assert.match(source, /id,name,slug,location,cuisine_type,contact_phone,contact_email/);
  assert.match(source, /image_url,has_immersive_view,allergens,allergen_declarations,metadata/);
  assert.doesNotMatch(source, /image_url,model3d_url|has_immersive_view,ingredients/);
  assert.match(source, /allergen_declarations/);
  assert.match(source, /normalizeAllergenData\(row\.allergen_declarations/);
  assert.doesNotMatch(source, /allergens\.length\s*>\s*0\s*\?\s*["']declared/);
});

test("legacy empty allergen arrays never prove that allergen review is complete", async () => {
  const source = await readFile(new URL("../lib/admin/more/repository.ts", import.meta.url), "utf8");
  assert.match(source, /allergenData\.source === ["']structured["'][\s\S]*!allergenData\.reviewRequired[\s\S]*allergenData\.declarations\.length === ALLERGEN_REGISTRY\.length/);
  const model = build({ dishes: { ok: true, items: [dish({ allergenStatus: "unknown" })] } });
  assert.deepEqual(model.allergens, { kind: "partial", completed: 0, total: 1 });
  assert.equal(model.completionIssues.some((issue) => issue.kind === "allergens-unknown"), true);
});

test("translation issues carry stable dish and locale identities for React keys", () => {
  const model = build({
    menu: { status: "published", defaultLocale: "fr-CA", supportedLocales: ["fr-CA", "en-CA", "es"] },
    translations: { ok: true, rows: [] }
  });
  const missing = model.completionIssues.filter((issue) => issue.kind === "translation-missing");
  assert.deepEqual(missing.map((issue) => [issue.dishId, issue.locale]), [["dish-1", "en-CA"], ["dish-1", "es"]]);
});

test("More-Quality Playwright proof is hermetic, assertion-bearing and unskipped", async () => {
  const source = await readFile(new URL("../e2e/admin-vnext-more-quality.spec.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /test\.skip|test\.fixme|describe\.skip|VISTAIRE_ADMIN_E2E_QR_TOKEN/);
  assert.match(source, /target\.origin !== appOrigin && target\.origin !== fixtureOrigin/);
  assert.match(source, /route\.abort\(["']blockedbyclient["']\)/);
  assert.match(source, /page\.routeWebSocket\(/);
  for (const viewport of ["390", "430", "768", "1448"]) assert.match(source, new RegExp(viewport));
  assert.match(source, /expect\(/);
});

test("the seven canonical Admin proofs contain assertions and no conditional escape hatch", async () => {
  const canonicalSpecs = [
    "admin-vnext-today.spec.ts",
    "admin-vnext-availability.spec.ts",
    "admin-insights.spec.ts",
    "admin-insights-fidelity.spec.ts",
    "admin-vnext-assistant.spec.ts",
    "admin-vnext-reports.spec.ts",
    "admin-vnext-more-quality.spec.ts"
  ];
  assert.equal(canonicalSpecs.length, 7);
  for (const file of canonicalSpecs) {
    const source = await readFile(new URL(`../e2e/${file}`, import.meta.url), "utf8");
    assert.match(source, /expect\(/, `${file} must assert`);
    assert.doesNotMatch(source, /VISTAIRE_ADMIN_E2E_QR_TOKEN|test\.skip|test\.fixme|describe\.skip|if\s*\([^)]*\)\s*\{\s*\}/, `${file} must not escape the gate`);
  }
});
