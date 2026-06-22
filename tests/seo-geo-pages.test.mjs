import test from "node:test";
import assert from "node:assert/strict";

const siteEnv = {
  NEXT_PUBLIC_SITE_URL: "https://www.vistaire.ca/"
};

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

test("publishes the first SEO/GEO/AEO batch without planned doorway pages", async () => {
  const {
    PLANNED_SEO_GEO_PAGES,
    SEO_GEO_PAGES,
    SEO_GEO_PAGES_EN,
    SEARCH_INTENT_MATRIX,
    getPublishedSeoGeoPaths
  } = await import("../lib/seoGeoPages.ts");

  const paths = getPublishedSeoGeoPaths();
  const englishPaths = getPublishedSeoGeoPaths("en");

  assert.deepEqual(paths, [
    "/menu-qr-sans-pdf",
    "/menu-digital-sans-application",
    "/remplacer-menu-pdf-restaurant",
    "/alternative-menu-pdf-restaurant",
    "/fiche-plat-digitale-restaurant",
    "/menu-restaurant-photos",
    "/menu-restaurant-allergenes",
    "/menu-digital-restaurant-montreal",
    "/menu-digital-restaurant-laval",
    "/menu-digital-restaurant-brossard",
    "/menu-digital-restaurant-haut-de-gamme",
    "/menu-digital-restaurant-gastronomique"
  ]);
  assert.deepEqual(englishPaths, [
    "/en/qr-menu-without-pdf",
    "/en/digital-menu-without-app",
    "/en/replace-restaurant-pdf-menu",
    "/en/restaurant-pdf-menu-alternative",
    "/en/digital-dish-page-restaurant",
    "/en/restaurant-menu-photos",
    "/en/restaurant-menu-allergens",
    "/en/digital-restaurant-menu-montreal",
    "/en/digital-restaurant-menu-laval",
    "/en/digital-restaurant-menu-brossard",
    "/en/high-end-restaurant-digital-menu",
    "/en/fine-dining-restaurant-digital-menu"
  ]);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(new Set(englishPaths).size, englishPaths.length);
  assert.equal(SEO_GEO_PAGES.length, 12);
  assert.equal(SEO_GEO_PAGES_EN.length, 12);

  for (const planned of PLANNED_SEO_GEO_PAGES) {
    assert.equal(paths.includes(planned.path), false, `${planned.path} stays planned`);
  }

  assert.equal(
    SEARCH_INTENT_MATRIX.some(
      (entry) => entry.pageType === "planned" && entry.duplicationRisk === "high"
    ),
    true,
    "high-risk vertical/local expansion should be explicitly planned, not published"
  );
});

test("SEO/GEO/AEO pages have unique metadata, answer blocks, FAQ and CTAs", async () => {
  const { SEO_GEO_PAGES, SEO_GEO_PAGES_EN } = await import("../lib/seoGeoPages.ts");

  const titles = new Set();
  const descriptions = new Set();
  const h1s = new Set();

  for (const page of [...SEO_GEO_PAGES, ...SEO_GEO_PAGES_EN]) {
    assert.equal(page.path.endsWith(`/${page.slug}`), true, page.path);
    assert.equal(page.metadataTitle.length >= 30, true, page.path);
    assert.equal(page.metadataTitle.length <= 60, true, page.path);
    assert.equal(page.metadataDescription.length >= 120, true, page.path);
    assert.equal(page.metadataDescription.length <= 165, true, page.path);
    assert.equal(wordCount(page.directAnswer) >= 40, true, page.path);
    assert.equal(wordCount(page.directAnswer) <= 90, true, page.path);
    assert.equal(page.context.body.length >= 2, true, page.path);
    assert.equal(page.comparison.rows.length >= 3, true, page.path);
    assert.equal(page.included.length >= 6, true, page.path);
    assert.equal(page.faq.length >= 5, true, page.path);
    assert.equal(
      page.primaryCta.href,
      page.locale === "en" ? "/en/book-a-call" : "/prendre-rendez-vous",
      page.path
    );
    assert.equal(page.secondaryCta.href.length > 1, true, page.path);
    assert.equal(page.visualImage.src.startsWith("/images/demo/dishes/"), true);
    assert.equal(page.visualImage.alt.length >= 20, true);
    assert.equal(page.visualImage.alt.length <= 125, true);

    titles.add(page.metadataTitle);
    descriptions.add(page.metadataDescription);
    h1s.add(page.h1);
  }

  assert.equal(titles.size, SEO_GEO_PAGES.length + SEO_GEO_PAGES_EN.length);
  assert.equal(
    descriptions.size,
    SEO_GEO_PAGES.length + SEO_GEO_PAGES_EN.length
  );
  assert.equal(h1s.size, SEO_GEO_PAGES.length + SEO_GEO_PAGES_EN.length);
});

