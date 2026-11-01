import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("circular reveal keeps nested menu controls usable and can be unlocked with Escape", async () => {
  const [reveal, styles] = await Promise.all([
    source("components/vistaire-preview/VistairePdfToDigitalHoverReveal.tsx"),
    source("components/vistaire-preview/VistairePdfToDigitalHoverReveal.module.css")
  ]);

  assert.match(reveal, /digitalLayer\?: ReactNode/);
  assert.match(reveal, /event\.key === "Escape"/);
  assert.match(reveal, /setLocked\(false\)/);
  assert.match(reveal, /data-reveal-locked/);
  assert.match(reveal, /role=\{locked \? "group" : "button"\}/);
  assert.match(reveal, /event\.target !== event\.currentTarget/);
  assert.match(reveal, /nestedControl/);
  assert.match(reveal, /aria-hidden=\{!locked\}/);
  assert.match(reveal, /inert=\{!locked\}/);
  assert.match(reveal, /onClick=\{onClick\}/);
  assert.match(reveal, /touchAction: "pan-y pinch-zoom"/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});
