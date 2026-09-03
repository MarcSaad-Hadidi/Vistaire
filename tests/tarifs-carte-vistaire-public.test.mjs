import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PUBLIC_FILES_FOR_THIS_TASK = [
  "app/(fr)/(seo)/tarifs-menu-digital-restaurant/page.tsx",
  "app/(en)/en/pricing-digital-restaurant-menu/page.tsx",
  "components/seo/pages/TarifsMenuDigitalRestaurantPage.tsx",
  "components/vistaire-preview/VistairePricingPreview.tsx",
  "components/vistaire-preview/VistairePricingPreview.module.css",
  "components/vistaire-preview/PricingLaunchWorkflow.tsx",
  "components/vistaire-preview/PricingPageExtensions.module.css",
  "lib/pricingPage.ts",
  "public/images/pricing/vistaire-acrylique.jpg",
  "public/images/pricing/vistaire-sculpte.jpg",
  "public/images/pricing/vistaire-carre.png",
  "public/images/pricing/vistaire-signature.jpg"
];

const EXPECTED_COLLECTIONS = [
  ["acrylique", "Vistaire Acrylique", 2_000],
  ["sculpte", "Vistaire Sculpté", 2_050],
  ["carre", "Vistaire Carré", 2_100],
  ["signature", "Vistaire Signature", 2_200]
];

const EXPECTED_COLLECTION_IMAGES = [
  "/images/pricing/vistaire-acrylique.jpg",
  "/images/pricing/vistaire-sculpte.jpg",
  "/images/pricing/vistaire-carre.png",
  "/images/pricing/vistaire-signature.jpg"
];

const LEGACY_PRICING_TERMS = [
  "Vistaire Base",
  "950 $ CAD setup",
  "125 $ CAD / mois",
  "1 450 $ CAD setup",
  "169 $ CAD / mois",
  "2 500 $ CAD setup",
  "249 $ CAD / mois",
  "$950 CAD",
  "$125 CAD / month",
  "$1,450 CAD",
  "$169 CAD / month",
  "$2,500 CAD",
  "$249 CAD / month"
];

function readWorkspaceFile(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function collectJsonLdTypes(value, types = []) {
  if (!value || typeof value !== "object") return types;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdTypes(item, types);
    return types;
  }

  const type = value["@type"];
  if (typeof type === "string") types.push(type);
  if (Array.isArray(type)) {
    for (const item of type) {
      if (typeof item === "string") types.push(item);
    }
  }
  for (const child of Object.values(value)) collectJsonLdTypes(child, types);
  return types;
}

function findJsonLdType(value, targetType) {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findJsonLdType(item, targetType);
      if (match) return match;
    }
    return undefined;
  }
  if (value["@type"] === targetType) return value;
  for (const child of Object.values(value)) {
    const match = findJsonLdType(child, targetType);
    if (match) return match;
  }
  return undefined;
}

test("pricing public routes share one bilingual production surface", () => {
  for (const file of PUBLIC_FILES_FOR_THIS_TASK) {
    assert.equal(existsSync(join(process.cwd(), file)), true, `${file} should exist`);
  }
});

test("pricing exposes four physical collections and Pilotage as an add-on", async () => {
  const {
    PRICING_PAGE,
    PRICING_PATH,
    SAMPLE_MENU_PATH
  } = await import("../lib/pricingPage.ts");

  assert.equal(PRICING_PATH, "/tarifs-menu-digital-restaurant");
  assert.equal(SAMPLE_MENU_PATH, "/demo");
  assert.equal(
    PRICING_PAGE.h1,
    "Choisissez l’expérience qui prendra place sur vos tables."
  );
  assert.deepEqual(
    PRICING_PAGE.collections.map(({ id, name, setupAmount }) => [id, name, setupAmount]),
    EXPECTED_COLLECTIONS
  );
  assert.deepEqual(
    PRICING_PAGE.collections.map(({ image }) => image),
    EXPECTED_COLLECTION_IMAGES
  );
  assert.equal(PRICING_PAGE.monthlyAmount, 200);
  assert.equal(PRICING_PAGE.pilotage.monthlyAmount, 100);
  assert.equal(PRICING_PAGE.pilotage.totalMonthlyAmount, 300);
  assert.match(PRICING_PAGE.pilotage.body, /gérer la disponibilité de vos plats/);
  assert.doesNotMatch(PRICING_PAGE.pilotage.body, /gérer votre menu/);
  assert.equal(PRICING_PAGE.collections.filter(({ featured }) => featured).length, 1);
  assert.equal(PRICING_PAGE.collections.find(({ featured }) => featured)?.id, "signature");
  assert.equal(PRICING_PAGE.includedGroups.flatMap(({ items }) => items).length, 15);
  assert.deepEqual(PRICING_PAGE.finalCta.primary, {
    label: "Prendre rendez-vous",
    href: "/prendre-rendez-vous"
  });
});

