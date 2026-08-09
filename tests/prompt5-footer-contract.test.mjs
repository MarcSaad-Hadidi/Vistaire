import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("shared footer exposes the five bilingual navigation groups with real guide and local destinations", async () => {
  const chrome = await source(
    "components/vistaire-preview/VistairePreviewChrome.tsx"
  );

  for (const heading of [
    '"Produit"',
    '"Product"',
    '"Guides"',
    '"Besoins"',
    '"Solutions"',
    '"Local"',
    '"Contact"'
  ]) {
    assert.ok(chrome.includes(heading), `missing footer heading ${heading}`);
  }

  assert.match(
    chrome,
    /import\s+\{\s*getEditorialGuides\s*\}\s+from\s+["']@\/lib\/editorialGuides["']/,
    "footer guide destinations must come from the typed editorial registry"
  );
  assert.match(
    chrome,
    /getEditorialGuides\(locale\)\.map/,
    "footer must derive the localized guide links instead of copying slugs"
  );
  assert.doesNotMatch(
    chrome,
    /href:\s*["']\/(?:en\/)?guides\//,
    "footer must not duplicate guide paths locally"
  );

  const localSlugs = chrome.match(
    /const localGeoSlugs(?:En)? = \[([\s\S]*?)\] as const;/g
  );
  assert.equal(localSlugs?.length, 2, "footer must define one local inventory per locale");
  for (const inventory of localSlugs ?? []) {
    assert.match(inventory, /montreal/);
    assert.match(inventory, /laval/);
    assert.match(inventory, /brossard/);
    assert.doesNotMatch(inventory, /haut-de-gamme|gastronomique|high-end|fine-dining/);
  }

  assert.doesNotMatch(chrome, /href\s*=\s*["'](?:#|)["']/);
});

test("Guides footer region has the same accessible name as its visible heading", async () => {
  const chrome = await source(
    "components/vistaire-preview/VistairePreviewChrome.tsx"
  );
  const guideSection = chrome.match(
    /<section\s+className=\{`\$\{styles\.footerColumn\} \$\{styles\.footerColumnWide\}`\}([\s\S]*?)<\/section>/
  )?.[0];

  assert.ok(guideSection, "shared Guides region must remain identifiable");
  assert.match(guideSection, /aria-label="Guides"/);
  assert.match(guideSection, /<h2>Guides<\/h2>/);
  assert.doesNotMatch(guideSection, /Resources|Ressources/);
});

test("digital-menu final CTA keeps one sample-menu action without repeating it in the adjacent internal links", async () => {
  const preview = await source(
    "components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.tsx"
  );

  assert.match(
    preview,
    /className=\{styles\.secondaryButton\}[\s\S]{0,160}href=\{routes\.menu\}/,
    "the strategic final sample-menu button must remain"
  );
  const internalLinks = preview.match(
    /const pageInternalLinks = \[([\s\S]*?)\];/
  )?.[1];
  assert.ok(internalLinks, "final internal-link inventory must remain explicit");
  assert.doesNotMatch(
    internalLinks,
    /href:\s*routes\.menu\b/,
    "the adjacent internal row must not repeat the sample-menu button"
  );
  assert.match(internalLinks, /href:\s*routes\.pdfVsDigital\b/);
  assert.match(internalLinks, /href:\s*routes\.contact\b/);
});

test("mobile footer uses one column and footer links have 44px targets", async () => {
  const styles = await source(
    "components/vistaire-preview/VistairePreviewChrome.module.css"
  );
  const mobile = styles.match(/@media \(max-width: 520px\) \{([\s\S]*)$/)?.[1];

  assert.ok(mobile, "mobile footer breakpoint must exist");
  assert.match(
    mobile,
    /\.previewFooter,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/
  );
  assert.match(
    mobile,
    /\.footerLinkList a,[\s\S]*?min-height:\s*44px/,
    "footer links need an explicit mobile touch target"
  );
});
