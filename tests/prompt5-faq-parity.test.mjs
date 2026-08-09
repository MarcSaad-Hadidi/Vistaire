import assert from "node:assert/strict";
import test from "node:test";

import { buildFaqPageJsonLd } from "../lib/seo.ts";
import { SEO_PAGES, SEO_PAGES_EN } from "../lib/seoPages.ts";

const REQUIRED_PAGES = [
  {
    path: "/menu-pdf-vs-menu-digital",
    pages: SEO_PAGES,
    count: 6,
    topics: [
      /PDF.*menu digital|menu digital.*PDF/i,
      /mobile|zoom/i,
      /QR/i,
      /mise à jour|modifier|change|export|statique/i,
      /acceptable|adapté/i,
      /transition|migr|progress/i
    ]
  },
  {
    path: "/en/pdf-vs-digital-menu",
    pages: SEO_PAGES_EN,
    count: 6,
    topics: [
      /PDF.*digital menu|digital menu.*PDF/i,
      /mobile|zoom/i,
      /QR/i,
      /update|change|static/i,
      /acceptable|suitable/i,
      /transition|migr|gradual/i
    ]
  },
  {
    path: "/menu-digital-restaurant",
    pages: SEO_PAGES,
    count: 8,
    topics: [
      /service|table/i,
      /navigateur|application/i,
      /QR/i,
      /mise à jour|modifier/i,
      /photo|visuel/i,
      /allerg/i,
      /3D|AR|immers/i,
      /sélect|signature/i
    ]
  },
  {
    path: "/en/digital-restaurant-menu",
    pages: SEO_PAGES_EN,
    count: 8,
    topics: [
      /service|table/i,
      /browser|app/i,
      /QR/i,
      /update|change/i,
      /photo|visual/i,
      /allerg/i,
      /3D|AR|immers/i,
      /select|signature/i
    ]
  }
];

const normalize = (value) => value.replace(/\s+/g, " ").trim();

function pageFor({ path, pages }) {
  const page = pages.find((candidate) => candidate.path === path);
  assert.ok(page, `missing SEO page data for ${path}`);
  return page;
}

function faqNodes(value) {
  if (Array.isArray(value)) return value.flatMap(faqNodes);
  if (!value || typeof value !== "object") return [];

  return [
    ...(value["@type"] === "FAQPage" ? [value] : []),
    ...faqNodes(value["@graph"])
  ];
}

test("the four FAQ inventories cover their route-specific objections in both locales", () => {
  for (const requirement of REQUIRED_PAGES) {
    const page = pageFor(requirement);
    const searchableItems = page.faq.map(({ question, answer }) =>
      normalize(`${question} ${answer}`)
    );

    assert.equal(page.faq.length, requirement.count, `${requirement.path} FAQ count`);
    for (const topic of requirement.topics) {
      assert.ok(
        searchableItems.some((item) => topic.test(item)),
        `${requirement.path} must answer ${topic}`
      );
    }

    for (const { question, answer } of page.faq) {
      assert.ok(normalize(question).length > 0, `${requirement.path} has an empty question`);
      assert.ok(normalize(answer).length > 0, `${requirement.path} has an empty answer`);
      assert.doesNotMatch(
        `${question} ${answer}`,
        /\b(guarantee[sd]?|instant(?:ly)?|automatic(?:ally)?|garanti(?:e|t|s)?|instantané(?:e)?|automatique(?:ment)?)\b/i,
        `${requirement.path} contains an unsupported promise`
      );
    }
  }
});

test("PDF-comparison and digital-menu FAQs do not duplicate wording", () => {
  for (const [pages, locale] of [
    [SEO_PAGES, "fr"],
    [SEO_PAGES_EN, "en"]
  ]) {
    const pdf = pageFor({ path: locale === "fr" ? "/menu-pdf-vs-menu-digital" : "/en/pdf-vs-digital-menu", pages });
    const digital = pageFor({ path: locale === "fr" ? "/menu-digital-restaurant" : "/en/digital-restaurant-menu", pages });
    const pdfText = new Set(
      pdf.faq.flatMap(({ question, answer }) => [normalize(question).toLocaleLowerCase(locale), normalize(answer).toLocaleLowerCase(locale)])
    );

    for (const { question, answer } of digital.faq) {
      assert.equal(pdfText.has(normalize(question).toLocaleLowerCase(locale)), false);
      assert.equal(pdfText.has(normalize(answer).toLocaleLowerCase(locale)), false);
    }
  }
});

test("the FAQPage builder emits exact source parity for every required route", () => {
  for (const requirement of REQUIRED_PAGES) {
    const page = pageFor(requirement);
    const faqPages = faqNodes(buildFaqPageJsonLd(page.faq, page.path));

    assert.equal(faqPages.length, 1, `${requirement.path} FAQPage count`);
    assert.equal(faqPages[0].mainEntity.length, page.faq.length);
    assert.deepEqual(
      faqPages[0].mainEntity.map((item) => normalize(item.name)),
      page.faq.map((item) => normalize(item.question))
    );
    assert.deepEqual(
      faqPages[0].mainEntity.map((item) => normalize(item.acceptedAnswer.text)),
      page.faq.map((item) => normalize(item.answer))
    );
  }
});
