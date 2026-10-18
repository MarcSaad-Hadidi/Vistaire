import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dishes restore the approved availability summary and five-metric row", async () => {
  const source = await readFile(
    "components/admin/studio/StudioDishes.tsx",
    "utf8",
  );
  assert.match(source, /data-studio-availability-summary/);
  assert.match(source, /data\.menu\.dishes\.filter\(available\)\.length/);
  assert.match(source, /onClick=\{onPlanning\}/);
  assert.match(source, /Voir le planning/);
  assert.match(source, /<dt>\{t\("Évolution"\)\}<\/dt>/);
  assert.match(source, /Part des vues/);
  assert.match(source, /<select[\s\S]*?aria-label=\{t\("Disponibilité"\)\}/);
  const css = await readFile(
    "components/admin/studio/StudioDishes.module.css",
    "utf8",
  );
  assert.match(css, /font:\s*42px var\(--serif\)/);
  assert.match(
    css,
    /grid-template-columns:\s*24px minmax\(170px,\s*1fr\) minmax\(270px,\s*1\.4fr\) minmax\(\s*200px,\s*1fr\s*\)/,
  );
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
});

test("dishes show only complete known view shares and preserve real read-only mutations", async () => {
  const source = await readFile(
    "components/admin/studio/StudioDishes.tsx",
    "utf8",
  );
  assert.match(source, /data\.menu\.dishes\.every\(/);
  assert.match(source, /totalViews\s*!=\s*null\s*&&\s*totalViews\s*>\s*0/);
  assert.match(source, /stats\?\.changeRate\s*==\s*null/);
  assert.match(source, /disabled=\{pending \|\| !canWrite\}/);
  assert.match(source, /resolveAvailabilityForSource/);
  assert.match(
    source,
    /\/admin\/api\/dishes\/\$\{encodeURIComponent\(dish.id\)\}\/availability/,
  );
  assert.match(source, /result\.dishId !== dish\.id/);
  assert.doesNotMatch(
    source,
    /Model\.|NOW|localStorage|Math\.random|2026-10-10/,
  );
});

test("dish rows describe manual precedence only when scheduling readiness is known", async () => {
  const source = await readFile("components/admin/studio/StudioDishes.tsx", "utf8");
  assert.doesNotMatch(source, /Automatic scheduling is not connected|Planification automatique non connectée/);
  assert.match(source, /data.schedulingStatus === "available"/);
  assert.match(source, /A manual change takes priority over schedules/);
  assert.match(source, /Une modification manuelle prime sur les horaires/);
});
