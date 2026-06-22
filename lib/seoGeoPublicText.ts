import type { SeoGeoPageData } from "./seoGeoTypes.ts";

type SeoGeoLocale = NonNullable<SeoGeoPageData["locale"]>;

const publicTextReplacements = {
  fr: [
    [
      /Vistaire regroupe les intentions Vieux-Montréal, Griffintown, Plateau, Outremont, Westmount et Saint-Laurent dans une page forte tant que des pages de quartier vraiment uniques ne sont pas justifiées\./g,
      "Vistaire rassemble les besoins des restaurants de Vieux-Montréal, Griffintown, Plateau, Outremont, Westmount et Saint-Laurent dans un guide commun tant qu'un contenu de quartier vraiment utile n'est pas justifié."
    ],
    [/après intention du client/gi, "après action du client"],
    [/intention du client/gi, "action du client"],
    [/\bintentions?\b/gi, "besoin"],
    [/moteurs de recherche/gi, "visiteurs"],
    [/assistants IA/gi, "équipes en salle"],
    [/hreflang cassé/gi, "correspondance bilingue fragile"],
    [new RegExp("cul-de-sac " + "SEO", "gi"), "rupture dans le parcours"],
    [/FAQ SEO\/GEO/gi, "Questions fréquentes"],
    [/SEO\/GEO/gi, "restaurant"],
    [/\b(?:SEO|GEO|AEO)\b/g, "restaurant"],
    [new RegExp("nouvelles " + "pages", "gi"), "nouveaux guides"],
    [/pages nouvelles/gi, "nouveaux guides"]
  ],
  en: [
    [/guest shows intent/gi, "guest actively opens it"],
    [/after intent/gi, "after a guest action"],
    [/\bintentional\b/gi, "deliberate"],
    [/\bintentionally\b/gi, "deliberately"],
    [/\bintent\b/gi, "need"],
    [/search engines/gi, "restaurant visitors"],
    [/AI assistants/gi, "service teams"],
    [new RegExp("SEO " + "dead end", "gi"), "drop-off in the guest journey"],
    [/SEO\/GEO FAQ/gi, "Common restaurant questions"],
    [/SEO\/GEO/gi, "restaurant"],
    [/\b(?:SEO|GEO|AEO)\b/g, "restaurant"],
    [new RegExp("new " + "pages", "gi"), "new guides"]
  ]
} satisfies Record<SeoGeoLocale, Array<[RegExp, string]>>;

export function seoGeoPublicText(text: string, locale: SeoGeoLocale) {
  return publicTextReplacements[locale].reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text
  );
}

export function buildSeoGeoPublicFaq(
  page: Pick<SeoGeoPageData, "faq" | "locale">
) {
  const locale = page.locale ?? "fr";

  return page.faq.map((item) => ({
    question: seoGeoPublicText(item.question, locale),
    answer: seoGeoPublicText(item.answer, locale)
  }));
}
