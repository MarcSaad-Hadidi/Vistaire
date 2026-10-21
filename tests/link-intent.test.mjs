import assert from "node:assert/strict";
import test from "node:test";

const { internalDestination } = await import("../components/immersive/useLinkIntent.js");
const here = { href: "https://www.vistaire.ca/tarifs?x=1#top", origin: "https://www.vistaire.ca" };
const link = (href, extra = {}) => ({ href: new URL(href, here.href).href, target: "", hasAttribute: (name) => name in extra, ...extra });
const click = (extra = {}) => ({ button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra });

test("a plain click on another page of the site leaves for that page", () => {
  assert.equal(internalDestination(link("/a-propos"), click(), here), "/a-propos");
  assert.equal(internalDestination(link("/en/about?ref=nav#team"), click(), here), "/en/about?ref=nav");
});

test("anchors on this page, other sites, new tabs, downloads and modified clicks stay put", () => {
  assert.equal(internalDestination(link("#faq"), click(), here), null);
  assert.equal(internalDestination(link("/tarifs?x=1#faq"), click(), here), null);
  assert.equal(internalDestination(link("https://www.linkedin.com/company/vistaire"), click(), here), null);
  assert.equal(internalDestination(link("mailto:contact@vistaire.ca"), click(), here), null);
  assert.equal(internalDestination(link("/contact", { target: "_blank" }), click(), here), null);
  assert.equal(internalDestination(link("/guide.pdf", { download: "" }), click(), here), null);
  assert.equal(internalDestination(link("/contact"), click({ metaKey: true }), here), null);
  assert.equal(internalDestination(link("/contact"), click({ button: 1 }), here), null);
  assert.equal(internalDestination(link("/contact"), click({ defaultPrevented: true }), here), null);
  assert.equal(internalDestination(null, click(), here), null);
});
