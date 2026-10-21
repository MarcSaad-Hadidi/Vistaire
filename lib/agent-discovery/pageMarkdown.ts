// Markdown twins of the structured public pages, served to agents that ask for
// text/markdown and concatenated in /llms-full.txt. Built from the same content
// modules as the HTML pages, so the two can never drift apart.
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_LOCATION_LABEL, SITE_NAME, absoluteUrl } from "../seo.ts";
import { SEO_PAGES, SEO_PAGES_EN, type SeoPageData } from "../seoPages.ts";
import { SEO_GEO_PAGES, SEO_GEO_PAGES_EN, type SeoGeoPageData } from "../seoGeoPages.ts";
import { EDITORIAL_GUIDES, type EditorialGuide } from "../editorialGuides.ts";
import { PRICING_PAGE, PRICING_PAGE_EN, type PricingPageContent } from "../pricingPage.ts";

const list = (items: string[] = []) => items.map((item) => `- ${item}`);
const link = (href: string, label: string) => `[${label}](${href.startsWith("http") ? href : absoluteUrl(href)})`;
const footer = (path: string) => [
  "",
  "---",
  "",
  `Source: ${absoluteUrl(path)}`,
  `${SITE_NAME} · ${CONTACT_LOCATION_LABEL} · ${CONTACT_EMAIL} · ${CONTACT_PHONE_DISPLAY}`,
];

function pillarMarkdown(page: SeoPageData) {
  return [
    `# ${page.h1}`,
    "",
    page.metadataDescription,
    "",
    ...page.answer.flatMap((paragraph) => [paragraph, ""]),
    `**${page.takeaway.heading}** ${page.takeaway.text}`,
    ...page.sections.flatMap((section) => ["", `## ${section.heading}`, "", ...section.body.flatMap((p) => [p, ""]), ...list(section.points)]),
    "",
    `## ${page.comparison.heading}`,
    "",
    `| | ${page.comparison.beforeLabel} | ${page.comparison.afterLabel} |`,
    "| --- | --- | --- |",
    ...page.comparison.rows.map((row) => `| ${row.label} | ${row.before} | ${row.after} |`),
    "",
    "## FAQ",
    ...page.faq.flatMap((item) => ["", `### ${item.question}`, "", item.answer]),
    "",
    link(page.primaryCta.href, page.primaryCta.label),
    ...footer(page.path),
  ];
}

function geoMarkdown(page: SeoGeoPageData) {
  return [
    `# ${page.h1}`,
    "",
    page.directAnswer,
    "",
    `## ${page.context.heading}`,
    "",
    ...page.context.body.flatMap((p) => [p, ""]),
    ...list(page.context.points),
    "",
    `## ${page.productProof.heading}`,
    "",
    page.productProof.body,
    "",
    ...list(page.productProof.points),
    "",
    `## ${page.comparison.heading}`,
    "",
    `| | ${page.comparison.basicLabel} | ${page.comparison.vistaireLabel} |`,
    "| --- | --- | --- |",
    ...page.comparison.rows.map((row) => `| ${row.label} | ${row.basic} | ${row.vistaire} |`),
    "",
    ...page.included.map((item) => `- **${item.title}** ${item.text}`),
    ...(page.areaServed?.length ? ["", `Zones desservies : ${page.areaServed.join(", ")}`] : []),
    "",
    "## FAQ",
    ...page.faq.flatMap((item) => ["", `### ${item.question}`, "", item.answer]),
    "",
    link(page.primaryCta.href, page.primaryCta.label),
    ...footer(page.path),
  ];
}

function guideMarkdown(guide: EditorialGuide) {
  return [
    `# ${guide.h1}`,
    "",
    guide.dek,
    "",
    `> ${guide.definition}`,
    ...guide.sections.flatMap((section) => [
      "",
      `## ${section.title}`,
      "",
      ...section.paragraphs.flatMap((p) => [p, ""]),
      ...list(section.bullets),
      ...(section.table
        ? ["", `| ${section.table.headers.join(" | ")} |`, "| --- | --- | --- |", ...section.table.rows.map((row) => `| ${row.join(" | ")} |`)]
        : []),
    ]),
    "",
    `## ${guide.checklist.title}`,
    "",
    guide.checklist.introduction,
    "",
    ...list(guide.checklist.items),
    "",
    `${guide.cta.text} ${link(guide.cta.href, guide.cta.label)}`,
    ...footer(guide.path),
  ];
}