test("pricing publishes final 3D add-ons, on-site photography and launch terms", async () => {
  const { PRICING_PAGE, PRICING_PAGE_EN } = await import("../lib/pricingPage.ts");
  const frenchIncluded = PRICING_PAGE.includedGroups.flatMap(({ items }) => items);
  const localizedPricing = JSON.stringify([PRICING_PAGE, PRICING_PAGE_EN]);

  assert.match(
    frenchIncluded.join("\n"),
    /Prise de photos des plats sur place par Vistaire/
  );
  assert.match(frenchIncluded.join("\n"), /Jusqu’à 20 supports QR personnalisés/);
  assert.match(frenchIncluded.join("\n"), /Jusqu’à 5 plats en 3D/);

  assert.deepEqual(
    PRICING_PAGE.threeDAddOns.packs.map(({ quantity, priceAmount }) => [
      quantity,
      priceAmount
    ]),
    [[5, 149], [10, 249], [20, 449]]
  );
  assert.equal(PRICING_PAGE.threeDAddOns.individualMinAmount, 35);
  assert.equal(PRICING_PAGE.threeDAddOns.individualMaxAmount, 50);
  assert.match(PRICING_PAGE.threeDAddOns.individualPrice, /35 à 50 \$ CAD/);
  assert.match(PRICING_PAGE.threeDAddOns.replacementNote, /nouvelle production facturable/);
  assert.match(
    PRICING_PAGE.threeDAddOns.replacementNote,
    /défectueux imputable à Vistaire n’est pas traitée comme une nouvelle production/
  );
  assert.doesNotMatch(localizedPricing, /3D[^.]{0,100}sur devis/i);
  assert.doesNotMatch(localizedPricing, /3D[^.]{0,100}quoted separately/i);

  assert.deepEqual(
    PRICING_PAGE.workflow.steps.map(({ title }) => title),
    [
      "Prise de photos & préparation",
      "Création des maquettes",
      "Validation du restaurant",
      "Production",
      "Mise en ligne"
    ]
  );
  const approvalIndex = PRICING_PAGE.workflow.steps.findIndex(
    ({ title }) => title === "Validation du restaurant"
  );
  const productionIndex = PRICING_PAGE.workflow.steps.findIndex(
    ({ title }) => title === "Production"
  );
  assert.equal(approvalIndex >= 0 && approvalIndex < productionIndex, true);
  assert.match(PRICING_PAGE.workflow.leadTime, /environ deux semaines/);
  assert.doesNotMatch(PRICING_PAGE.workflow.leadTime, /garanti|garantie/i);

  const terms = PRICING_PAGE.commercialTerms.items.join("\n");
  assert.match(terms, /dollars canadiens/);
  assert.match(terms, /taxes en sus/);
  assert.match(terms, /100 % avant le début du projet/);
  assert.match(terms, /Engagement initial de 12 mois/);
  assert.match(terms, /débute à l’activation du service/);
  assert.match(terms, /reste fixe pendant la période initiale de 12 mois/);
  assert.match(terms, /communiquées au renouvellement/);

  for (const forbidden of [
    /Pilotage gratuit/i,
    /Pilotage offert/i,
    /Pilotage[^.]{0,80}100\s*%\s*(?:de )?rabais/i,
    /(?:gratuit|offert)[^.]{0,80}Pilotage/i
  ]) {
    assert.doesNotMatch(localizedPricing, forbidden);
  }
});