test("new SEO/GEO/AEO pages are bilingual, canonical and sitemap-visible", async () => {
  const { buildPageAlternates } = await import("../lib/i18n.ts");
  const { buildSitemapEntries } = await import("../lib/seo.ts");
  const { SEO_GEO_PAGES, SEO_GEO_PAGES_EN, SEO_GEO_ROUTE_PAIRS } = await import("../lib/seoGeoPages.ts");

  const lastModified = new Date("2026-06-21T00:00:00.000Z");
  const entries = buildSitemapEntries([], lastModified, siteEnv);
  const byPath = new Map(
    entries.map((entry) => [new URL(entry.url).pathname || "/", entry])
  );

  for (const routePair of SEO_GEO_ROUTE_PAIRS) {
    assert.deepEqual(buildPageAlternates(routePair.fr), {
      canonical: routePair.fr,
      languages: {
        "fr-CA": routePair.fr,
        "en-CA": routePair.en,
        "x-default": routePair.fr
      }
    });
    assert.deepEqual(buildPageAlternates(routePair.en), {
      canonical: routePair.en,
      languages: {
        "fr-CA": routePair.fr,
        "en-CA": routePair.en,
        "x-default": routePair.fr
      }
    });
    assert.equal(byPath.has(routePair.fr), true, `${routePair.fr} should be in sitemap`);
    assert.equal(byPath.has(routePair.en), true, `${routePair.en} should be in sitemap`);
    assert.equal(
      byPath.get(routePair.fr)?.alternates?.languages["en-CA"],
      `https://www.vistaire.ca${routePair.en}`
    );
    assert.equal(
      byPath.get(routePair.en)?.alternates?.languages["fr-CA"],
      `https://www.vistaire.ca${routePair.fr}`
    );
  }

  for (const page of [...SEO_GEO_PAGES, ...SEO_GEO_PAGES_EN]) {
    assert.equal(byPath.get(page.path)?.priority, page.sitemapPriority);
  }
});

test("SEO/GEO sitemap dates stay caller-controlled and stable", async () => {
  const { buildSitemapEntries } = await import("../lib/seo.ts");
  const { SEO_GEO_PAGES, SEO_GEO_PAGES_EN } = await import("../lib/seoGeoPages.ts");

  const lastModified = new Date("2026-06-21T00:00:00.000Z");
  const entries = buildSitemapEntries([], lastModified, siteEnv);
  const byPath = new Map(
    entries.map((entry) => [new URL(entry.url).pathname || "/", entry])
  );

  for (const page of [...SEO_GEO_PAGES, ...SEO_GEO_PAGES_EN]) {
    const entry = byPath.get(page.path);
    assert.ok(entry, `${page.path} should be in sitemap`);
    assert.equal(entry.lastModified, lastModified, page.path);
    assert.equal(entry.lastModified.toISOString(), "2026-06-21T00:00:00.000Z");
  }
});

