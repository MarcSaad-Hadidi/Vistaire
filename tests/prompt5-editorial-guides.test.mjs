import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const expectedGuides = [
  {
    key: "premium-menu-anatomy",
    locale: "fr",
    path: "/guides/anatomie-menu-digital-premium",
    alternatePath: "/en/guides/premium-digital-menu-anatomy"
  },
  {
    key: "premium-menu-anatomy",
    locale: "en",
    path: "/en/guides/premium-digital-menu-anatomy",
    alternatePath: "/guides/anatomie-menu-digital-premium"
  },
  {
    key: "mobile-qr-without-app",
    locale: "fr",
    path: "/guides/menu-qr-mobile-sans-application",
    alternatePath: "/en/guides/mobile-qr-menu-without-app"
  },
  {
    key: "mobile-qr-without-app",
    locale: "en",
    path: "/en/guides/mobile-qr-menu-without-app",
    alternatePath: "/guides/menu-qr-mobile-sans-application"
  },
  {
    key: "restaurant-3d-decision",
    locale: "fr",
    path: "/guides/3d-restaurant-utile-vs-gadget",
    alternatePath: "/en/guides/restaurant-3d-useful-vs-gimmick"
  },
  {
    key: "restaurant-3d-decision",
    locale: "en",
    path: "/en/guides/restaurant-3d-useful-vs-gimmick",
    alternatePath: "/guides/3d-restaurant-utile-vs-gadget"
  }
];

test("publishes six substantial localized editorial guides with unique metadata", async () => {
  const modulePath = join(process.cwd(), "lib", "editorialGuides.ts");
  assert.equal(existsSync(modulePath), true, "lib/editorialGuides.ts must exist");

  const { EDITORIAL_GUIDES, EDITORIAL_GUIDE_ROUTE_PAIRS } = await import(
    "../lib/editorialGuides.ts"
  );
  assert.equal(EDITORIAL_GUIDES.length, 6);
  assert.deepEqual(
    EDITORIAL_GUIDE_ROUTE_PAIRS.map(({ fr, en }) => ({ fr, en })),
    [
      {
        fr: "/guides/anatomie-menu-digital-premium",
        en: "/en/guides/premium-digital-menu-anatomy"
      },
      {
        fr: "/guides/menu-qr-mobile-sans-application",
        en: "/en/guides/mobile-qr-menu-without-app"
      },
      {
        fr: "/guides/3d-restaurant-utile-vs-gadget",
        en: "/en/guides/restaurant-3d-useful-vs-gimmick"
      }
    ]
  );
  assert.deepEqual(
    EDITORIAL_GUIDES.map(({ key, locale, path, alternatePath }) => ({
      key,
      locale,
      path,
      alternatePath
    })),
    expectedGuides
  );

  assert.equal(new Set(EDITORIAL_GUIDES.map((guide) => guide.metadataTitle)).size, 6);
  assert.equal(
    new Set(EDITORIAL_GUIDES.map((guide) => guide.metadataDescription)).size,
    6
  );

  for (const guide of EDITORIAL_GUIDES) {
    assert.ok(guide.metadataTitle.length >= 30 && guide.metadataTitle.length <= 65);
    assert.ok(
      guide.metadataDescription.length >= 120 &&
        guide.metadataDescription.length <= 170,
      `${guide.path} needs a useful search description`
    );
    assert.ok(guide.dek.length >= 120, `${guide.path} needs a substantive opening`);
    assert.ok(guide.sections.length >= 6, `${guide.path} needs complete topic coverage`);
    assert.ok(guide.checklist.items.length >= 6, `${guide.path} needs a practical checklist`);
    assert.ok(guide.relatedPaths.length >= 3, `${guide.path} needs useful internal links`);
    assert.ok(guide.relatedPaths.every((path) => path.startsWith("/")));
    assert.ok(!guide.relatedPaths.includes(guide.path));

    const serialized = JSON.stringify(guide);
    assert.doesNotMatch(serialized, /\b\d+(?:[.,]\d+)?\s*%/);
    assert.doesNotMatch(
      serialized,
      /résultats? garantis?|guaranteed results?|zero risk|sans aucun risque/i
    );
    assert.doesNotMatch(serialized, /author|datePublished|dateModified/);
  }
});

test("gives each editorial topic its own composition variant", async () => {
  const presentationSource = await readFile(
    join(process.cwd(), "components", "guides", "editorialGuidePresentation.ts"),
    "utf8"
  );
  const variants = [...presentationSource.matchAll(/guideVariant:\s*"([^"]+)"/g)].map(
    ([, variant]) => variant
  );

  assert.deepEqual(variants, ["anatomy", "journey", "decision"]);
  assert.equal(new Set(variants).size, variants.length);
});