function pricingMarkdown(page: PricingPageContent) {
  return [
    `# ${page.h1}`,
    "",
    page.subtitle,
    "",
    ...page.collections.map((c) => `- **${c.name}** (${c.label}) : ${c.setupPrice} · ${c.monthlyPrice}. ${c.description}`),
    "",
    `## ${page.included.title}`,
    "",
    page.included.body,
    "",
    ...page.includedGroups.flatMap((group) => [`### ${group.title}`, "", ...list(group.items), ""]),
    `## ${page.threeDAddOns.title}`,
    "",
    page.threeDAddOns.body,
    "",
    ...page.threeDAddOns.packs.map((pack) => `- ${pack.label} : ${pack.price}`),
    `- ${page.threeDAddOns.individualLabel} : ${page.threeDAddOns.individualPrice}`,
    "",
    `## ${page.pilotage.title}`,
    "",
    `${page.pilotage.price}. ${page.pilotage.body}`,
    "",
    ...list(page.pilotage.features),
    "",
    `## ${page.workflow.title}`,
    "",
    page.workflow.body,
    "",
    ...page.workflow.steps.map((step) => `${step.index}. **${step.title}** ${step.body}`),
    "",
    page.workflow.leadTime,
    "",
    `## ${page.commercialTerms.title}`,
    "",
    ...list(page.commercialTerms.items),
    ...footer(page.path),
  ];
}

type Entry = { path: string; build: () => string[] };
const ENTRIES: Entry[] = [
  ...[PRICING_PAGE, PRICING_PAGE_EN].map((page) => ({ path: page.path, build: () => pricingMarkdown(page) })),
  ...[...SEO_PAGES, ...SEO_PAGES_EN].map((page) => ({ path: page.path, build: () => pillarMarkdown(page) })),
  ...[...SEO_GEO_PAGES, ...SEO_GEO_PAGES_EN].map((page) => ({ path: page.path, build: () => geoMarkdown(page) })),
  ...EDITORIAL_GUIDES.map((guide) => ({ path: guide.path, build: () => guideMarkdown(guide) })),
];
const BY_PATH = new Map(ENTRIES.map((entry) => [entry.path, entry]));

/** Markdown for one public page, or null when the path has no structured twin. */
export function buildPageMarkdown(pathname: string): string | null {
  const entry = BY_PATH.get(pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname);
  return entry ? entry.build().join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n" : null;
}

const UNPROBED_ROOTS = new Set(["api", "q"]);

// Asks the app itself (as HTML) whether the path renders, so no route list can drift:
// only a real 404 earns the markdown 404. Network failures fall back to Next's own response.
export async function isMissingRoute(url: URL, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  // The probe runs the route's GET: API keeps its JSON errors, and /q/<token> would count a second QR scan.
  if (UNPROBED_ROOTS.has(url.pathname.split("/")[1] ?? "")) return false;
  try {
    const response = await fetchImpl(url, { method: "HEAD", redirect: "manual", headers: { accept: "text/html" } });
    return response.status === 404;
  } catch {
    return false;
  }
}

export function buildNotFoundMarkdown(pathname: string): string {
  return [
    "# Page not found",
    "",
    `No Vistaire page exists at \`${pathname}\`.`,
    "",
    `- Site overview for agents: ${absoluteUrl("/llms.txt")}`,
    `- All public pages: ${absoluteUrl("/sitemap.xml")}`,
    `- Homepage: ${absoluteUrl("/")}`,
    ""
  ].join("\n");
}

/** Every structured page, once, for agents that read the whole site in one request. */
export function buildLlmsFullText(): string {
  return [
    `# ${SITE_NAME} : contenu complet`,
    "",
    `> Version texte intégrale des pages publiques de ${SITE_NAME}, menu digital premium pour restaurants (${CONTACT_LOCATION_LABEL}).`,
    "",
    ...[...BY_PATH.keys()].flatMap((path) => [buildPageMarkdown(path) ?? "", ""]),
  ].join("\n");
}
