import assert from "node:assert/strict";
import test from "node:test";

import {
  hasPageSpecificSchema,
  jsonLdPayloads
} from "../e2e/support/staticPublicRenderingContract.ts";

const PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Article"
};

test("JSON-LD extraction recognizes HTML whitespace in script end tags", () => {
  for (const whitespace of [" ", "\t", "\n", "\r", "\f"]) {
    const html = `<script type="application/ld+json">${JSON.stringify(PAGE_SCHEMA)}</script${whitespace}>`;
    assert.deepEqual(jsonLdPayloads(html), [PAGE_SCHEMA]);
  }

  const ignoredEndTagAttributes = `<script type="application/ld+json">${JSON.stringify(PAGE_SCHEMA)}</script\t\n data-ignored>`;
  assert.deepEqual(jsonLdPayloads(ignoredEndTagAttributes), [PAGE_SCHEMA]);
});

test("JSON-LD extraction does not confuse longer tag names with script end tags", () => {
  const html = `<script type="application/ld+json">${JSON.stringify(PAGE_SCHEMA)}</scripture></script>`;
  assert.throws(() => jsonLdPayloads(html), SyntaxError);
});

test("JSON-LD extraction keeps offsets stable and ignores inert pseudo-tags", () => {
  const inertPayload = JSON.stringify({ ...PAGE_SCHEMA, "@type": "Recipe" });
  const realPayload = JSON.stringify(PAGE_SCHEMA);
  const html = [
    `İ<!-- <script type="application/ld+json">${inertPayload}</script> -->`,
    `<div data-example='<script type="application/ld+json">${inertPayload}</script>'></div>`,
    `<SCRIPT type="application/ld+json">${realPayload}</SCRIPT>`
  ].join("");

  assert.deepEqual(jsonLdPayloads(html), [PAGE_SCHEMA]);
});

test("page-specific schema requires the canonical schema.org HTTPS origin", () => {
  for (const context of [
    "https://schema.org",
    "https://schema.org/",
    "https://schema.org/docs/jsonldcontext.json"
  ]) {
    assert.equal(
      hasPageSpecificSchema({ ...PAGE_SCHEMA, "@context": context }),
      true,
      `${context} should be accepted`
    );
  }

  for (const context of [
    "https://schema.org.attacker.example",
    "https://attacker.example/schema.org",
    "https://attacker-schema.org",
    "https://schema.org@attacker.example",
    "http://schema.org",
    "not-a-url-containing-schema.org"
  ]) {
    assert.equal(
      hasPageSpecificSchema({ ...PAGE_SCHEMA, "@context": context }),
      false,
      `${context} should be rejected`
    );
  }
});
