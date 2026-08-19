import { createHash } from "node:crypto";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  DEFAULT_SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl
} from "../seo.ts";

export {
  HOME_AGENT_LINK_HEADER,
  buildHomeAgentLinkHeader
} from "./homeResponseHeaders.ts";

export const AGENT_DISCOVERY_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=86400";

export const LINKSET_CONTENT_TYPE =
  'application/linkset+json; charset=utf-8; profile="https://www.rfc-editor.org/info/rfc9727"';

export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

export function markdownTokenEstimate(markdown: string): string {
  return String(Math.ceil(markdown.trim().split(/\s+/).filter(Boolean).length * 1.35));
}

type AcceptPreference = {
  mediaType: string;
  q: number;
  index: number;
};

function parseAcceptHeader(acceptHeader: string | null): AcceptPreference[] {
  return (acceptHeader ?? "")
    .split(",")
    .map((rawItem, index): AcceptPreference | null => {
      const [rawMediaType, ...rawParams] = rawItem.split(";").map((item) => item.trim());
      const mediaType = rawMediaType.toLowerCase();
      if (!mediaType.includes("/")) return null;

      let q = 1;
      for (const param of rawParams) {
        const [key, value] = param.split("=").map((item) => item.trim());
        if (key.toLowerCase() !== "q") continue;
        const parsed = Number(value);
        q = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0;
      }

      return { mediaType, q, index };
    })
    .filter((item): item is AcceptPreference => Boolean(item));
}

function bestExplicitPreference(
  preferences: AcceptPreference[],
  mediaTypes: ReadonlySet<string>
): AcceptPreference | null {
  let best: AcceptPreference | null = null;

  for (const preference of preferences) {
    if (!mediaTypes.has(preference.mediaType)) continue;
    if (!best || preference.q > best.q || (preference.q === best.q && preference.index < best.index)) {
      best = preference;
    }
  }

  return best;
}

export function shouldServeMarkdownForAcceptHeader(acceptHeader: string | null): boolean {
  const preferences = parseAcceptHeader(acceptHeader);
  const markdown = bestExplicitPreference(preferences, new Set(["text/markdown"]));
  if (!markdown || markdown.q <= 0) return false;

  const html = bestExplicitPreference(
    preferences,
    new Set(["text/html", "application/xhtml+xml"])
  );
  if (!html || html.q <= 0) return true;
  if (markdown.q !== html.q) return markdown.q > html.q;

  return markdown.index < html.index;
}

export function buildHomepageMarkdown() {
  return [
    "# Vistaire",
    "",
    DEFAULT_SITE_DESCRIPTION,
    "",
    "## Experience publique",
    "",
    "- Menu digital QR premium pour restaurants haut de gamme.",
    "- Fiches plats mobiles avec prix, allergenes, visuels et contexte de service.",
    "- Demonstrations 3D/AR selectives pour plats signatures, chargees avec prudence.",
    "- Parcours public centre sur le menu, la decouverte des plats et la prise de contact.",
    "",
    "## Liens principaux",
    "",
    `- Accueil: ${absoluteUrl("/")}`,
    `- Menu demo: ${absoluteUrl("/demo")}`,
    `- Menu digital restaurant: ${absoluteUrl("/menu-digital-restaurant")}`,
    `- Tarifs: ${absoluteUrl("/tarifs-menu-digital-restaurant")}`,
    `- Contact: ${absoluteUrl("/prendre-rendez-vous")}`,
    `- OpenAPI: ${absoluteUrl("/openapi.json")}`,
    "",
    "## Contact",
    "",
    `- Courriel: ${CONTACT_EMAIL}`,
    `- Telephone: ${CONTACT_PHONE_DISPLAY}`,
    "",
    "## Agent discovery",
    "",
    `- API catalog: ${absoluteUrl("/.well-known/api-catalog")}`,
    `- Auth instructions: ${absoluteUrl("/auth.md")}`,
    `- MCP Server Card: ${absoluteUrl("/.well-known/mcp/server-card.json")}`,
    `- Agent skills index: ${absoluteUrl("/.well-known/agent-skills/index.json")}`,
    "",
    "## Limites pour agents",
    "",
    "- Vistaire ne publie pas de self-service OAuth registration pour agents.",
    "- Les endpoints owner/admin restent proteges et ne doivent pas etre explores comme API publique.",
    "- Les actions destructives, uploads, paiements et mutations owner ne sont pas exposes aux agents publics."
  ].join("\n");
}

