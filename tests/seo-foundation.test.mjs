import test from "node:test";
import assert from "node:assert/strict";

import {
  INTERNAL_ROBOTS_DISALLOW,
  SITE_URL_FALLBACK,
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildRobotsRules,
  buildSitemapEntries,
  buildVistaireServiceJsonLd,
  buildWebsiteJsonLd,
  getSiteUrl,
  resolveSiteUrl
} from "../lib/seo.ts";

const siteEnv = {
  NEXT_PUBLIC_SITE_URL: "https://www.vistaire.ca/"
};

test("resolves canonical production URLs with a stable Vistaire fallback", () => {
  assert.equal(SITE_URL_FALLBACK, "https://www.vistaire.ca");
  assert.equal(resolveSiteUrl("vistaire.ca").origin, "https://vistaire.ca");
  assert.equal(getSiteUrl(siteEnv).origin, "https://www.vistaire.ca");
  assert.equal(
    absoluteUrl("/demo/dishes/homard-bisque", siteEnv),
    "https://www.vistaire.ca/demo/dishes/homard-bisque"
  );
});

test("builds a focused sitemap for public Vistaire surfaces", () => {
  const lastModified = new Date("2026-05-18T00:00:00.000Z");
  const entries = buildSitemapEntries(
    [{ slug: "homard-bisque" }, { slug: "ravioles-romarin" }],
    lastModified,
    siteEnv
  );
  const urls = entries.map((entry) => entry.url);

  assert.deepEqual(urls, [
    "https://www.vistaire.ca/",
    "https://www.vistaire.ca/demo",
    "https://www.vistaire.ca/demo/dishes/homard-bisque",
    "https://www.vistaire.ca/demo/dishes/ravioles-romarin",
    "https://www.vistaire.ca/admin"
  ]);
  for (const internalPath of ["/owner", "/sign-in", "/todos", "/api/"]) {
    assert.equal(urls.some((url) => url.includes(internalPath)), false);
  }
  assert.equal(entries.every((entry) => entry.lastModified === lastModified), true);
  assert.equal(entries.every((entry) => entry.priority > 0 && entry.priority <= 1), true);
});

test("allows useful crawlers while keeping internal surfaces out of robots crawl", () => {
  const rules = buildRobotsRules();
  const searchBotRule = rules.find((rule) => rule.userAgent === "OAI-SearchBot");
  const defaultRule = rules.find((rule) => rule.userAgent === "*");
  const expectedInternalDisallow = [
    "/api/",
    "/owner",
    "/owner/",
    "/sign-in",
    "/sign-in/",
    "/todos",
    "/todos/"
  ];

  assert.ok(searchBotRule);
  assert.ok(defaultRule);
  assert.deepEqual(searchBotRule.allow, "/");
  assert.deepEqual(defaultRule.allow, "/");
  assert.deepEqual(INTERNAL_ROBOTS_DISALLOW, expectedInternalDisallow);
  for (const internalPath of expectedInternalDisallow) {
    assert.equal(INTERNAL_ROBOTS_DISALLOW.includes(internalPath), true);
  }
  assert.deepEqual(searchBotRule.disallow, INTERNAL_ROBOTS_DISALLOW);
  assert.deepEqual(defaultRule.disallow, INTERNAL_ROBOTS_DISALLOW);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/_next/"), false);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/images/"), false);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/models/"), false);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/videos/"), false);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/frames/"), false);
});

test("emits honest global JSON-LD without fictional restaurant markup", () => {
  const organization = buildOrganizationJsonLd(siteEnv);
  const website = buildWebsiteJsonLd(siteEnv);
  const service = buildVistaireServiceJsonLd(siteEnv);
  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: "Accueil", path: "/" },
      { name: "Menu client exemple", path: "/demo" }
    ],
    siteEnv
  );

  assert.equal(organization["@type"], "Organization");
  assert.equal(website["@type"], "WebSite");
  assert.equal(service["@type"], "Service");
  assert.equal(breadcrumb["@type"], "BreadcrumbList");
  assert.equal(service.provider["@id"], organization["@id"]);
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.item),
    ["https://www.vistaire.ca/", "https://www.vistaire.ca/demo"]
  );

  const serialized = JSON.stringify([
    organization,
    website,
    service,
    breadcrumb
  ]);
  assert.equal(serialized.includes('"@type":"Restaurant"'), false);
  assert.equal(serialized.includes('"@type":"LocalBusiness"'), false);
  assert.equal(serialized.includes('"@type":"MenuItem"'), false);
  assert.equal(serialized.includes("AggregateRating"), false);
  assert.equal(serialized.includes("Review"), false);
});