test("pricing launch workflow is progressively enhanced and reduced-motion safe", () => {
  const workflow = readWorkspaceFile(
    "components/vistaire-preview/PricingLaunchWorkflow.tsx"
  );
  const styles = readWorkspaceFile(
    "components/vistaire-preview/PricingPageExtensions.module.css"
  );

  assert.match(workflow, /IntersectionObserver/);
  assert.match(workflow, /prefers-reduced-motion: reduce/);
  assert.match(workflow, /<ol/);
  assert.match(workflow, /<li/);
  assert.doesNotMatch(workflow, /requestAnimationFrame|addEventListener\(["']scroll/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /transform:\s*scaleX/);
  assert.match(styles, /transform:\s*scaleY/);
});

test("French and English pricing stay commercially equivalent", async () => {
  const { PRICING_PAGE, PRICING_PAGE_EN } = await import("../lib/pricingPage.ts");

  assert.equal(
    PRICING_PAGE_EN.h1,
    "Choose the experience that belongs on your tables."
  );
  assert.deepEqual(
    PRICING_PAGE_EN.collections.map(({ id, setupAmount }) => [id, setupAmount]),
    EXPECTED_COLLECTIONS.map(([id, , setupAmount]) => [id, setupAmount])
  );
  assert.deepEqual(
    PRICING_PAGE_EN.collections.map(({ image }) => image),
    PRICING_PAGE.collections.map(({ image }) => image)
  );
  assert.equal(PRICING_PAGE_EN.monthlyAmount, PRICING_PAGE.monthlyAmount);
  assert.equal(
    PRICING_PAGE_EN.pilotage.totalMonthlyAmount,
    PRICING_PAGE.pilotage.totalMonthlyAmount
  );
  assert.deepEqual(
    PRICING_PAGE_EN.threeDAddOns.packs.map(({ priceAmount }) => priceAmount),
    PRICING_PAGE.threeDAddOns.packs.map(({ priceAmount }) => priceAmount)
  );
  assert.equal(
    PRICING_PAGE_EN.threeDAddOns.individualMinAmount,
    PRICING_PAGE.threeDAddOns.individualMinAmount
  );
  assert.equal(
    PRICING_PAGE_EN.threeDAddOns.individualMaxAmount,
    PRICING_PAGE.threeDAddOns.individualMaxAmount
  );
  assert.equal(
    PRICING_PAGE_EN.workflow.steps.length,
    PRICING_PAGE.workflow.steps.length
  );
  assert.equal(
    PRICING_PAGE_EN.commercialTerms.items.length,
    PRICING_PAGE.commercialTerms.items.length
  );
  assert.match(PRICING_PAGE_EN.pilotage.body, /manage dish availability/);
  assert.doesNotMatch(PRICING_PAGE_EN.pilotage.body, /manage your menu/);
  assert.deepEqual(PRICING_PAGE_EN.finalCta.primary, {
    label: "Book a call",
    href: "/en/book-a-call"
  });
  assert.doesNotMatch(
    `${PRICING_PAGE.finalCta.primary.label} ${PRICING_PAGE_EN.finalCta.primary.label}`,
    /démo|demo/i
  );

  const localizedPricing = JSON.stringify([PRICING_PAGE, PRICING_PAGE_EN]);
  for (const term of LEGACY_PRICING_TERMS) {
    assert.equal(localizedPricing.includes(term), false, `legacy pricing should be absent: ${term}`);
  }
});

test("structured data publishes four collections, 3D pricing and keeps Pilotage separate", async () => {
  const { buildPricingPageJsonLd } = await import("../lib/pricingPage.ts");

  for (const locale of ["fr", "en"]) {
    const jsonLd = buildPricingPageJsonLd(undefined, locale);
    const jsonLdTypes = collectJsonLdTypes(jsonLd);
    const catalog = findJsonLdType(jsonLd, "OfferCatalog");
    const service = findJsonLdType(jsonLd, "Service");

    assert.deepEqual(
      ["WebPage", "Service", "OfferCatalog", "BreadcrumbList"].every((type) =>
        jsonLdTypes.includes(type)
      ),
      true
    );
    assert.equal(jsonLdTypes.includes("FAQPage"), false);
    assert.equal(catalog.itemListElement.length, 4);
    assert.deepEqual(
      catalog.itemListElement.map(({ priceSpecification }) =>
        priceSpecification.map(({ price }) => price)
      ),
      [[2_000, 200], [2_050, 200], [2_100, 200], [2_200, 200]]
    );

    const serialized = JSON.stringify(jsonLd);
    assert.match(serialized, /Pilotage/);
    assert.match(serialized, /149/);
    assert.match(serialized, /249/);
    assert.match(serialized, /449/);
    assert.match(serialized, /35/);
    assert.match(serialized, /50/);
    assert.match(
      JSON.stringify(service.additionalProperty),
      /On-site dish photography|Prise de photos des plats sur place/
    );
    assert.equal(serialized.includes("AggregateRating"), false);
    assert.equal(serialized.includes("Review"), false);
    assert.equal(serialized.includes("Vistaire Base"), false);
    assert.equal(serialized.includes("Vistaire Premium"), false);
    assert.doesNotMatch(serialized, /Pilotage gratuit|Pilotage offert/i);
  }
});

test("public sitemap and AI guide include pricing but not the removed card route", async () => {
  const { buildSitemapEntries } = await import("../lib/seo.ts");
  const llms = readWorkspaceFile("public/llms.txt");
  const sitemapUrls = buildSitemapEntries(
    [],
    new Date("2026-01-01T00:00:00.000Z")
  )
    .map((entry) => entry.url)
    .join("\n");

  assert.match(sitemapUrls, /\/tarifs-menu-digital-restaurant/);
  assert.doesNotMatch(sitemapUrls, /\/carte-vistaire/);
  assert.match(llms, /https:\/\/www\.vistaire\.ca\/tarifs-menu-digital-restaurant/);
  assert.doesNotMatch(llms, /https:\/\/www\.vistaire\.ca\/carte-vistaire/);
});

test("removed public card route permanently redirects to the sample menu", async () => {
  const { default: nextConfig } = await import("../next.config.ts");
  const redirects = await nextConfig.redirects?.();

  assert.deepEqual(
    redirects?.find((redirect) => redirect.source === "/carte-vistaire"),
    {
      source: "/carte-vistaire",
      destination: "/demo",
      permanent: true
    }
  );
});
