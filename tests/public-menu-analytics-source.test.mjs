import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function assertTrouvableAnalyticsCaller(source) {
  assert.match(
    source,
    /trackPublicMenuEvent\(\s*menu\s*,\s*\{[^}]*\beventName\s*:\s*"dish_3d_clicked"[^}]*\}\s*\)/
  );
  assert.match(
    source,
    /<TrouvableImmersivePanelBody\b[^>]*\smenu\s*=\s*\{menu\}/
  );
}

function assertSharedTrouvableViewerAnalytics(source) {
  assert.match(
    source,
    /<ModelViewerComponent\b[^>]*\sanalyticsContext\s*=\s*\{getPublicMenuAnalyticsContext\(\s*menu\s*\)\s*\?\?\s*undefined\}/
  );
}

test("Maison Elyse detail preserves relational analytics for dish and immersive events", async () => {
  const source = await readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8");
  assert.match(source, /getPublicMenuAnalyticsContext\(menu\)/);
  assert.match(
    source,
    /trackPublicMenuEvent\(menu,\s*\{\s*eventName:\s*"dish_opened",\s*dishSlug:\s*dish\.slug,\s*categorySlug:\s*dish\.categorySlug\s*\?\?\s*slugify\(dish\.category\)\s*\}\)/
  );
  assert.match(source, /analyticsContext=\{analyticsContext \?\? undefined\}/);
  assert.match(source, /function slugify\([\s\S]*normalize\("NFD"\)[\s\S]*replace\(\/\[\^a-z0-9\]\+\/g,\s*"-"\)/);
});

test("generic and Trouvable renderers keep production context on immersive viewers", async () => {
  const [genericSource, detailSource, menuSource, sharedSurfaceSource] = await Promise.all([
    readFile("components/menu/PublicDishDetailExperience.tsx", "utf8"),
    readFile("components/menu/TrouvableDishDetailExperience.tsx", "utf8"),
    readFile("components/menu/TrouvablePremiumMenuExperience.tsx", "utf8"),
    readFile("components/menu/TrouvableDishDetailSurface.tsx", "utf8")
  ]);

  assert.match(genericSource, /getPublicMenuAnalyticsContext\(menu\)/);
  assert.match(genericSource, /dish_3d_clicked/);
  assertTrouvableAnalyticsCaller(detailSource);
  assertTrouvableAnalyticsCaller(menuSource);
  assertSharedTrouvableViewerAnalytics(sharedSurfaceSource);

  for (const source of [
    `const eventName = "dish_3d_clicked";
     <TrouvableImmersivePanelBody menu={menu} />`,
    `trackPublicMenuEvent(menu, { eventName: "dish_3d_clicked" });
     <TrouvableImmersivePanelBodyCard menu={menu} />`,
    `trackPublicMenuEvent(menu, { eventName: "dish_3d_clicked" });
     <TrouvableImmersivePanelBody dish={dish} />
     <OtherPanel menu={menu} />`
  ]) {
    assert.throws(() => assertTrouvableAnalyticsCaller(source));
  }

  for (const source of [
    `<ModelViewerComponentCard analyticsContext={getPublicMenuAnalyticsContext(menu) ?? undefined} />`,
    `<ModelViewerComponent dish={dish} />
     <OtherViewer analyticsContext={getPublicMenuAnalyticsContext(menu) ?? undefined} />`
  ]) {
    assert.throws(() => assertSharedTrouvableViewerAnalytics(source));
  }
});
