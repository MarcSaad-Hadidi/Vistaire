import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Maison Elyse detail preserves relational analytics for dish and immersive events", async () => {
  const source = await readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8");
  assert.match(source, /getPublicMenuAnalyticsContext\(menu\)/);
  assert.match(source, /trackPublicMenuEvent\(menu,[\s\S]*eventName:\s*"dish_opened"/);
  assert.match(source, /analyticsContext=\{analyticsContext \?\? undefined\}/);
});

test("generic and Trouvable renderers keep production context on immersive viewers", async () => {
  for (const file of ["components/menu/PublicDishDetailExperience.tsx", "components/menu/TrouvableDishDetailExperience.tsx"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /getPublicMenuAnalyticsContext\(menu\)/, file);
    assert.match(source, /dish_3d_clicked/, file);
  }
});
