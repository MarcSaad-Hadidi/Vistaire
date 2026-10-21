import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = stripTypeScriptTypes(readFileSync(new URL("../lib/owner/restaurantPreparation.ts", import.meta.url), "utf8"))
  .replace("@/lib/menu/uniqueMenuDesign", new URL("../lib/menu/uniqueMenuDesign.ts", import.meta.url).href);
const { buildOwnerPreparationSummary } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("owner USDZ count excludes Android GLBs and unknown aggregate readiness", () => {
  const restaurant = { dishCount: 4, immersiveDishCount: 4, photoDishCount: 0 };
  const dish = { category: "Plats", priceLabel: "20 $", description: "Plat", hasImmersive: true };
  const summary = buildOwnerPreparationSummary(restaurant, [
    { ...dish, webModel3dUrl: "/web.glb", model3dUrl: "/web.glb" },
    { ...dish, arModel3dUrl: "/ar-lite.glb" },
    { ...dish, arUsdzUrl: "/ios.usdz", usdzUrl: "/ios.usdz" },
    { ...dish, usdzUrl: "/legacy.usdz" }
  ]);
  assert.equal(summary.webModelCount, 1);
  assert.equal(summary.arModelCount, 2);
  assert.equal(buildOwnerPreparationSummary(restaurant).arModelCount, 0);
});
