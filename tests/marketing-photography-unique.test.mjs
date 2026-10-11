import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

// A translated route uses the same logical placement. Separate sections never
// reuse a photograph, including home thumbnails and dedicated pricing cards.
test("public marketing placements each own a unique existing photo and localized description", async () => {
  const { SEO_MARKETING_IMAGES, getSeoMarketingImage } = await import("../lib/seoMarketingImages.ts");
  const entries = Object.entries(SEO_MARKETING_IMAGES);
  assert.equal(entries.length, 67);
  assert.equal(new Set(entries.map(([, image]) => image.src)).size, entries.length);
  for (const [slot, image] of entries) {
    assert.ok(existsSync(new URL(`../public${image.src}`, import.meta.url)), `${slot}: ${image.src}`);
    assert.ok(image.alt.fr.length >= 20, `${slot}: French alt`);
    assert.ok(image.alt.en.length >= 20, `${slot}: English alt`);
    assert.equal(getSeoMarketingImage(slot, "fr").src, getSeoMarketingImage(slot, "en").src);
  }
  for (const slot of ["G7:hero", "G7:proof"]) {
    assert.match(getSeoMarketingImage(slot, "fr").alt, /allergène/i);
    assert.match(getSeoMarketingImage(slot, "en").alt, /allergen/i);
  }
  assert.throws(() => getSeoMarketingImage("missing:slot", "fr"), /Unknown marketing image slot/);
});
