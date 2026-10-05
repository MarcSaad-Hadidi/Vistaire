import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";

registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith("/lib/contactEmails.ts")) return nextLoad(url, context);
    return { format: "module", source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText, shortCircuit: true };
  }
});
const renderer = await import("../lib/contactEmails.ts");
const data = { name: "Éloïse <script>x</script>", email: "eloise@example.com", restaurant: "Maison & Laurier", message: "Déjà reçu ?\n" + "é".repeat(1900), locale: "fr" };

test("email shell stays dark in either OS preference with paired fallbacks and no structural image dependency", () => {
  for (const locale of ["fr", "en"]) {
    for (const email of Object.values(renderer.renderContactEmails({ ...data, locale }, "2026-10-05T12:00:00.000Z"))) {
      assert.match(email.html, /name="color-scheme" content="light dark"/);
      assert.match(email.html, /name="supported-color-schemes" content="light dark"/);
      assert.match(email.html, /prefers-color-scheme:\s*dark/);
      assert.doesNotMatch(email.html, /prefers-color-scheme:\s*light/);
      assert.match(email.html, /email-ink\{background-color:#111211!important;color:#fff7ea!important/);
      for (const cell of email.html.matchAll(/<td\b[^>]*>/g)) {
        assert.match(cell[0], /bgcolor="#[0-9a-f]{6}"/i);
        assert.match(cell[0], /background-color:#[0-9a-f]{6}/i);
        assert.match(cell[0], /color:#[0-9a-f]{6}/i);
      }
      assert.doesNotMatch(email.html, /<img\b|height=["']240|height:\s*240px/i);
      assert.match(email.html, /background-image:url\('https:\/\/www.vistaire.ca\/images\/email\/vistaire-dining-header.jpg'\)/);
      const withoutImages = email.html.replace(/background-image:[^;]+;/g, "").replace(/ background="[^"]+"/g, "");
      assert.match(withoutImages, />Vistaire<\/a>/);
      assert.match(withoutImages, /href="mailto:contact@vistaire.ca"/);
      assert.doesNotMatch(withoutImages, /vistaire-dining-header/);
      assert.match(email.html, /&lt;script&gt;/);
      assert.doesNotMatch(email.html, /<script\b/i);
      assert.match(email.html, /&#8203;/);
      assert.match(email.text, /Éloïse <script>x<\/script>/);
      assert.match(email.text, /é{1900}/);
      assert.ok(Buffer.byteLength(email.html, "utf8") < 102 * 1024);
    }
  }
});

test("direct-email acknowledgement is static bilingual content in the shared shell", () => {
  assert.equal(typeof renderer.renderInboundAcknowledgement, "function");
  assert.equal(renderer.renderInboundAcknowledgement.length, 0);
  const email = renderer.renderInboundAcknowledgement();
  assert.deepEqual(Object.keys(email).sort(), ["html", "text"]);
  for (const output of [email.html, email.text]) {
    assert.match(output, /Merci/);
    assert.match(output, /Thank you/);
    assert.match(output, /Nous avons bien reçu votre message/);
    assert.match(output, /We have received your message/);
    assert.match(output, /contact@vistaire.ca/);
    assert.doesNotMatch(output, /24\s*h|48\s*h|within|Maison|restaurant/i);
  }
  assert.match(email.html, /lang="en-CA"/);
  assert.match(email.html, /name="color-scheme" content="light dark"/);
  assert.doesNotMatch(email.html, /<img\b/i);
  assert.ok(Buffer.byteLength(email.html, "utf8") < 102 * 1024);
});
