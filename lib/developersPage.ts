// One content source for the /developers pages and their Markdown twins.
// Inline `code` spans use backticks; the HTML page renders them as <code>.
import { absoluteUrl } from "./seo.ts";

export const DEVELOPERS_PATH = { fr: "/developers", en: "/en/developers" } as const;

export type DevelopersLocale = keyof typeof DEVELOPERS_PATH;

export type DevelopersSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
  code?: string;
};

export type DevelopersPageContent = {
  locale: DevelopersLocale;
  path: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  intro: string;
  updatedLabel: string;
  sections: DevelopersSection[];
  resourcesHeading: string;
  resources: { path: string; text: string }[];
  booking: { text: string; label: string; path: string };
};

const exchangeRatesExample = `curl "${absoluteUrl("/api/exchange-rates")}?base=CAD&quotes=USD,EUR"`;
const errorExample = `{ "ok": false, "error": "API route not found.", "code": "not_found", "hint": "See ${absoluteUrl("/openapi.json")} for the public API." }`;

export const DEVELOPERS_PAGE: Record<DevelopersLocale, DevelopersPageContent> = {
  fr: {
    locale: "fr",
    path: DEVELOPERS_PATH.fr,
    metaTitle: "Développeurs et agents | Vistaire",
    metaDescription:
      "API publique en lecture seule de Vistaire, spécification OpenAPI, authentification et ressources pour agents IA.",
    eyebrow: "Vistaire · Développeurs",
    title: "Vistaire pour les développeurs et les agents",
    intro:
      "Vistaire est un service de menu digital pour restaurants. Cette page décrit la petite surface publique, en lecture seule, que les développeurs et les agents IA peuvent utiliser sans compte.",
    updatedLabel: "Dernière mise à jour : 21 octobre 2026",
    sections: [
      {
        heading: "Ce qui est public",
        paragraphs: [
          "Les points d’accès publics sont en lecture seule et ne demandent aucune clé. Les API du back-office (restaurants, menus, QR) sont réservées aux propriétaires connectés et ne font pas partie de l’API publique."
        ]
      },
      {
        heading: "Points d’accès",
        items: [
          "`GET /api/exchange-rates` : taux de change utilisés pour l’affichage des prix d’un menu public. Paramètres facultatifs `base` (CAD, USD ou EUR) et `quotes`.",
          "`GET /api/public/menu-dishes/{dishId}/photo`, `/model/glb` et `/model/usdz` : photo ou modèle 3D d’un plat publié. Répond par une redirection 307 vers le fichier signé."
        ],
        code: exchangeRatesExample
      },
      {
        heading: "Erreurs",
        paragraphs: ["Les erreurs de l’API sont en JSON, avec un code lisible par une machine et une piste de résolution :"],
        code: errorExample
      },
      {
        heading: "Authentification",
        paragraphs: [
          "Aucune authentification n’est nécessaire pour les points d’accès publics. Vistaire n’offre pas encore de serveur OAuth, de clés d’API en libre-service ni d’environnement de test. Pour une intégration, écrivez à contact@vistaire.ca. Le détail est publié dans `/auth.md`."
        ]
      }
    ],
    resourcesHeading: "Ressources lisibles par machine",
    resources: [
      { path: "/openapi.json", text: "spécification OpenAPI 3.1 de l’API publique." },
      { path: "/llms.txt", text: "présentation de Vistaire pour les modèles de langage (version complète : /llms-full.txt)." },
      { path: "/auth.md", text: "authentification et inscription des agents." },
      { path: "/.well-known/api-catalog", text: "catalogue d’API (RFC 9727)." },
      { path: "/.well-known/agent-skills/index.json", text: "compétences pour agents, avec quand les utiliser." },
      { path: "/.well-known/mcp/server-card.json", text: "fiche MCP (pas de serveur MCP pour l’instant)." }
    ],
    booking: {
      text: "Chaque page publique répond aussi en Markdown avec l’en-tête `Accept: text/markdown`. Pour un projet de menu :",
      label: "Prendre rendez-vous",
      path: "/prendre-rendez-vous"
    }
  },
  en: {
    locale: "en",
    path: DEVELOPERS_PATH.en,
    metaTitle: "Developers and agents | Vistaire",
    metaDescription:
      "Vistaire's read-only public API, OpenAPI specification, authentication and resources for AI agents.",
    eyebrow: "Vistaire · Developers",
    title: "Vistaire for developers and agents",
    intro:
      "Vistaire is a digital menu service for restaurants. This page describes the small, read-only public surface that developers and AI agents can use without an account.",
    updatedLabel: "Last updated: October 21, 2026",
    sections: [
      {
        heading: "What is public",
        paragraphs: [
          "Public endpoints are read-only and need no key. Back-office APIs (restaurants, menus, QR codes) are reserved for signed-in owners and are not part of the public API."
        ]
      },
      {
        heading: "Endpoints",
        items: [
          "`GET /api/exchange-rates`: exchange rates used to display public menu prices. Optional `base` (CAD, USD or EUR) and `quotes` parameters.",
          "`GET /api/public/menu-dishes/{dishId}/photo`, `/model/glb` and `/model/usdz`: photo or 3D model of a published dish. Answers with a 307 redirect to the signed file."
        ],
        code: exchangeRatesExample
      },
      {
        heading: "Errors",
        paragraphs: ["API errors are JSON, with a machine-readable code and a recovery hint:"],
        code: errorExample
      },
      {
        heading: "Authentication",
        paragraphs: [
          "Public endpoints need no authentication. Vistaire does not offer an OAuth server, self-serve API keys or a sandbox yet. For an integration, write to contact@vistaire.ca. Details are published in `/auth.md`."
        ]
      }
    ],
    resourcesHeading: "Machine-readable resources",
    resources: [
      { path: "/openapi.json", text: "OpenAPI 3.1 specification of the public API." },
      { path: "/llms.txt", text: "Vistaire overview for language models (full version: /llms-full.txt)." },
      { path: "/auth.md", text: "agent authentication and registration." },
      { path: "/.well-known/api-catalog", text: "API catalog (RFC 9727)." },
      { path: "/.well-known/agent-skills/index.json", text: "agent skills, with when to use them." },
      { path: "/.well-known/mcp/server-card.json", text: "MCP card (no MCP server yet)." }
    ],
    booking: {
      text: "Every public page also answers in Markdown with the `Accept: text/markdown` header. For a menu project:",
      label: "Book a call",
      path: "/en/book-a-call"
    }
  }
};
