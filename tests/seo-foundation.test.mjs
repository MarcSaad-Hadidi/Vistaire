import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  INTERNAL_ROBOTS_DISALLOW,
  SITE_URL_FALLBACK,
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildOrganizationJsonLd,
  buildProfessionalServiceJsonLd,
  buildRobotsRules,
  buildRobotsTxt,
  buildSitemapEntries,
  buildVistaireServiceJsonLd,
  buildWebsiteJsonLd,
  getVistaireSocialProfiles,
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
    "https://www.vistaire.ca/en",
    "https://www.vistaire.ca/carte-vistaire",
    "https://www.vistaire.ca/en/vistaire-menu",
    "https://www.vistaire.ca/demo",
    "https://www.vistaire.ca/tarifs-menu-digital-restaurant",
    "https://www.vistaire.ca/en/pricing-digital-restaurant-menu",
    "https://www.vistaire.ca/menu-digital-restaurant",
    "https://www.vistaire.ca/en/digital-restaurant-menu",
    "https://www.vistaire.ca/menu-qr-code-restaurant",
    "https://www.vistaire.ca/en/qr-code-restaurant-menu",
    "https://www.vistaire.ca/menu-3d-ar-restaurant",
    "https://www.vistaire.ca/en/3d-ar-restaurant-menu",
    "https://www.vistaire.ca/menu-pdf-vs-menu-digital",
    "https://www.vistaire.ca/en/pdf-vs-digital-menu",
    "https://www.vistaire.ca/a-propos",
    "https://www.vistaire.ca/en/about",
    "https://www.vistaire.ca/contact",
    "https://www.vistaire.ca/en/contact",
    "https://www.vistaire.ca/prendre-rendez-vous",
    "https://www.vistaire.ca/en/book-a-call",
    "https://www.vistaire.ca/apercu-restaurateur",
    "https://www.vistaire.ca/en/restaurant-preview"
  ]);
  for (const internalPath of ["/admin", "/owner", "/sign-in", "/todos", "/api/"]) {
    assert.equal(urls.some((url) => url.includes(internalPath)), false);
  }
  assert.equal(urls.some((url) => url.includes("/demo/dishes/")), false);
  assert.equal(entries.every((entry) => entry.lastModified === lastModified), true);
  assert.equal(entries.every((entry) => entry.priority > 0 && entry.priority <= 1), true);
});

test("publishes an llms.txt guide for public AI crawlers without private claims", () => {
  const llmsPath = join(process.cwd(), "public", "llms.txt");
  assert.equal(existsSync(llmsPath), true);

  const content = readFileSync(llmsPath, "utf8");
  for (const expected of [
    "# Vistaire",
    "https://www.vistaire.ca/",
    "https://www.vistaire.ca/menu-digital-restaurant",
    "https://www.vistaire.ca/menu-qr-code-restaurant",
    "https://www.vistaire.ca/menu-3d-ar-restaurant",
    "https://www.vistaire.ca/menu-pdf-vs-menu-digital",
    "https://www.vistaire.ca/a-propos",
    "https://www.vistaire.ca/contact",
    "https://www.vistaire.ca/prendre-rendez-vous",
    "contact@vistaire.ca",
    CONTACT_PHONE_DISPLAY,
    "Montréal, Québec, Canada",
    "Do not mix Vistaire with MenuAlive or MenuVivant"
  ]) {
    assert.match(content, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const forbidden of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLERK_SECRET_KEY",
    "MISTRAL_API_KEY",
    "guaranteed ROI"
  ]) {
    assert.equal(content.includes(forbidden), false);
  }
});

test("keeps demo admin and dish detail pages out of search indexes", () => {
  const adminLayout = readFileSync(
    join(process.cwd(), "app", "admin", "layout.tsx"),
    "utf8"
  );
  const dishPage = readFileSync(
    join(process.cwd(), "app", "demo", "dishes", "[slug]", "page.tsx"),
    "utf8"
  );

  assert.match(adminLayout, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true/s);
  assert.match(dishPage, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true/s);
});

