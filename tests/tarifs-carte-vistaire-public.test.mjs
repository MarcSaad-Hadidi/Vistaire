import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PUBLIC_FILES_FOR_THIS_TASK = [
  "app/(seo)/tarifs-menu-digital-restaurant/page.tsx",
  "app/sitemap.ts",
  "components/landing/GuidesVistaireSection.tsx",
  "components/seo/pages/TarifsMenuDigitalRestaurantPage.tsx",
  "lib/pricingPage.ts",
  "public/llms.txt"
];

const FORBIDDEN_PUBLIC_TERMS = [
  "demo",
  "Demo",
  "démo",
  "Démo",
  "démonstration",
  "démonstratif",
  "fictif",
  "fictive"
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

test("pricing public surfaces exist without forbidden public wording", () => {
  for (const file of PUBLIC_FILES_FOR_THIS_TASK) {
    const absolutePath = join(process.cwd(), file);
    assert.equal(existsSync(absolutePath), true, `${file} should exist`);
    const content = readWorkspaceFile(file);
    const publicCopy = content.replaceAll("/demo", "");
    for (const term of FORBIDDEN_PUBLIC_TERMS) {
      assert.equal(
        publicCopy.includes(term),
        false,
        `${file} should not contain forbidden term: ${term}`
      );
    }
  }
});

test("pricing data answers the required commercial questions", async () => {
  const {
    PRICING_PAGE,
    PRICING_PATH,
    SAMPLE_MENU_PATH,
    buildPricingPageJsonLd
  } = await import("../lib/pricingPage.ts");

  assert.equal(PRICING_PATH, "/tarifs-menu-digital-restaurant");
  assert.equal(SAMPLE_MENU_PATH, "/demo");
  assert.equal(
    PRICING_PAGE.h1,
    "Tarifs Vistaire : menu digital premium avec plats 3D inclus"
  );
  assert.deepEqual(PRICING_PAGE.primaryCta, {
    label: "Parler de votre menu",
    href: "/prendre-rendez-vous"
  });
  assert.deepEqual(PRICING_PAGE.secondaryCta, {
    label: "Voir le menu exemple",
    href: "/demo"
  });

  assert.deepEqual(
    PRICING_PAGE.plans.map((plan) => ({
      name: plan.name,
      menuDishLimit: plan.menuDishLimit,
      included3dDishCount: plan.included3dDishCount,
      setupPrice: plan.setupPrice,
      monthlyPrice: plan.monthlyPrice
    })),
    [
      {
        name: "Vistaire Base",
        menuDishLimit: 40,
        included3dDishCount: 5,
        setupPrice: "950 $ CAD setup",
        monthlyPrice: "125 $ CAD / mois"
      },
      {
        name: "Vistaire Premium",
        menuDishLimit: 60,
        included3dDishCount: 10,
        setupPrice: "1 450 $ CAD setup",
        monthlyPrice: "169 $ CAD / mois"
      },
      {
        name: "Vistaire Signature",
        menuDishLimit: 100,
        included3dDishCount: 20,
        setupPrice: "2 500 $ CAD setup",
        monthlyPrice: "249 $ CAD / mois"
      }
    ]
  );

  assert.equal(PRICING_PAGE.plans.find((plan) => plan.recommended)?.name, "Vistaire Premium");
  assert.equal(PRICING_PAGE.threeDPacks.length, 4);
  assert.equal(PRICING_PAGE.faq.length >= 12, true);
  assert.equal(
    PRICING_PAGE.faq.some((item) => item.question === "Est-ce que les plats 3D sont inclus ?"),
    true
  );

  const jsonLd = buildPricingPageJsonLd();
  const jsonLdTypes = collectJsonLdTypes(jsonLd);
  assert.deepEqual(
    ["WebPage", "Service", "OfferCatalog", "FAQPage", "BreadcrumbList"].every((type) =>
      jsonLdTypes.includes(type)
    ),
    true
  );
  assert.equal(JSON.stringify(jsonLd).includes("AggregateRating"), false);
  assert.equal(JSON.stringify(jsonLd).includes("Review"), false);
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
