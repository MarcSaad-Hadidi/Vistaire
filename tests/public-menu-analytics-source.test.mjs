import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  const [genericSource, trouvableSource, sharedSurfaceSource] = await Promise.all([
    readFile("components/menu/PublicDishDetailExperience.tsx", "utf8"),
    readFile("components/menu/TrouvableDishDetailExperience.tsx", "utf8"),
    readFile("components/menu/TrouvableDishDetailSurface.tsx", "utf8")
  ]);

  assert.match(genericSource, /getPublicMenuAnalyticsContext\(menu\)/);
  assert.match(genericSource, /dish_3d_clicked/);
  assert.match(trouvableSource, /eventName:\s*"dish_3d_clicked"/);
  assert.match(
    trouvableSource,
    /<TrouvableImmersivePanelBody[\s\S]*?menu=\{menu\}[\s\S]*?\/>/
  );
  assert.match(
    sharedSurfaceSource,
    /<ModelViewerComponent[\s\S]*?analyticsContext=\{getPublicMenuAnalyticsContext\(menu\) \?\? undefined\}[\s\S]*?\/>/
  );
});
