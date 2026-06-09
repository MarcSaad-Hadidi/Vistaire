import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const siteEnv = {
  NEXT_PUBLIC_SITE_URL: "https://www.vistaire.ca/"
};

test("declares a complete bilingual FR/EN route map", async () => {
  const i18nPath = join(process.cwd(), "lib", "i18n.ts");
  assert.equal(existsSync(i18nPath), true, "lib/i18n.ts should centralize bilingual routes");

  const {
    BILINGUAL_ROUTE_PAIRS,
    getLocaleFromPath,
    getLocalizedPath,
    SUPPORTED_LOCALES
  } = await import("../lib/i18n.ts");

  assert.deepEqual(SUPPORTED_LOCALES, ["fr", "en"]);
  assert.deepEqual(
    BILINGUAL_ROUTE_PAIRS.map((route) => [route.fr, route.en]),
    [
      ["/", "/en"],
      ["/carte-vistaire", "/en/vistaire-menu"],
      ["/demo", "/en/vistaire-menu"],
      ["/tarifs-menu-digital-restaurant", "/en/pricing-digital-restaurant-menu"],
      ["/menu-digital-restaurant", "/en/digital-restaurant-menu"],
      ["/menu-qr-code-restaurant", "/en/qr-code-restaurant-menu"],
      ["/menu-3d-ar-restaurant", "/en/3d-ar-restaurant-menu"],
      ["/menu-pdf-vs-menu-digital", "/en/pdf-vs-digital-menu"],
      ["/a-propos", "/en/about"],
      ["/contact", "/en/contact"],
      ["/prendre-rendez-vous", "/en/book-a-call"],
      ["/apercu-restaurateur", "/en/restaurant-preview"]
    ]
  );

  assert.equal(getLocaleFromPath("/en/contact"), "en");
  assert.equal(getLocaleFromPath("/contact"), "fr");
  assert.equal(
    getLocalizedPath("/tarifs-menu-digital-restaurant", "en"),
    "/en/pricing-digital-restaurant-menu"
  );
  assert.equal(
    getLocalizedPath("/en/pricing-digital-restaurant-menu", "fr"),
    "/tarifs-menu-digital-restaurant"
  );
  assert.equal(getLocalizedPath("/unknown", "en"), "/en");
  assert.equal(getLocalizedPath("/en/unknown", "fr"), "/");
});

test("builds self-canonical hreflang metadata for both languages", async () => {
  const { buildPageAlternates } = await import("../lib/i18n.ts");

  assert.deepEqual(buildPageAlternates("/contact"), {
    canonical: "/contact",
    languages: {
      "fr-CA": "/contact",
      "en-CA": "/en/contact",
      "x-default": "/contact"
    }
  });

  assert.deepEqual(buildPageAlternates("/en/contact"), {
    canonical: "/en/contact",
    languages: {
      "fr-CA": "/contact",
      "en-CA": "/en/contact",
      "x-default": "/contact"
    }
  });
});

test("publishes bilingual sitemap entries with hreflang alternates", async () => {
  const { buildSitemapEntries } = await import("../lib/seo.ts");
  const lastModified = new Date("2026-05-18T00:00:00.000Z");
  const entries = buildSitemapEntries([], lastModified, siteEnv);
  const byPath = new Map(
    entries.map((entry) => [new URL(entry.url).pathname || "/", entry])
  );

  for (const path of [
    "/",
    "/en",
    "/contact",
    "/en/contact",
    "/prendre-rendez-vous",
    "/en/book-a-call",
    "/tarifs-menu-digital-restaurant",
    "/en/pricing-digital-restaurant-menu",
    "/menu-3d-ar-restaurant",
    "/en/3d-ar-restaurant-menu"
  ]) {
    assert.equal(byPath.has(path), true, `${path} should be in the sitemap`);
  }

  assert.deepEqual(byPath.get("/en/contact")?.alternates?.languages, {
    "fr-CA": "https://www.vistaire.ca/contact",
    "en-CA": "https://www.vistaire.ca/en/contact",
    "x-default": "https://www.vistaire.ca/contact"
  });
  assert.equal(byPath.has("/admin"), false);
  assert.equal(byPath.has("/owner"), false);
  assert.equal(byPath.has("/dev/meshy-dishes-review"), false);
  assert.equal(byPath.has("/en/demo"), false);
});

test("sets English document language from the request path", () => {
  const layoutSource = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
  const proxySource = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");

  assert.match(proxySource, /VISTAIRE_LOCALE_HEADER/);
  assert.match(layoutSource, /headers\(\)/);
  assert.match(layoutSource, /lang=\{documentLanguage\}/);
});

test("keeps dev review routes out of robots crawl", async () => {
  const { INTERNAL_ROBOTS_DISALLOW, buildRobotsTxt } = await import("../lib/seo.ts");

  for (const path of ["/dev", "/dev/", "/dev/*"]) {
    assert.equal(INTERNAL_ROBOTS_DISALLOW.includes(path), true);
    assert.match(buildRobotsTxt(siteEnv), new RegExp(`Disallow: ${path.replace("*", "\\*")}`));
  }
});
