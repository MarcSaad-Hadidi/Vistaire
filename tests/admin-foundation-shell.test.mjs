import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("AdminShellState exposes four localized states with exact live-region semantics", async () => {
  const state = await read("components/admin/system/AdminShellState.tsx");
  assert.match(state, /export type AdminShellStateKind = "loading" \| "empty" \| "error" \| "forbidden"/);
  for (const copy of [
    "Chargement en cours", "Votre espace restaurant se prépare.", "Loading", "Your restaurant workspace is getting ready.",
    "Aucun élément", "Aucun contenu n’est disponible pour le moment.", "Nothing here yet", "No content is available right now.",
    "Impossible de charger", "Réessayez dans quelques instants.", "Unable to load", "Try again in a moment.",
    "Accès requis", "Utilisez votre accès restaurant pour continuer.", "Access required", "Use your restaurant access to continue."
  ]) assert.match(state, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(state, /role=\{kind === "error" \|\| kind === "forbidden" \? "alert" : "status"\}/);
  assert.match(state, /aria-busy=\{kind === "loading" \? true : undefined\}/);
  assert.match(state, /\{action \? <div[^>]*>\{action\}<\/div> : null\}/);
});

test("admin loading delegates to the localized generic state", async () => {
  const loading = await read("app/admin/loading.tsx");
  assert.match(loading, /await headers\(\)/);
  assert.match(loading, /readAdminPreferencesFromHeaders/);
  assert.match(loading, /<AdminShellState kind="loading" locale=\{preferences\.locale\}/);
});

test("public presentation primitives remain client-safe and imported directly by previews", async () => {
  const presentation = await read("components/admin/system/AdminPresentationPrimitives.tsx");
  for (const name of ["AdminPanel", "AdminKpiCard", "AdminEvidenceState", "AdminStatusBadge", "AdminTooltip", "AdminToggle", "AdminToast", "AdminSkeleton"]) {
    assert.match(presentation, new RegExp(`export function ${name}\\b`));
  }
  assert.doesNotMatch(presentation, /next\/headers|server-only|lib\/admin\/preferences/);
  for (const path of [
    "components/vistaire-preview/RestaurateurDashboardDemo.tsx",
    "components/vistaire-preview/RestaurateurPreviewOverview.tsx",
    "components/vistaire-preview/RestaurateurPreviewAvailability.tsx",
    "components/vistaire-preview/RestaurateurPreviewInsights.tsx"
  ]) {
    assert.match(await read(path), /@\/components\/admin\/system\/AdminPresentationPrimitives/);
  }
});
