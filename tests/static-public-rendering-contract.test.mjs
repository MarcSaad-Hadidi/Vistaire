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