test("declares an indexable public restaurateur dashboard page", () => {
  const page = readFileSync(
    join(process.cwd(), "app", "apercu-restaurateur", "page.tsx"),
    "utf8"
  );
  const header = readFileSync(join(process.cwd(), "components", "Header.tsx"), "utf8");
  const footer = readFileSync(
    join(process.cwd(), "components", "seo", "SeoFooter.tsx"),
    "utf8"
  );

  assert.match(page, /buildPageAlternates\(canonicalPath\)/);
  assert.match(page, /openGraph:/);
  assert.match(page, /twitter:/);
  assert.match(page, /buildWebPageJsonLd/);
  assert.match(page, /buildPageServiceJsonLd/);
  assert.doesNotMatch(page, /index:\s*false/);
  assert.match(header, /href="\/apercu-restaurateur"/);
  assert.match(footer, /href:\s*"\/apercu-restaurateur"/);
});

test("landing preview footer routes restaurateur preview to the public dashboard page", () => {
  const previewChrome = readFileSync(
    join(process.cwd(), "components", "vistaire-preview", "VistairePreviewChrome.tsx"),
    "utf8"
  );

  assert.match(previewChrome, /restaurateurDashboard:\s*"\/apercu-restaurateur"/);
  assert.doesNotMatch(previewChrome, /\{\s*label:\s*"Dashboard exemple",\s*href:\s*"\/admin"\s*\}/);
  assert.doesNotMatch(previewChrome, /href="\/owner"/);
  assert.doesNotMatch(
    previewChrome,
    /footerUtilityLinks[\s\S]{0,220}Dashboard exemple/
  );
  assert.doesNotMatch(
    previewChrome,
    /\{\s*label:\s*"Aperçu restaurateur",\s*href:\s*routes\.about\s*\}/
  );
});

test("declares the focused SEO page inventory without generic scale pages", async () => {
  assert.equal(existsSync(join(process.cwd(), "lib", "seoPages.ts")), true);

  const { SEO_PAGES, getSeoPage } = await import("../lib/seoPages.ts");
  const paths = SEO_PAGES.map((page) => page.path);

  assert.deepEqual(paths, [
    "/menu-digital-restaurant",
    "/menu-qr-code-restaurant",
    "/menu-3d-ar-restaurant",
    "/menu-pdf-vs-menu-digital"
  ]);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths.some((path) => path.includes("pos")), false);
  assert.equal(paths.some((path) => path.includes("commande")), false);

  for (const page of SEO_PAGES) {
    assert.equal(typeof page.metadataTitle, "string");
    assert.equal(page.metadataTitle.length > 20, true);
    assert.equal(page.metadataDescription.length > 80, true);
    assert.equal(page.metadataDescription.length < 170, true);
    assert.equal(typeof page.cardDescription, "string");
    assert.equal(page.cardDescription.length >= 40, true);
    assert.equal(page.cardDescription.length <= 160, true);
    assert.equal(page.cardDescription.endsWith("…"), false);
    assert.equal(typeof page.relatedDescription, "string");
    assert.equal(page.relatedDescription.length >= 30, true);
    assert.equal(page.relatedDescription.length <= 140, true);
    assert.equal(page.relatedDescription.endsWith("…"), false);
    assert.equal(typeof page.takeaway?.heading, "string");
    assert.equal(typeof page.takeaway?.text, "string");
    assert.equal(page.takeaway.text.length >= 80, true);
    assert.equal(page.sections.length >= 2, true);
    assert.equal(page.faq.length >= 5, true);
    assert.equal(getSeoPage(page.slug).path, page.path);
  }
});

