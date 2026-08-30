import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const REQUIRED_NAMED_FILES = Object.freeze({
  fr: [
    "app/(fr)/page.tsx",
    "app/(fr)/a-propos/page.tsx",
    "app/(fr)/contact/page.tsx",
    "app/(fr)/prendre-rendez-vous/page.tsx",
    "app/(fr)/(seo)/menu-digital-restaurant/page.tsx",
    "app/(fr)/(seo)/menu-pdf-vs-menu-digital/page.tsx",
    "app/(fr)/(seo)/menu-qr-code-restaurant/page.tsx",
    "app/(fr)/(seo)/menu-3d-ar-restaurant/page.tsx",
    "app/(fr)/(seo)/tarifs-menu-digital-restaurant/page.tsx",
    "app/(fr)/guides/anatomie-menu-digital-premium/page.tsx",
    "app/(fr)/guides/menu-qr-mobile-sans-application/page.tsx",
    "app/(fr)/guides/3d-restaurant-utile-vs-gadget/page.tsx",
    "app/(fr)/apercu-restaurateur/page.tsx"
  ],
  en: [
    "app/(en)/en/page.tsx",
    "app/(en)/en/about/page.tsx",
    "app/(en)/en/contact/page.tsx",
    "app/(en)/en/book-a-call/page.tsx",
    "app/(en)/en/digital-restaurant-menu/page.tsx",
    "app/(en)/en/pdf-vs-digital-menu/page.tsx",
    "app/(en)/en/qr-code-restaurant-menu/page.tsx",
    "app/(en)/en/3d-ar-restaurant-menu/page.tsx",
    "app/(en)/en/pricing-digital-restaurant-menu/page.tsx",
    "app/(en)/en/guides/premium-digital-menu-anatomy/page.tsx",
    "app/(en)/en/guides/mobile-qr-menu-without-app/page.tsx",
    "app/(en)/en/guides/restaurant-3d-useful-vs-gimmick/page.tsx",
    "app/(en)/en/restaurant-preview/page.tsx"
  ]
});

const DYNAMIC_EXCEPTIONS = Object.freeze([
  "app/(fr)/(geo)/[slug]/page.tsx",
  "app/(en)/en/(geo)/[slug]/page.tsx",
  "app/(fr)/demo/page.tsx",
  "app/(en)/en/vistaire-menu/page.tsx",
  "app/(fr)/legacy/[...slug]/page.tsx",
  "app/(fr)/q/invalid/page.tsx",
  "app/(fr)/sign-in/[[...sign-in]]/page.tsx"
]);

async function source(file) {
  return readFile(file, "utf8");
}

function countMatches(value, pattern) {
  return value.match(pattern)?.length ?? 0;
}

function findRobotsProducers(directory) {
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRobotsProducers(entryPath));
    } else if (
      entry.name === "robots.ts" ||
      entryPath.replaceAll("\\", "/").endsWith("/robots.txt/route.ts")
    ) {
      results.push(entryPath.replaceAll("\\", "/"));
    }
  }
  return results.sort();
}

test("all 26 named static public pages live under their locale document roots", () => {
  assert.equal(REQUIRED_NAMED_FILES.fr.length, 13);
  assert.equal(REQUIRED_NAMED_FILES.en.length, 13);
  for (const [locale, files] of Object.entries(REQUIRED_NAMED_FILES)) {
    for (const file of files) assert.equal(existsSync(file), true, `${locale}: ${file}`);
  }
});

test("FR and EN roots own literal request-independent documents", async () => {
  assert.equal(existsSync("app/layout.tsx"), false);
  assert.equal(existsSync("app/(fr)/page.tsx"), true);
  assert.equal(existsSync("app/(en)/en/page.tsx"), true);
  const fr = await source("app/(fr)/layout.tsx");
  const en = await source("app/(en)/layout.tsx");
  for (const documentSource of [fr, en]) {
    assert.match(documentSource, /<html/);
    assert.match(documentSource, /<body/);
    assert.doesNotMatch(documentSource, /\b(headers|cookies|connection|draftMode)\s*\(/);
    assert.doesNotMatch(
      documentSource,
      /next\/headers|VISTAIRE_LOCALE_HEADER|VISTAIRE_ROUTE_THEME_HEADER/
    );
  }
  assert.match(fr, /lang="fr-CA"/);
  assert.match(en, /lang="en-CA"/);
});

test("the shared shell owns each global document concern exactly once", async () => {
  const shell = await source("components/layout/VistaireDocumentShell.tsx");

  assert.equal(countMatches(shell, /className="skip-link"/g), 1);
  assert.equal(countMatches(shell, /<JsonLd\b/g), 1);
  assert.equal(countMatches(shell, /<WebMcpProvider\s*\/>/g), 1);
  assert.equal(countMatches(shell, /<MicrosoftClarity>/g), 1);
  assert.equal(countMatches(shell, /id="contenu"/g), 1);
  assert.match(shell, /buildOrganizationJsonLd\(\)/);
  assert.match(shell, /buildProfessionalServiceJsonLd\(\)/);
  assert.match(shell, /buildWebsiteJsonLd\(undefined, locale\)/);
  assert.match(shell, /locale === "en" \? "Skip to content" : "Aller au contenu"/);
});

test("intentional dynamic surfaces keep explicit route guards", async () => {
  for (const file of DYNAMIC_EXCEPTIONS) {
    assert.match(
      await source(file),
      /export const dynamic\s*=\s*["']force-dynamic["']/,
      file
    );
  }

  for (const file of DYNAMIC_EXCEPTIONS.slice(0, 2)) {
    assert.doesNotMatch(await source(file), /generateStaticParams/, file);
  }
});

test("the text route remains the sole robots producer", () => {
  assert.deepEqual(findRobotsProducers("app"), ["app/robots.txt/route.ts"]);
});