export function buildOpenApiDocument() {
  const signedStorageRedirect = {
    description: "Empty redirect to the signed Storage object",
    headers: {
      Location: {
        required: true,
        schema: { type: "string", format: "uri" }
      }
    }
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "Vistaire Public Discovery API",
      version: "0.1.0",
      description:
        "Minimal public API description for safe Vistaire discovery endpoints. Owner APIs are intentionally excluded."
    },
    servers: [{ url: absoluteUrl("/") }],
    paths: {
      "/api/exchange-rates": {
        get: {
          summary: "Read public menu currency exchange rates",
          description:
            "Returns public exchange-rate data used by menu display. This endpoint does not expose owner data.",
          parameters: [
            {
              name: "base",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["CAD", "USD", "EUR"] }
            },
            {
              name: "quotes",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Comma-separated quote currencies."
            }
          ],
          responses: {
            "200": {
              description: "Exchange rates response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok", "base", "rates", "provider", "updatedAt", "cached"],
                    properties: {
                      ok: { type: "boolean" },
                      base: { type: "string" },
                      rates: { type: "object", additionalProperties: { type: "number" } },
                      provider: { type: "string" },
                      updatedAt: { type: "string" },
                      cached: { type: "boolean" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/public/menu-dishes/{dishId}/photo": {
        get: {
          summary: "Read a public dish photo",
          description:
            "Returns a public dish image only when the dish is available and the media exists.",
          parameters: [
            {
              name: "dishId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            },
            {
              name: "v",
              in: "query",
              required: false,
              schema: { type: "string", pattern: "^[a-fA-F0-9]{64}$" }
            }
          ],
          responses: {
            "307": signedStorageRedirect,
            "404": { description: "Dish photo not found" },
            "503": { description: "Media storage unavailable" }
          }
        }
      },
      "/api/public/menu-dishes/{dishId}/model/glb": {
        get: {
          summary: "Read a public dish GLB model",
          description:
            "Returns a public GLB model only when the dish is available and the model exists.",
          parameters: [
            {
              name: "dishId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            },
            {
              name: "variant",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["ar-lite"] }
            },
            {
              name: "v",
              in: "query",
              required: false,
              schema: { type: "string" }
            }
          ],
          responses: {
            "307": signedStorageRedirect,
            "404": { description: "Dish model not found" },
            "503": { description: "Model storage unavailable" }
          }
        }
      },
      "/api/public/menu-dishes/{dishId}/model/usdz": {
        get: {
          summary: "Read a public dish USDZ model",
          description:
            "Returns a public USDZ model only when the dish is available and the model exists.",
          parameters: [
            {
              name: "dishId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            },
            {
              name: "v",
              in: "query",
              required: false,
              schema: { type: "string" }
            }
          ],
          responses: {
            "307": signedStorageRedirect,
            "404": { description: "Dish model not found" },
            "503": { description: "Model storage unavailable" }
          }
        }
      }
    }
  };
}

export function buildApiCatalog() {
  return {
    linkset: [
      {
        anchor: absoluteUrl("/.well-known/api-catalog"),
        "service-desc": [
          {
            href: absoluteUrl("/openapi.json"),
            type: "application/openapi+json",
            title: "Vistaire public discovery OpenAPI"
          }
        ],
        "service-doc": [
          {
            href: absoluteUrl("/auth.md"),
            type: "text/markdown",
            title: "Vistaire agent authentication notes"
          }
        ],
        item: [
          {
            href: absoluteUrl("/api/exchange-rates"),
            type: "application/json",
            title: "Public exchange rates"
          },
          {
            href: absoluteUrl("/api/public/menu-dishes/{dishId}/photo"),
            title: "Public dish photo route template"
          },
          {
            href: absoluteUrl("/api/public/menu-dishes/{dishId}/model/glb"),
            title: "Public dish GLB route template"
          },
          {
            href: absoluteUrl("/api/public/menu-dishes/{dishId}/model/usdz"),
            title: "Public dish USDZ route template"
          }
        ]
      }
    ]
  };
}

export function buildOauthProtectedResourceMetadata() {
  return {
    resource: absoluteUrl("/"),
    resource_name: "Vistaire public site and session-protected owner app",
    resource_documentation: absoluteUrl("/auth.md"),
    authorization_servers: [],
    bearer_methods_supported: [],
    oauth_status: "not_available",
    authorization_server_note:
      "Vistaire protects owner routes and owner APIs with Clerk session authentication and a server-side owner allowlist. The repo does not define a Vistaire-operated OAuth authorization server, credential endpoint, JWKS endpoint, bearer credential resource access, documented public OAuth scopes, or public agent registration flow, so no issuer or bearer method is advertised here."
  };
}

export function buildMcpServerCard() {
  return {
    serverInfo: {
      name: SITE_NAME,
      version: "0.1.0"
    },
    endpoint: null,
    status: "not_available",
    transports: [],
    capabilities: {
      tools: [],
      resources: [
        {
          name: "public_site_summary",
          uri: absoluteUrl("/"),
          description: "Public Vistaire restaurant menu positioning and contact information."
        },
        {
          name: "agent_discovery",
          uri: absoluteUrl("/.well-known/agent-skills/index.json"),
          description: "Public discovery index for safe agent-readable skills."
        }
      ],
      prompts: []
    },
    limitations: [
      "No remote MCP transport endpoint is active in this repository.",
      "Backend MCP tools are not advertised because no MCP server route exists.",
      "Safe browser-side WebMCP tools may be registered on supported browsers."
    ],
    documentation: absoluteUrl("/auth.md")
  };
}

export const AGENT_SKILL_DOCS = [
  {
    name: "menu-discovery",
    description: "Find public Vistaire menu and demo pages without using owner/admin routes.",
    path: "/.well-known/agent-skills/menu-discovery/SKILL.md",
    content: [
      "# Skill: Vistaire Menu Discovery",
      "",
      "Use this skill to discover public Vistaire menu experiences.",
      "",
      "## Safe actions",
      "",
      "- Read the public homepage and public SEO/menu pages.",
      "- Follow public demo/menu links exposed by the site.",
      "- Do not request owner, admin, sign-in, todos, or non-public API routes.",
      "",
      "## Useful URLs",
      "",
      `- Homepage: ${absoluteUrl("/")}`,
      `- Demo menu: ${absoluteUrl("/demo")}`,
      `- API catalog: ${absoluteUrl("/.well-known/api-catalog")}`
    ].join("\n")
  },
  {
    name: "contact",
    description: "Find Vistaire public contact and booking options without submitting forms automatically.",
    path: "/.well-known/agent-skills/contact/SKILL.md",
    content: [
      "# Skill: Vistaire Contact",
      "",
      "Use this skill to find public Vistaire contact options.",
      "",
      "## Safe actions",
      "",
      "- Read public contact details.",
      "- Open the booking/contact page for a user.",
      "- Do not submit the contact form without explicit user intent.",
      "",
      "## Contact",
      "",
      `- Email: ${CONTACT_EMAIL}`,
      `- Phone: ${CONTACT_PHONE_DISPLAY}`,
      `- Booking page: ${absoluteUrl("/prendre-rendez-vous")}`
    ].join("\n")
  },
  {
    name: "public-menu",
    description: "Understand safe read-only public menu media routes and their limitations.",
    path: "/.well-known/agent-skills/public-menu/SKILL.md",
    content: [
      "# Skill: Vistaire Public Menu",
      "",
      "Use this skill for read-only public menu media discovery.",
      "",
      "## Safe actions",
      "",
      "- Fetch public dish photos or GLB models only when a public menu page links to them.",
      "- Treat route parameters as opaque identifiers.",
      "- Do not enumerate non-public owner APIs or mutate restaurant data.",
      "",
      "## Public API description",
      "",
      `- OpenAPI: ${absoluteUrl("/openapi.json")}`
    ].join("\n")
  }
] as const;

export function sha256Digest(value: string) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function buildAgentSkillsIndex() {
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: AGENT_SKILL_DOCS.map((skill) => ({
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: absoluteUrl(skill.path),
      digest: sha256Digest(skill.content),
      sha256: sha256Digest(skill.content).replace(/^sha256:/, "")
    }))
  };
}

export function findAgentSkill(pathname: string) {
  return AGENT_SKILL_DOCS.find((skill) => skill.path === pathname) ?? null;
}

export function buildAuthMarkdown() {
  return [
    "# Vistaire auth.md",
    "",
    "Vistaire publishes this file so agents can understand the current authentication and registration posture without guessing.",
    "",
    "## Service",
    "",
    `- Name: ${SITE_NAME}`,
    `- Base URL: ${absoluteUrl("/")}`,
    `- Contact: ${CONTACT_EMAIL}`,
    "",
    "## Public agent access",
    "",
    "- Public site pages, the API catalog, this auth.md file, MCP Server Card, and Agent Skills documents are available without authentication.",
    "- Public read-only menu media endpoints may be used when linked from public menu pages.",
    "- Vistaire does not currently provide self-service agent registration, OAuth dynamic client registration, or an agent credential issuance endpoint.",
    "",
    "## Authentication model",
    "",
    "- Owner routes and owner APIs are protected by Clerk session authentication and a Vistaire owner allowlist.",
    "- The /admin preview is a public noindex demonstration surface, not an advertised agent API and not owner-authenticated production tooling.",
    "- Supabase is used for data and storage; the public Supabase project URL/key are not an OAuth issuer for Vistaire agent access.",
    "- The repo does not define a Vistaire-operated OAuth authorization server, credential endpoint, JWKS endpoint, OIDC issuer, bearer credential API access, or public OAuth scopes for agents.",
    "- No agent_auth block is published because there is no real register URI, credential issuance flow, or supported identity assertion flow in this repository.",
    "",
    "## Registration process",
    "",
    "- Registration status: manual review only.",
    "- Supported identity types for agents: none documented for self-service use.",
    "- Credential types for agents: none issued by Vistaire self-service flows.",
    `Contact ${CONTACT_EMAIL} or use ${absoluteUrl("/prendre-rendez-vous")} for partnership or integration access.`,
    "Do not attempt automated account creation or owner/admin route probing.",
    "",
    "## Discovery endpoints",
    "",
    `- API catalog: ${absoluteUrl("/.well-known/api-catalog")}`,
    `- OAuth Protected Resource Metadata: ${absoluteUrl("/.well-known/oauth-protected-resource")}`,
    "- OAuth Authorization Server Metadata: not published because Vistaire has no OAuth authorization server.",
    "- OpenID Connect Discovery: not published because Vistaire has no Vistaire-operated OIDC issuer.",
    `- MCP Server Card: ${absoluteUrl("/.well-known/mcp/server-card.json")}`,
    `- Agent Skills index: ${absoluteUrl("/.well-known/agent-skills/index.json")}`,
    "",
    "## Safety and privacy",
    "",
    "- Do not submit contact forms, upload files, delete content, change menus, or trigger owner workflows without explicit human instruction.",
    "- Do not collect or infer non-public owner data from protected endpoints.",
    "- Treat public menu media as read-only presentation assets."
  ].join("\n");
}
