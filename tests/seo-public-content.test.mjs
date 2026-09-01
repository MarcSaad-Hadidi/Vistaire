import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "./pricing-table-estimator.test.mjs";

const PUBLIC_SEO_COPY_TARGETS = [
  "components/seo/SeoGeoAeoPage.tsx",
  "components/seo/pages/TarifsMenuDigitalRestaurantPage.tsx",
  "lib/seoGeoPages.ts",
  "lib/seoGeoPages.fr.ts",
  "lib/seoGeoPages.en.ts",
  "public/llms.txt"
];

const FORBIDDEN_VISIBLE_COPY = [
  /FAQ SEO\/GEO/i,
  /SEO\/GEO FAQ/i,
  /\bnew pages\b/i,
  /\bnouvelles pages\b/i,
  /SEO dead end/i,
  /cul-de-sac SEO/i,
  /search engines and AI assistants/i,
  /moteurs de recherche et les assistants IA/i,
  /moteurs génératifs/i,
  /guest shows intent/i,
  /intention du client/i,
  /hreflang cassé/i,
  /connect this intent/i,
  /relier cette intention/i
];

function readTarget(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("targeted public SEO/GEO copy avoids internal rollout jargon", () => {
  const failures = [];

  for (const file of PUBLIC_SEO_COPY_TARGETS) {
    const lines = readTarget(file).split(/\r?\n/);

    for (const forbidden of FORBIDDEN_VISIBLE_COPY) {
      lines.forEach((line, index) => {
        if (forbidden.test(line)) {
          failures.push(`${file}:${index + 1} matches ${forbidden}: ${line.trim()}`);
        }
      });
    }
  }

  assert.deepEqual(failures, []);
});

test("public crawler guidance stays product-facing, not strategy-facing", () => {
  const llms = readTarget("public/llms.txt");

  assert.match(llms, /Vistaire/);
  assert.match(llms, /premium digital menu service/i);
  assert.doesNotMatch(llms, /SEO\/GEO|AEO|doorway|intent matrix|planned registry/i);
  assert.doesNotMatch(llms, /guaranteed ROI|first page rankings|ranking promise/i);
});
