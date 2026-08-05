import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("restaurant experience tabs expose the three approved restaurants with a keyboard tab contract", async () => {
  const [registry, tabs] = await Promise.all([
    source("lib/restaurant-experiences/contracts.ts"),
    source("components/restaurant-experiences/RestaurantExperienceTabs.tsx")
  ]);

  for (const id of ["maison-elyse", "trouvable", "sauge-noire"]) {
    assert.match(registry, new RegExp(`"${id}"`));
  }
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /role="tab"/);
  assert.match(tabs, /role="tabpanel"/);
  assert.match(tabs, /aria-controls/);
  assert.match(tabs, /aria-labelledby/);
  assert.match(tabs, /ArrowLeft/);
  assert.match(tabs, /ArrowRight/);
  assert.match(tabs, /Home/);
  assert.match(tabs, /End/);
  assert.match(tabs, /Enter/);
  assert.match(tabs, /\" \"/);
  assert.match(tabs, /tabIndex=\{selected \? 0 : -1\}/);
  assert.match(tabs, /focus\(\)/);
  assert.match(tabs, /isApprovedRestaurantExperienceSet/);
});

test("active restaurant preview selects only the payload-matched renderer and has explicit non-Maison states", async () => {
  const preview = await source(
    "components/restaurant-experiences/ActiveRestaurantMenuPreview.tsx"
  );

  assert.match(preview, /MaisonElyseComparisonPreview/);
  assert.match(preview, /TrouvableComparisonPreview/);
  assert.match(preview, /SaugeNoireComparisonPreview/);
  assert.match(preview, /status="loading"/);
  assert.match(preview, /status="fallback"/);
  assert.match(preview, /status="error"/);
  assert.match(preview, /expectedExperienceId/);
  assert.match(preview, /payloadMatchesExperience/);
  assert.match(preview, /scrollTop = 0/);
  assert.match(preview, /key=\{previewKey\}/);
  assert.doesNotMatch(preview, /lib\/landing\/menuExperiences/);
  assert.doesNotMatch(preview, /import\s*\(\s*[`'"].*\$\{/);
});