test("registers exact reciprocal canonical, hreflang and sitemap pairs", async () => {
  const { buildPageAlternates, getLocalizedPath } = await import("../lib/i18n.ts");
  const { buildSitemapEntries } = await import("../lib/seo.ts");
  const entries = buildSitemapEntries([], new Date("2026-08-09T00:00:00.000Z"), {
    NEXT_PUBLIC_SITE_URL: "https://www.vistaire.ca"
  });
  const sitemapPaths = new Set(
    entries.map((entry) => new URL(entry.url).pathname || "/")
  );

  for (const expected of expectedGuides) {
    const frPath = expected.locale === "fr" ? expected.path : expected.alternatePath;
    const enPath = expected.locale === "en" ? expected.path : expected.alternatePath;
    assert.deepEqual(buildPageAlternates(expected.path), {
      canonical: expected.path,
      languages: {
        "fr-CA": frPath,
        "en-CA": enPath,
        "x-default": frPath
      }
    });
    assert.equal(
      getLocalizedPath(expected.path, expected.locale === "fr" ? "en" : "fr"),
      expected.alternatePath
    );
    assert.equal(sitemapPaths.has(expected.path), true, `${expected.path} must be indexed`);
    const sitemapEntry = entries.find(
      (entry) => new URL(entry.url).pathname === expected.path
    );
    assert.ok(sitemapEntry);
    assert.equal(
      "lastModified" in sitemapEntry,
      false,
      `${expected.path} must omit an unverified editorial date`
    );
  }
});

test("builds an honest Article graph without invented author or date fields", async () => {
  const { getEditorialGuide } = await import("../lib/editorialGuides.ts");
  const { buildArticleJsonLd } = await import("../lib/seo.ts");
  const guide = getEditorialGuide("premium-menu-anatomy", "en");
  const article = buildArticleJsonLd({
    path: guide.path,
    headline: guide.h1,
    description: guide.metadataDescription,
    locale: guide.locale
  }, {
    NEXT_PUBLIC_SITE_URL: "https://www.vistaire.ca"
  });

  assert.deepEqual(article, {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": "https://www.vistaire.ca/en/guides/premium-digital-menu-anatomy#article",
    url: "https://www.vistaire.ca/en/guides/premium-digital-menu-anatomy",
    headline: "The anatomy of a premium digital restaurant menu",
    description: guide.metadataDescription,
    inLanguage: "en-CA",
    mainEntityOfPage: {
      "@id": "https://www.vistaire.ca/en/guides/premium-digital-menu-anatomy#webpage"
    },
    publisher: {
      "@id": "https://www.vistaire.ca/#organization"
    }
  });
  assert.equal("author" in article, false);
  assert.equal("datePublished" in article, false);
  assert.equal("dateModified" in article, false);
});

test("keeps bilingual guide routes lightweight for shared client imports", async () => {
  const routeModulePath = join(process.cwd(), "lib", "editorialGuideRoutes.ts");
  assert.equal(existsSync(routeModulePath), true, "lightweight guide route module must exist");

  const [routeSource, i18nSource, footerSource] = await Promise.all([
    readFile(routeModulePath, "utf8"),
    readFile(join(process.cwd(), "lib", "i18n.ts"), "utf8"),
    readFile(
      join(process.cwd(), "components", "vistaire-preview", "VistairePreviewChrome.tsx"),
      "utf8"
    )
  ]);

  assert.doesNotMatch(routeSource, /sections|paragraphs|checklist/);
  assert.match(i18nSource, /from\s+["']\.\/editorialGuideRoutes\.ts["']/);
  assert.doesNotMatch(i18nSource, /from\s+["']\.\/editorialGuides\.ts["']/);
  assert.match(footerSource, /@\/lib\/editorialGuideRoutes/);
  assert.doesNotMatch(footerSource, /@\/lib\/editorialGuides/);
});

test("lists every published editorial guide in llms.txt", async () => {
  const { EDITORIAL_GUIDE_ROUTE_PAIRS } = await import(
    "../lib/editorialGuideRoutes.ts"
  );
  const llms = await readFile(join(process.cwd(), "public", "llms.txt"), "utf8");

  for (const pair of EDITORIAL_GUIDE_ROUTE_PAIRS) {
    for (const path of [pair.fr, pair.en]) {
      assert.match(llms, new RegExp(`https://www\\.vistaire\\.ca${path.replaceAll("/", "\\/")}(?:\\s|:)`));
    }
  }
});
