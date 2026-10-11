import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("public FAQs share the official ReUI rotating-arrow composition with native SSR disclosure", () => {
  const faq = read("components/seo/SeoFaq.tsx");
  const item = read("components/seo/SeoFaqItem.tsx");
  assert.match(faq, /Accordion/);
  assert.match(item, /ChevronRightIcon/);
  assert.match(item, /flex-row-reverse.*justify-end.*gap-3/);
  assert.match(item, /group-aria-expanded\/accordion-trigger:rotate-90/);
  assert.match(faq, /<details/);
  assert.match(faq, /<summary/);
  assert.match(faq, /useSyncExternalStore/);
  assert.equal((faq.match(/<FaqAsk\b/g) ?? []).length, 1);
  const pricing = read("components/immersive/Pricing.jsx");
  assert.match(pricing, /<SeoFaq/);
  assert.doesNotMatch(pricing, /<FaqAsk|<details/);
});
