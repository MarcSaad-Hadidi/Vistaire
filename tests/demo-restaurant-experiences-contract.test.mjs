import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("demo pages share the three restaurant experiences and preserve the generic route contract", async () => {
  const [showcase, demo, english, landing] = await Promise.all([
    source("components/vistaire-preview/DemoPhoneShowcase.tsx"),
    source("app/demo/page.tsx"),
    source("app/en/vistaire-menu/page.tsx"),
    source("components/landing/VistaireLanding.tsx")
  ]);

  assert.match(showcase, /RestaurantExperienceTabs/);
  assert.match(showcase, /ActiveRestaurantMenuPreview/);
  for (const id of ["maison-elyse", "trouvable", "sauge-noire"]) {
    assert.match(showcase, new RegExp(`"${id}"`));
  }
  assert.match(showcase, /experienceFromQuery/);
  assert.match(showcase, /router\.replace/);
  assert.match(showcase, /params\.delete\("experience"\)/);
  assert.match(showcase, /window\.location\.hash/);
  assert.match(showcase, /scrollTop = 0/);
  assert.match(demo, /getLandingExperiences/);
  assert.match(english, /getLandingExperiences/);
  assert.match(landing, /<LandingHero[\s\S]*<LandingComparisonSection[\s\S]*<LandingValueSection[\s\S]*<LandingExperienceSection/);
});
