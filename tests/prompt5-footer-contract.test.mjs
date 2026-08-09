import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

const guidePaths = {
  fr: [
    "/guides/anatomie-menu-digital-premium",
    "/guides/menu-qr-mobile-sans-application",
    "/guides/3d-restaurant-utile-vs-gadget"
  ],
  en: [
    "/en/guides/premium-digital-menu-anatomy",
    "/en/guides/mobile-qr-menu-without-app",
    "/en/guides/restaurant-3d-useful-vs-gimmick"
  ]
};

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

  for (const path of [...guidePaths.fr, ...guidePaths.en]) {
    assert.ok(chrome.includes(`"${path}"`), `missing published guide ${path}`);
  }

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