test("allows useful crawlers while keeping internal surfaces out of robots crawl", () => {
  const rules = buildRobotsRules();
  const defaultRule = rules.find((rule) => rule.userAgent === "*");
  const gptRule = rules.find((rule) => rule.userAgent === "GPTBot");
  const claudeRule = rules.find((rule) => rule.userAgent === "ClaudeBot");
  const expectedInternalDisallow = [
    "/api",
    "/api/",
    "/api/*",
    "/owner",
    "/owner/",
    "/owner/*",
    "/admin",
    "/admin/",
    "/admin/*",
    "/sign-in",
    "/sign-in/",
    "/sign-in/*",
    "/todos",
    "/todos/",
    "/todos/*",
    "/dev",
    "/dev/",
    "/dev/*",
    "/vistaire-preview",
    "/vistaire-preview/",
    "/vistaire-preview/*",
    "/legacy",
    "/legacy/",
    "/legacy/*"
  ];

  assert.ok(defaultRule);
  assert.ok(gptRule);
  assert.ok(claudeRule);
  assert.deepEqual(defaultRule.allow, "/");
  assert.deepEqual(gptRule.allow, "/");
  assert.deepEqual(claudeRule.allow, "/");
  assert.equal(defaultRule.contentSignal, "search=yes,ai-input=yes,ai-train=yes");
  assert.equal(gptRule.contentSignal, "search=yes,ai-input=yes,ai-train=yes");
  assert.deepEqual(INTERNAL_ROBOTS_DISALLOW, expectedInternalDisallow);
  for (const internalPath of expectedInternalDisallow) {
    assert.equal(INTERNAL_ROBOTS_DISALLOW.includes(internalPath), true);
  }
  assert.deepEqual(defaultRule.disallow, INTERNAL_ROBOTS_DISALLOW);
  assert.deepEqual(gptRule.disallow, INTERNAL_ROBOTS_DISALLOW);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/_next/"), false);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/images/"), false);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/models/"), false);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/videos/"), false);
  assert.equal(INTERNAL_ROBOTS_DISALLOW.includes("/frames/"), false);

  const robotsText = buildRobotsTxt(siteEnv);
  for (const userAgent of [
    "*",
    "GPTBot",
    "ClaudeBot",
    "CCBot",
    "Google-Extended",
    "OAI-SearchBot",
    "ChatGPT-User",
    "PerplexityBot"
  ]) {
    assert.match(robotsText, new RegExp(`User-agent: ${userAgent}`));
  }
  assert.match(robotsText, /Content-Signal: search=yes,ai-input=yes,ai-train=yes/);
  assert.match(robotsText, /Disallow: \/admin\/\*/);
  assert.match(robotsText, /Sitemap: https:\/\/www\.vistaire\.ca\/sitemap\.xml/);
});

test("emits honest global JSON-LD without fictional restaurant markup", () => {
  const organization = buildOrganizationJsonLd(siteEnv);
  const professionalService = buildProfessionalServiceJsonLd(siteEnv);
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
  assert.equal(organization.email, CONTACT_EMAIL);
  assert.equal(organization.telephone, CONTACT_PHONE_TEL);
  assert.equal(organization.contactPoint.email, CONTACT_EMAIL);
  assert.equal(organization.contactPoint.telephone, CONTACT_PHONE_TEL);
  assert.equal(organization.areaServed.length, 3);
  assert.equal("sameAs" in organization, false);
  assert.equal(professionalService["@type"], "ProfessionalService");
  assert.equal(professionalService.email, CONTACT_EMAIL);
  assert.equal(professionalService.telephone, CONTACT_PHONE_TEL);
  assert.equal(professionalService.contactPoint.telephone, CONTACT_PHONE_TEL);
  assert.equal(professionalService.address.addressLocality, "Montréal");
  assert.equal(website["@type"], "WebSite");
  assert.equal(service["@type"], "Service");
  assert.equal(breadcrumb["@type"], "BreadcrumbList");
  assert.equal(service.provider["@id"], organization["@id"]);
  assert.equal(service.url, "https://www.vistaire.ca/");
  assert.equal(service.areaServed.length, 3);
  assert.equal(service.mainEntityOfPage["@id"], "https://www.vistaire.ca/#webpage");
  assert.equal(service.hasOfferCatalog["@type"], "OfferCatalog");
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.item),
    ["https://www.vistaire.ca/", "https://www.vistaire.ca/demo"]
  );

  const serialized = JSON.stringify([
    organization,
    professionalService,
    website,
    service,
    breadcrumb
  ]);
  assert.equal(serialized.includes('"@type":"Restaurant"'), false);
  assert.equal(serialized.includes('"@type":"LocalBusiness"'), false);
  assert.equal(serialized.includes('"@type":"MenuItem"'), false);
  assert.equal(serialized.includes("AggregateRating"), false);
  assert.equal(serialized.includes("Review"), false);
  assert.equal(serialized.includes("FAQPage"), false);
});

test("reads public social profile env vars in a Next client-bundle compatible way", () => {
  const socialEnv = {
    NEXT_PUBLIC_VISTAIRE_LINKEDIN_URL: "",
    NEXT_PUBLIC_VISTAIRE_INSTAGRAM_URL: "",
    NEXT_PUBLIC_VISTAIRE_GOOGLE_BUSINESS_URL:
      "https://example.com/vistaire-public-profile",
    NEXT_PUBLIC_VISTAIRE_FACEBOOK_URL: "not-a-url",
    NEXT_PUBLIC_VISTAIRE_X_URL: ""
  };

  assert.deepEqual(getVistaireSocialProfiles(socialEnv), [
    {
      label: "Google Business Profile",
      url: "https://example.com/vistaire-public-profile"
    }
  ]);

  const seoSource = readFileSync(join(process.cwd(), "lib/seo.ts"), "utf8");
  assert.match(
    seoSource,
    /process\.env\.NEXT_PUBLIC_VISTAIRE_LINKEDIN_URL/
  );
  assert.match(
    seoSource,
    /process\.env\.NEXT_PUBLIC_VISTAIRE_INSTAGRAM_URL/
  );
  assert.doesNotMatch(seoSource, /env\[[^\]]+profile\.key[^\]]*\]/);
});