test("/carte-vistaire stays a permanent redirect to the demo menu", async () => {
  const { default: nextConfig } = await import("../next.config.ts");
  const redirects = await nextConfig.redirects?.();
  const redirect = redirects?.find((entry) => entry.source === "/carte-vistaire");

  assert.ok(redirect, "/carte-vistaire redirect should be configured");
  assert.equal(redirect.destination, "/demo");
  assert.equal(redirect.permanent, true, "Next serves permanent redirects as 308");
});

test("search intent matrix records evidence status for published and planned queries", async () => {
  const {
    PLANNED_SEO_GEO_PAGES,
    SEO_GEO_PAGES,
    SEARCH_INTENT_MATRIX
  } = await import("../lib/seoGeoPages.ts");

  const publishedPaths = new Set(SEO_GEO_PAGES.map((page) => page.path));
  const plannedPaths = new Set(PLANNED_SEO_GEO_PAGES.map((page) => page.path));
  const matrixQueries = new Set();

  for (const entry of SEARCH_INTENT_MATRIX) {
    assert.equal(entry.cluster.length > 0, true);
    assert.equal(entry.naturalQueries.length >= 2, true, entry.cluster);
    assert.match(entry.target, /\S/, entry.cluster);
    assert.match(entry.contentAngle, /\S/, entry.cluster);
    assert.ok(["published", "planned", "existing-pillar"].includes(entry.pageType));
    assert.ok(["low", "medium", "high"].includes(entry.duplicationRisk));
    assert.ok(["P0", "P1", "P2"].includes(entry.priority));
    assert.ok(["medium", "high", "very-high"].includes(entry.commercialIntent));

    for (const query of entry.naturalQueries) {
      assert.equal(query.trim(), query, `${entry.cluster} query should be trimmed`);
      assert.equal(query.length >= 8, true, query);
      matrixQueries.add(query.toLowerCase());
    }

    if (entry.pageType === "published") {
      for (const target of entry.target.split("+").map((value) => value.trim())) {
        assert.equal(
          publishedPaths.has(target),
          true,
          `${entry.cluster} should point to a published SEO/GEO page`
        );
      }
    }

    if (entry.pageType === "planned") {
      assert.equal(entry.target, "planned registry");
      assert.equal(entry.duplicationRisk, "high");
      assert.equal(plannedPaths.size > 0, true);
    }
  }

  for (const page of SEO_GEO_PAGES) {
    assert.equal(
      page.queries.some((query) => matrixQueries.has(query.toLowerCase())),
      true,
      `${page.path} should have at least one query represented in the search intent matrix`
    );
  }
});

test("SEO/GEO/AEO JSON-LD is honest and mirrors visible FAQ data", async () => {
  const { buildSeoGeoAeoJsonLd } = await import("../lib/seoGeoJsonLd.ts");
  const { SEO_GEO_PAGES, SEO_GEO_PAGES_EN } = await import("../lib/seoGeoPages.ts");

  for (const page of [...SEO_GEO_PAGES, ...SEO_GEO_PAGES_EN]) {
    const jsonLd = buildSeoGeoAeoJsonLd(page);
    const serialized = JSON.stringify(jsonLd);
    const types = jsonLd.map((item) => item["@type"]);

    assert.deepEqual(types, ["WebPage", "BreadcrumbList", "Service", "FAQPage"]);
    assert.equal(jsonLd[0].url, `https://www.vistaire.ca${page.path}`);
    assert.equal(jsonLd[3].mainEntity.length, page.faq.length);
    assert.deepEqual(
      jsonLd[3].mainEntity.map((item) => item.name),
      page.faq.map((item) => item.question)
    );
    assert.equal(serialized.includes('"@type":"Restaurant"'), false);
    assert.equal(serialized.includes("AggregateRating"), false);
    assert.equal(serialized.includes("Review"), false);

    if (page.type === "local") {
      assert.equal(Array.isArray(jsonLd[2].areaServed), true, page.path);
      assert.equal(jsonLd[2].areaServed.length >= 3, true, page.path);
    }
  }
});