test("guide cards use hand-written descriptions without truncation", () => {
  const guidesSection = readFileSync(
    join(process.cwd(), "components", "landing", "GuidesVistaireSection.tsx"),
    "utf8"
  );
  const internalLinks = readFileSync(
    join(process.cwd(), "components", "seo", "InternalSeoLinks.tsx"),
    "utf8"
  );

  assert.equal(guidesSection.includes(".slice("), false);
  assert.equal(internalLinks.includes(".slice("), false);
  assert.match(guidesSection, /page\.cardDescription/);
  assert.match(internalLinks, /page\.relatedDescription/);
});

test("FAQPage JSON-LD mirrors visible FAQ inventory", async () => {
  const { SEO_PAGES } = await import("../lib/seoPages.ts");
  const { buildFaqPageJsonLd } = await import("../lib/seo.ts");

  for (const page of SEO_PAGES) {
    const faqJsonLd = buildFaqPageJsonLd(page.faq, page.path, siteEnv);
    assert.equal(faqJsonLd.mainEntity.length, page.faq.length);
    assert.equal(faqJsonLd.mainEntity.length >= 5, true);
    assert.deepEqual(
      faqJsonLd.mainEntity.map((item) => item.name),
      page.faq.map((item) => item.question)
    );
  }
});

test("builds WebPage and per-page Service JSON-LD with absolute URLs", async () => {
  const seo = await import("../lib/seo.ts");

  assert.equal(typeof seo.buildWebPageJsonLd, "function");
  assert.equal(typeof seo.buildPageServiceJsonLd, "function");
  assert.equal(typeof seo.buildFaqPageJsonLd, "function");

  const webPage = seo.buildWebPageJsonLd(
    {
      path: "/menu-digital-restaurant",
      name: "Menu digital restaurant premium | Vistaire",
      description:
        "Vistaire transforme le menu digital restaurant en experience premium.",
      dateModified: new Date("2026-05-19T00:00:00.000Z")
    },
    siteEnv
  );
  const servicePage = seo.buildPageServiceJsonLd(
    {
      path: "/menu-3d-ar-restaurant",
      name: "Menu 3D/AR Vistaire",
      serviceType: "Présentation 3D/AR sélective pour menus de restaurants",
      description:
        "Vues 3D/AR quand les assets et appareils le permettent, avec fallback premium."
    },
    siteEnv
  );

  assert.equal(webPage["@type"], "WebPage");
  assert.equal(webPage.url, "https://www.vistaire.ca/menu-digital-restaurant");
  assert.equal(webPage.isPartOf["@id"], "https://www.vistaire.ca/#website");
  assert.equal(webPage.publisher["@id"], "https://www.vistaire.ca/#organization");
  assert.equal(webPage.inLanguage, "fr-CA");
  assert.equal(webPage.dateModified, "2026-05-19T00:00:00.000Z");
  assert.equal(servicePage["@type"], "Service");
  assert.equal(servicePage.url, "https://www.vistaire.ca/menu-3d-ar-restaurant");
  assert.equal(servicePage.provider["@id"], "https://www.vistaire.ca/#organization");
  assert.equal(servicePage.areaServed.length, 3);
  assert.equal(servicePage.hasOfferCatalog["@type"], "OfferCatalog");

  const faqPage = buildFaqPageJsonLd(
    [
      {
        question: "Un PDF est-il un menu digital ?",
        answer: "Non. Un PDF reste un fichier statique difficile à lire sur mobile."
      }
    ],
    "/menu-pdf-vs-menu-digital",
    siteEnv
  );
  assert.equal(faqPage["@type"], "FAQPage");
  assert.equal(faqPage.mainEntity.length, 1);
  assert.equal(faqPage.mainEntity[0].name, "Un PDF est-il un menu digital ?");
});
